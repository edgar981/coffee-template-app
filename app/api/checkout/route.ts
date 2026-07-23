import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fireOrderTrigger } from '@/lib/automations/triggers';
import { createOrderWithCustomer, resolveOrderLines, OrderLinesError } from '@/lib/orders';
import { getShippingSlot, computeShippingCost } from '@/lib/shipping-config';
import { isBogotaDC } from '@/lib/colombia-departments';
import {
  direccionField, direccionDetalleField, ciudadField, departamentoField, telefonoColombiaField,
} from '@/lib/validation/address';

// Guest checkout is intentionally unauthenticated — no Better Auth session.
// The client is trusted ONLY for product slugs, quantities and customer /
// shipping details. Every price, the shipping cost, the order total, the order
// number and the order status are computed server-side from Product records.

const checkoutSchema = z.object({
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
  payment: z.object({
    metodo:     z.enum(['nequi', 'daviplata', 'transferencia', 'efectivo']),
    referencia: z.string().trim().min(1).optional(),
  }),
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

  // Departamento is the single source of truth for Bogotá detection. It's
  // validated against the canonical list by `departamentoField` in the schema
  // above (shared with the admin add-address flow).

  // Derive the shipping tier from departamento. The client cannot select this.
  const metodoEnvio: 'bogota' | 'nacional' =
    isBogotaDC(shipping.departamento) ? 'bogota' : 'nacional';

  // Business rule: "Contra entrega" (efectivo) is only valid for Bogotá D.C.
  // deliveries. Client-side hiding is UX; the server is the enforcement point.
  if (payment.metodo === 'efectivo' && metodoEnvio !== 'bogota') {
    return NextResponse.json(
      { error: 'El pago contra entrega solo está disponible para entregas en Bogotá D.C.' },
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
      metodo_pago:       payment.metodo,
      total,
      costo_envio,
      direccion_entrega: shipping.direccion,
      direccion_detalle: shipping.direccion_detalle ?? null,
      ciudad_entrega:    shipping.ciudad,
      deliverySlot:      slot?.id ?? null,
      items:             lines,
    });
  } catch (error) {
    console.error('Checkout order creation failed:', error);
    return NextResponse.json({ error: 'No se pudo procesar la orden' }, { status: 500 });
  }

  if (!order) {
    return NextResponse.json({ error: 'No se pudo procesar la orden' }, { status: 500 });
  }

  fireOrderTrigger('nueva_orden', order as never).catch(console.error);

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
    },
    { status: 201 },
  );
}
