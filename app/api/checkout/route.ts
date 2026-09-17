import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createOrderWithCustomer, resolveOrderLines, OrderLinesError } from '@duna/core/orders';
import { buildBrand } from '@/lib/config/brand';
import { getShippingSlot, computeShippingCost } from '@duna/core/shipping-config';
import { isBogotaDC } from '@duna/core/colombia-departments';
import { runEventAutomations } from '@/lib/automations/engine';
import {
  direccionField, direccionDetalleField, ciudadField, departamentoField, telefonoColombiaField,
} from '@duna/core/validation/address';
import { metodoPagoTipoSchema } from '@/lib/checkout/metodos-pago';
import { pesosACentavos, firmarIntegridadWompi } from '@/lib/pagos/wompi-firma';
import { consultarAceptaciones } from '@/lib/pagos/wompi-api';
import { evaluarAceptaciones } from '@/lib/pagos/aceptaciones';
import type { AceptacionesWompi } from '@/types/payment';
import { pasarelaDisponibleEnEsteDespliegue } from '@/services/checkout.service';
import { esDespliegueDemo } from '@/next.config';

// La moneda del store es COP, sin selector: es lo único que el checkout maneja
// hoy (formatCOP, Order.total, todo el sistema). No es un valor inventado para
// Wompi — es el que YA rige el resto del sistema.
const MONEDA_WOMPI = 'COP';

// Guest checkout is intentionally unauthenticated — no Better Auth session.
// The client is trusted ONLY for product slugs, quantities and customer /
// shipping details. Every price, the shipping cost, the order total, the order
// number and the order status are computed server-side from Product records.

// Exportado para el test co-ubicado (`route.test.ts`, § WOMPI-WIDGET-EN-EL-CANONICO-1):
// afirmar la FORMA del schema (la unión `metodo`/`pasarela`) no necesita invocar `POST` ni
// tocar la base — mismo criterio que `procesarEventoWompi`/`PaymentIntentDb` exportados del
// webhook (`app/api/webhooks/wompi/route.ts`) por la misma razón.
export const checkoutSchema = z.object({
  customer: z.object({
    nombre:   z.string().trim().min(1),
    apellido: z.string().trim().default(''),
    email:    z.string().trim().email(),
    // Same phone standard as the admin add-address flow (shared validator).
    telefono: telefonoColombiaField,
  }),
  // Address fields share their validators with the admin "Agregar dirección"
  // flow (lib/validation/address) — one definition of a valid address.
  shipping: z.object({
    direccion:         direccionField,
    direccion_detalle: direccionDetalleField,
    ciudad:            ciudadField,
    departamento:      departamentoField,
    franja:            z.string().trim().min(1).nullish(),
  }),
  payment: z.union([
    z.object({
      // DERIVADO de `METODOS_PAGO_ORDEN` (§ METODOS-TRES-LISTAS-1) — antes era un arreglo literal
      // que no importaba `MetodoPagoTipo`/`METODOS_PAGO_ORDEN`, así que un método agregado a la
      // lista real (`lib/checkout/metodos-pago.ts`) quedaba OFRECIDO por el checkout y RECHAZADO
      // acá con 400 al confirmar, sin que nada lo delatara.
      metodo:     metodoPagoTipoSchema,
      referencia: z.string().trim().min(1).optional(),
    }),
    z.object({
      // El camino APARTE de la pasarela (§ WOMPI-WIDGET-EN-EL-CANONICO-1) — NUNCA un valor más
      // de `metodo`/`METODOS_PAGO_ORDEN`: ese set cerrado es lo que el dueño configura en su
      // panel, y la pasarela es un toggle de DESPLIEGUE que todavía no existe (ver (d) más abajo).
      pasarela: z.literal(true),
    }),
  ]),
  items: z
    .array(
      z.object({
        slug:     z.string().trim().min(1),
        cantidad: z.number().int().positive(),
        molienda: z.string().trim().min(1).nullish(),
      }),
    )
    .min(1),
});

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido' }, { status: 400 });
  }

  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { customer, shipping, payment, items } = parsed.data;

  // `payment` es un discriminated union (§ WOMPI-WIDGET-EN-EL-CANONICO-1): o trae `metodo`
  // (el set cerrado de `METODOS_PAGO_ORDEN`) o trae `pasarela: true` — nunca los dos. Las dos
  // constantes derivadas abajo son la ÚNICA lectura del discriminador en toda la ruta.
  const metodoElegido = 'metodo' in payment ? payment.metodo : null;
  const pideWompi = 'pasarela' in payment;

  // Departamento is the single source of truth for Bogotá detection. It's
  // validated against the canonical list by `departamentoField` in the schema
  // above (shared with the admin add-address flow).

  // Derive the shipping tier from departamento. The client cannot select this.
  const metodoEnvio: 'bogota' | 'nacional' =
    isBogotaDC(shipping.departamento) ? 'bogota' : 'nacional';

  // Business rule: "Contra entrega" (efectivo) is only valid for Bogotá D.C.
  // deliveries. Client-side hiding is UX; the server is the enforcement point.
  if (metodoElegido === 'efectivo' && metodoEnvio !== 'bogota') {
    return NextResponse.json(
      { error: 'El pago contra entrega solo está disponible para entregas en Bogotá D.C.' },
      { status: 400 },
    );
  }

  // (d) EL TOGGLE POR DESPLIEGUE TODAVÍA NO EXISTE — la capacidad nace APAGADA en el
  // SERVIDOR, sin importar lo que pida el payload. La UI ya esconde la opción (§ el
  // checkout), pero esto es lo que impide que un POST directo con `pasarela: true` alcance
  // `crearIntentoPago` mientras `pasarelaDisponibleEnEsteDespliegue()` siga devolviendo
  // `false`. Va ANTES de tocar la base — ninguna fila se crea para una capacidad que este
  // despliegue no ofrece.
  if (pideWompi && !pasarelaDisponibleEnEsteDespliegue()) {
    return NextResponse.json(
      { error: 'El pago con tarjeta, PSE y más no está disponible en este momento.' },
      { status: 400 },
    );
  }

  // Bogotá deliveries carry a franja preference; validate it against config.
  const slot =
    metodoEnvio === 'bogota'
      ? getShippingSlot('bogota', shipping.franja)
      : undefined;
  if (metodoEnvio === 'bogota' && !slot) {
    return NextResponse.json(
      { error: 'Selecciona una franja horaria válida para tu entrega en Bogotá D.C.' },
      { status: 400 },
    );
  }

  // Resolve + price every line server-side via the shared resolver (product
  // existence, stock, molienda availability, unit prices) — the SAME rules the
  // admin manual order uses.
  let lines: Awaited<ReturnType<typeof resolveOrderLines>>['lines'];
  let orderSubtotal: number;
  try {
    const resolved = await resolveOrderLines(items);
    lines = resolved.lines;
    orderSubtotal = resolved.subtotal;
  } catch (error) {
    if (error instanceof OrderLinesError) {
      return NextResponse.json(
        { error: error.message, ...(error.productosSinStock ? { productosSinStock: error.productosSinStock } : {}) },
        { status: 400 },
      );
    }
    throw error;
  }

  // Shipping is checkout-specific: recompute from the server-derived method with
  // the shared free-shipping threshold. Never trust the client.
  const costo_envio = computeShippingCost(metodoEnvio, orderSubtotal);
  const total = orderSubtotal + costo_envio;

  const cliente_nombre = `${customer.nombre} ${customer.apellido}`.trim();

  // Single creation path — upserts the Customer + creates the Order & items in
  // one transaction (shared with the admin "Nueva Orden"). Checkout always brings
  // an email, so identity is by email (unchanged behavior). NO Payment here: the
  // order starts `pendiente`; the admin registers the received payment later.
  let order: Awaited<ReturnType<typeof createOrderWithCustomer>>;
  try {
    order = await createOrderWithCustomer({
      customer:          { nombre: cliente_nombre, email: customer.email, telefono: customer.telefono },
      canal:             'directo',
      // Sin método declarado (pago por pasarela) el string libre es `'wompi'` — NO entra a
      // `MetodoPagoTipo`/`METODOS_PAGO_ORDEN` (§ arriba); `Order.metodo_pago` es texto libre
      // (§ CLAUDE.md, Los MÉTODOS de pago son una LISTA) y `derivarCondicionPago` sólo
      // distingue el id EXACTO `'efectivo'`, así que esta orden deriva ANTICIPADO, correcto
      // para un cobro por adelantado.
      metodo_pago:       metodoElegido ?? 'wompi',
      total,
      costo_envio,
      direccion_entrega: shipping.direccion,
      direccion_detalle: shipping.direccion_detalle ?? null,
      ciudad_entrega:    shipping.ciudad,
      deliverySlot:      slot?.id ?? null,
      items:             lines,
      brand:             await buildBrand(),
      // Sólo llega a `true` si `pideWompi` pasó la guarda de arriba — hoy siempre `false`
      // (§ WOMPI-CREADOR-DE-INTENTOS-1, `pasarelaDisponibleEnEsteDespliegue`).
      crearIntentoPago:  pideWompi,
    });
  } catch (error) {
    console.error('Checkout order creation failed:', error);
    return NextResponse.json({ error: 'No se pudo procesar la orden' }, { status: 500 });
  }

  if (!order) {
    return NextResponse.json({ error: 'No se pudo procesar la orden' }, { status: 500 });
  }

  // ── WOMPI-WIDGET-EN-EL-CANONICO-1: el bloque firmado, TODAVÍA sin disparador real ──────
  // `order.paymentIntent` sólo existe si `pideWompi` pasó la guarda de disponibilidad de
  // arriba — y esa guarda devuelve `false` siempre hoy (§ `pasarelaDisponibleEnEsteDespliegue`,
  // (d) no existe). Esta rama queda CABLEADA de punta a punta —incluida la llave pública que
  // el widget necesita— para que el día que (d) encienda la capacidad, no haga falta tocar
  // esta respuesta (DECISIONS.md, WOMPI-CREADOR-DE-INTENTOS-1 · WOMPI-WIDGET-EN-EL-CANONICO-1).
  let wompi:
    | { reference: string; amountInCents: number; currency: string; signature: string; publicKey: string; aceptaciones: AceptacionesWompi }
    | undefined;
  if (order.paymentIntent) {
    const secretoIntegridad = process.env.WOMPI_INTEGRITY_SECRET;
    const llavePublica = process.env.WOMPI_PUBLIC_KEY;
    if (!secretoIntegridad || !llavePublica) {
      // Fail ruidoso, mismo criterio que el webhook (`WOMPI_EVENTS_SECRET`): un intento sin
      // firma o sin llave pública no sirve para nada, y silenciarlo dejaría al cliente
      // creyendo que puede pagar cuando no hay con qué firmar la petición ni con qué montar
      // el widget. `WOMPI_PUBLIC_KEY` no es secreta (§ lib/pagos/llaves-pasarela.ts) — el
      // riesgo acá no es exponerla, es devolver un bloque `wompi` a medias.
      console.error('[checkout] falta WOMPI_INTEGRITY_SECRET o WOMPI_PUBLIC_KEY — no se puede firmar/mostrar el intento de pago');
      return NextResponse.json({ error: 'No se pudo procesar la orden' }, { status: 500 });
    }

    // ── API-DIRECTA-ACEPTACIONES-SERVIDOR-1: las DOS casillas de aceptación ──────────────
    // Sin las dos completas —token Y enlace, las dos aceptaciones— la transacción NO SE
    // PUEDE CREAR en el proveedor (§ API-DIRECTA-DECISIONES-PROGRAMA-1 §4, DECISIONS.md),
    // así que ofrecer el pago y fallar después es peor que no ofrecerlo: el bloque `wompi`
    // entero queda AUSENTE de la respuesta, nunca a medias — el comprador no ve la causa,
    // sólo deja de ver la opción de pagar en línea; el porqué queda en el log del servidor.
    const baseUrlPasarela = esDespliegueDemo() ? 'https://sandbox.wompi.co' : 'https://production.wompi.co';
    let aceptaciones: AceptacionesWompi | null = null;
    try {
      aceptaciones = evaluarAceptaciones(await consultarAceptaciones(llavePublica, baseUrlPasarela));
      if (!aceptaciones) {
        console.error('[checkout] las aceptaciones de Wompi llegaron incompletas (falta un token o un enlace) — se omite el bloque de pasarela');
      }
    } catch (e) {
      console.error('[checkout] no se pudo consultar las aceptaciones de Wompi — se omite el bloque de pasarela:', e);
    }

    if (aceptaciones) {
      const amountInCents = pesosACentavos(order.paymentIntent.monto_esperado);
      wompi = {
        reference: order.paymentIntent.reference,
        amountInCents,
        currency: MONEDA_WOMPI,
        signature: firmarIntegridadWompi(order.paymentIntent.reference, amountInCents, MONEDA_WOMPI, secretoIntegridad),
        publicKey: llavePublica,
        aceptaciones,
      };
    }
  }

  // Campana del operador: entró una orden que nadie tecleó. Post-commit y
  // fire-and-forget — `runEventAutomations` nunca lanza, así que un aviso roto no
  // puede tumbar una venta ya cobrada al cliente.
  //
  // `origen: 'storefront'` lo declara ESTE endpoint, no el cuerpo de la petición:
  // es el code path lo que distingue una orden de la tienda de una manual, porque
  // `Order.canal` ('directo' aquí) también lo puede elegir el admin.
  //
  // Ojo, no confundir con "Notificación Nueva Orden": esa es WhatsApp al CLIENTE
  // y dispara en orden → `pagado`. El correo de orden creada ya sale desde
  // createOrderWithCustomer (notifyOrderCreated).
  await runEventAutomations({ tipo: 'order.creada', orderId: order.id, origen: 'storefront' });

  // Return the authoritative persisted figures so the confirmation screen can
  // render entirely from the server response (not from cleared cart state).
  return NextResponse.json(
    {
      numero_orden: order.numero_orden,
      estado:       order.estado,
      subtotal:     orderSubtotal,
      costo_envio,
      total,
      metodo_envio: metodoEnvio,
      franja:       slot?.id ?? null,
      direccion_detalle: shipping.direccion_detalle ?? null,
      items: lines.map((l) => ({
        producto_nombre: l.producto_nombre,
        moliendaSeleccionada: l.moliendaSeleccionada,
        cantidad:        l.cantidad,
        precio_unitario: l.precio_unitario,
        subtotal:        l.subtotal,
      })),
      // Ausente cuando no se creó ningún intento, O cuando las dos aceptaciones no
      // llegaron completas (§ API-DIRECTA-ACEPTACIONES-SERVIDOR-1, arriba) — en los
      // dos casos, spread de `{}`, ninguna clave nueva, ningún `null` de relleno.
      ...(wompi ? { wompi } : {}),
    },
    { status: 201 },
  );
}
