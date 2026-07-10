import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { fireOrderTrigger } from '@/lib/automations/triggers';
import { getShippingSlot, computeShippingCost } from '@/lib/shipping-config';
import { COLOMBIA_DEPARTMENTS, isBogotaDC } from '@/lib/colombia-departments';

// Guest checkout is intentionally unauthenticated — no Better Auth session.
// The client is trusted ONLY for product slugs, quantities and customer /
// shipping details. Every price, the shipping cost, the order total, the order
// number and the order status are computed server-side from Product records.

const checkoutSchema = z.object({
  customer: z.object({
    nombre:   z.string().trim().min(1),
    apellido: z.string().trim().default(''),
    email:    z.string().trim().email(),
    // Normalized WhatsApp-ready format from the client: +57 + 10-digit mobile.
    telefono: z.string().trim().regex(/^\+573\d{9}$/, 'Teléfono inválido'),
  }),
  shipping: z.object({
    direccion:         z.string().trim().min(1),
    direccion_detalle: z.string().trim().max(500).nullish(),
    ciudad:            z.string().trim().min(1),
    departamento:      z.string().trim().min(1),
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
      }),
    )
    .min(1),
});

function generateOrderNumber(): string {
  return `CN-${Math.floor(100_000 + Math.random() * 900_000)}`;
}

// Prisma unique-constraint violation
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

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

  // Departamento is the single source of truth for Bogotá detection — validated
  // against the canonical list, never free-text ciudad and never a client method.
  if (!COLOMBIA_DEPARTMENTS.includes(shipping.departamento)) {
    return NextResponse.json({ error: 'Departamento inválido' }, { status: 400 });
  }

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

  // Resolve every line against real Product records, keyed by slug.
  const slugs = [...new Set(items.map((i) => i.slug))];
  const products = await prisma.product.findMany({ where: { slug: { in: slugs } } });
  const bySlug = new Map(products.map((p) => [p.slug, p]));

  // Reject the whole cart if any slug no longer resolves (product renamed or
  // deleted between add-to-cart and checkout) — never charge a partial cart.
  const missing = items.filter((i) => !bySlug.has(i.slug));
  if (missing.length > 0) {
    return NextResponse.json(
      { error: 'Uno o más productos ya no están disponibles' },
      { status: 400 },
    );
  }

  // Recompute unit price, line subtotal, order subtotal, shipping and total.
  const lines = items.map((item) => {
    const product = bySlug.get(item.slug)!;
    const precio_unitario = product.precio;
    const subtotal = precio_unitario * item.cantidad;
    return {
      producto_id:     product.id,
      producto_nombre: product.nombre,
      cantidad:        item.cantidad,
      precio_unitario,
      subtotal,
    };
  });

  const orderSubtotal = lines.reduce((sum, l) => sum + l.subtotal, 0);
  // Never trust the client: recompute from the server-derived method, applying
  // the shared free-shipping threshold.
  const costo_envio = computeShippingCost(metodoEnvio, orderSubtotal);
  const total = orderSubtotal + costo_envio;

  const cliente_nombre = `${customer.nombre} ${customer.apellido}`.trim();

  // Create Customer + Order + OrderItems + Payment atomically. The order number
  // is generated server-side; retry on the (rare) unique collision.
  let order:
    | { id: string; numero_orden: string; estado: string; cliente_nombre: string | null; cliente_telefono: string | null; total: number }
    | null = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const numero_orden = generateOrderNumber();
    try {
      order = await prisma.$transaction(async (tx) => {
        // Upsert the customer by email only; refresh the phone if it changed.
        await tx.customer.upsert({
          where:  { email: customer.email },
          update: { telefono: customer.telefono },
          create: {
            nombre:    cliente_nombre,
            email:     customer.email,
            telefono:  customer.telefono,
            ciudad:    shipping.ciudad,
            direccion: shipping.direccion,
            canal:     'directo',
          },
        });

        const created = await tx.order.create({
          data: {
            numero_orden,
            cliente_nombre,
            cliente_email:     customer.email,
            cliente_telefono:  customer.telefono,
            canal:             'directo',
            // estado left to the schema default ("pendiente").
            metodo_pago:       payment.metodo,
            total,
            costo_envio,
            direccion_entrega: shipping.direccion,
            direccion_detalle: shipping.direccion_detalle ?? null,
            ciudad_entrega:    shipping.ciudad,
            // Persist the slot id ("am"/"pm"); the label is resolved at render.
            deliverySlot:      slot?.id ?? null,
            items: { create: lines },
          },
        });

        // Pending payment linked to this order via the FK relation.
        await tx.payment.create({
          data: {
            order:          { connect: { id: created.id } },
            cliente_nombre,
            monto:          total,
            metodo:         payment.metodo,
            estado:         'pendiente',
            referencia:     payment.referencia ?? null,
          },
        });

        return created;
      });
      break;
    } catch (error) {
      if (isUniqueViolation(error) && attempt < 4) continue;
      console.error('Checkout order creation failed:', error);
      return NextResponse.json({ error: 'No se pudo procesar la orden' }, { status: 500 });
    }
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
        cantidad:        l.cantidad,
        precio_unitario: l.precio_unitario,
        subtotal:        l.subtotal,
      })),
    },
    { status: 201 },
  );
}
