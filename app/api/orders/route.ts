import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import { fireOrderTrigger } from '@/lib/automations/triggers';
import { createOrderWithCustomer, resolveOrderLines, normalizeCustomerPhone, OrderCustomerIdentityError, OrderLinesError } from '@/lib/orders';

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
// always born `pendiente`; payment is registered afterwards via "Registrar pago".
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
    notas_internas:    z.string().trim().optional(),
    // Real product lines, priced server-side by resolveOrderLines.
    items: z
      .array(z.object({
        slug:     z.string().trim().min(1),
        cantidad: z.number().int().positive(),
        molienda: z.string().trim().min(1).nullish(),
      }))
      .min(1, 'Agrega al menos un producto'),
    // Client-generated per-submit key; makes a double-click / retry idempotent.
    idempotencyKey: z.string().uuid().optional(),
  })
  // At least one usable identity — a non-empty but unparseable phone with no
  // email is rejected (the phone would otherwise silently drop).
  .refine(
    (d) => Boolean(d.cliente_email) || Boolean(normalizeCustomerPhone(d.cliente_telefono)),
    { message: 'Ingresa un correo válido o un teléfono (celular colombiano)', path: ['cliente_telefono'] },
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
    // Order is always born `pendiente` (no estado/metodo_pago here). Payment is
    // registered afterwards via "Registrar pago" → writes the Payment row and
    // auto-creates the Shipping. Same creation path (+ Customer upsert, CN-
    // numbering, idempotency) as checkout.
    const result = await createOrderWithCustomer({
      customer:          { nombre: b.cliente_nombre, email: b.cliente_email ?? null, telefono: b.cliente_telefono ?? null },
      canal:             b.canal || 'whatsapp',
      total,
      costo_envio,
      direccion_entrega: b.direccion_entrega || null,
      notas_internas:    b.notas_internas || null,
      items:             lines,
      idempotencyKey:    b.idempotencyKey ?? null,
    });

    fireOrderTrigger('nueva_orden', result as never).catch(console.error);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof OrderCustomerIdentityError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Admin order creation failed:', error);
    return NextResponse.json({ error: 'No se pudo crear la orden' }, { status: 500 });
  }
}