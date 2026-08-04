import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import { createOrderWithCustomer, resolveOrderLines, normalizeCustomerPhone, derivarCondicionPago, OrderCustomerIdentityError, OrderCustomerNotFoundError, OrderLinesError } from '@/lib/orders';
import { MetodoPago } from '@/src/generated/prisma/client';
import { departamentoField } from '@/lib/validation/address';
import { runEventAutomations } from '@/lib/automations/engine';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const orders = await prisma.order.findMany({
    // shipping drives the "Programar entrega" edit flow and fulfillment display.
    include:  { items: true, shipping: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(orders);
}

// Admin manual order. A REAL order: same structure and rules as a web order.
// Customer identity is flexible (email OPTIONAL, but at least one of email or a
// valid Colombian mobile). Product lines are priced SERVER-SIDE from the catalog
// (the admin never types the total). Shipping cost stays manual. The order is
// always born `pendiente`; the DECLARED method (metodoPagoPrevisto) is just
// intent. Payment is registered afterwards via "Registrar pago" — UNLESS
// `pagoRecibido` is set, in which case it's registered in the same transaction.
const adminOrderSchema = z
  .object({
    cliente_nombre:    z.string().trim().min(1, 'El nombre del cliente es requerido'),
    cliente_email:     z.preprocess(
      (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined),
      z.string().email('Correo inválido').optional(),
    ),
    cliente_telefono:  z.string().trim().optional(),
    canal:             z.string().trim().optional(),
    costo_envio:       z.coerce.number().nonnegative().optional(),
    direccion_entrega: z.string().trim().optional(),
    // Ciudad y departamento OPCIONALES: la orden manual debe poder crearse sin
    // ellos. La ciudad se persiste (es lo que le permite a `sugerirZona`
    // proponer una zona al programar la entrega). El departamento se valida
    // contra la lista canónica cuando viene, pero NO se persiste — `Order` no
    // tiene columna; mismo criterio que deliveryAddressSchema.
    ciudad_entrega:    z.string().trim().min(1).optional(),
    departamento:      departamentoField.optional(),
    notas_internas:    z.string().trim().optional(),
    // Método de pago PREVISTO (intención). Enum de Payment; opcional ("Por
    // definir"). No crea Payment ni cambia estado por sí solo. La CONDICIÓN de
    // pago NO se acepta aquí: se deriva server-side de este método
    // (derivarCondicionPago) — un `condicion_pago` en el payload se ignora.
    metodoPagoPrevisto: z.nativeEnum(MetodoPago).nullish(),
    // "El pago ya fue recibido": registra el pago al crear (ver refine abajo).
    pagoRecibido:       z.boolean().optional(),
    // Real product lines, priced server-side by resolveOrderLines.
    items: z
      .array(z.object({
        slug:     z.string().trim().min(1),
        cantidad: z.number().int().positive(),
        molienda: z.string().trim().min(1).nullish(),
      }))
      .min(1, 'Agrega al menos un producto'),
    // Explicit customer chosen via the duplicate banner ("Usar este cliente").
    // When present, the order attaches to it (validated server-side); no upsert.
    cliente_id: z.string().trim().min(1).optional(),
    // "Crear cliente nuevo" from the banner: create despite a phone/email match.
    forzarClienteNuevo: z.boolean().optional(),
    // Client-generated per-submit key; makes a double-click / retry idempotent.
    idempotencyKey: z.string().uuid().optional(),
  })
  // The two decisions are mutually exclusive — "usar este cliente" vs "crear
  // nuevo". Both together is an incoherent client, rejected.
  .refine(
    (d) => !(d.cliente_id && d.forzarClienteNuevo),
    { message: 'Decisión de cliente ambigua (usar existente y crear nuevo a la vez)', path: ['forzarClienteNuevo'] },
  )
  // At least one usable identity — a non-empty but unparseable phone with no
  // email is rejected (the phone would otherwise silently drop). An explicit
  // `cliente_id` satisfies identity on its own.
  .refine(
    (d) => Boolean(d.cliente_id) || Boolean(d.cliente_email) || Boolean(normalizeCustomerPhone(d.cliente_telefono)),
    { message: 'Ingresa un correo válido o un teléfono (celular colombiano)', path: ['cliente_telefono'] },
  )
  // Marking the payment as received requires knowing the method (not "Por
  // definir") — the Payment row can't record a null method. Server-enforced.
  .refine(
    (d) => !d.pagoRecibido || Boolean(d.metodoPagoPrevisto),
    { message: 'Selecciona el método de pago para marcar la orden como pagada', path: ['metodoPagoPrevisto'] },
  )
  // "Pago ya recibido" contradice CONTRAENTREGA (se cobra AL ENTREGAR): si el
  // método declarado es EFECTIVO la condición derivada es CONTRAENTREGA, y una
  // orden contraentrega no puede nacer pagada. La UI deshabilita el checkbox;
  // esto es el gemelo server-side (sobre la condición DERIVADA, no un input).
  .refine(
    (d) => !(d.pagoRecibido && derivarCondicionPago(d.metodoPagoPrevisto) === 'CONTRAENTREGA'),
    { message: 'Una orden en efectivo se cobra al entregar (contraentrega) — no puede nacer pagada', path: ['pagoRecibido'] },
  );

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ error: 'Cuerpo de la solicitud inválido' }, { status: 400 }); }

  const parsed = adminOrderSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.flatten() }, { status: 400 });
  }
  const b = parsed.data;

  // Price the lines server-side (same resolver as checkout: existence, stock,
  // molienda availability, unit prices). The admin never types the total.
  let lines: Awaited<ReturnType<typeof resolveOrderLines>>['lines'];
  let subtotal: number;
  try {
    const resolved = await resolveOrderLines(b.items);
    lines = resolved.lines;
    subtotal = resolved.subtotal;
  } catch (error) {
    if (error instanceof OrderLinesError) {
      return NextResponse.json(
        { error: error.message, ...(error.productosSinStock ? { productosSinStock: error.productosSinStock } : {}) },
        { status: 400 },
      );
    }
    throw error;
  }

  // Shipping is manual (rates TBD with the client), default 0; added to the
  // server-computed subtotal.
  const costo_envio = b.costo_envio ?? 0;
  const total = subtotal + costo_envio;

  try {
    // Order is always born `pendiente`. `metodoPagoPrevisto` records the declared
    // intent only. If `pagoRecibido`, the SAME creation transaction also registers
    // the payment (Payment + estado→pagado + Shipping) via the shared money-in
    // path — otherwise payment is registered later via "Registrar pago". Same
    // creation path (+ Customer upsert, CN- numbering, idempotency) as checkout.
    const result = await createOrderWithCustomer({
      customer:          { nombre: b.cliente_nombre, email: b.cliente_email ?? null, telefono: b.cliente_telefono ?? null },
      cliente_id:        b.cliente_id ?? null,
      forzarClienteNuevo: b.forzarClienteNuevo ?? false,
      canal:             b.canal || 'whatsapp',
      total,
      costo_envio,
      direccion_entrega: b.direccion_entrega || null,
      ciudad_entrega:    b.ciudad_entrega || null,
      notas_internas:    b.notas_internas || null,
      metodoPagoPrevisto: b.metodoPagoPrevisto ?? null,
      immediatePayment:  b.pagoRecibido && b.metodoPagoPrevisto
        ? {
            metodo:                b.metodoPagoPrevisto,
            registrado_por:        session.user.id,
            registrado_por_nombre: session.user.name ?? null,
          }
        : null,
      items:             lines,
      idempotencyKey:    b.idempotencyKey ?? null,
    });

    // Se emite `order.creada` con `origen: 'admin'` aunque HOY nada la escuche:
    // el filtro de "orden nueva" vive en el handler (`esOrigenNotificable`), no en
    // el emisor. Callar aquí escondería la decisión en el silencio de un endpoint
    // y dejaría al catálogo sin poder decir por qué las manuales no notifican;
    // además, cualquier automatización futura sobre creación de órdenes recibe el
    // evento sin tener que tocar este archivo.
    //
    // La campana no avisa de esta: el operador acaba de teclearla.
    // Y ojo, no confundir con "Notificación Nueva Orden" (WhatsApp al cliente),
    // que dispara en orden → `pagado`; el correo de orden creada ya sale desde
    // `notifyOrderCreated`, dentro de createOrderWithCustomer.
    if (result) {
      await runEventAutomations({ tipo: 'order.creada', orderId: result.id, origen: 'admin' });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof OrderCustomerIdentityError || error instanceof OrderCustomerNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Admin order creation failed:', error);
    return NextResponse.json({ error: 'No se pudo crear la orden' }, { status: 500 });
  }
}