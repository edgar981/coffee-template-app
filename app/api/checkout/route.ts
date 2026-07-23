import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { fireOrderTrigger } from '@/lib/automations/triggers';
import { createOrderWithCustomer } from '@/lib/orders';
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

// Forma de las opciones de molienda guardadas en Product.moliendasOpciones.
interface MoliendaOpcion {
  nombre: string;
  metodo: string;
  disponible: boolean;
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

  // Validación de stock contra la lectura fresca de DB (`products` de arriba),
  // NUNCA contra el payload. Varias líneas pueden compartir slug (misma bolsa,
  // distinta molienda), así que sumamos la cantidad pedida por producto y la
  // comparamos con el stock actual. Rechazo total (no ajustamos cantidades):
  // el cliente decide qué hacer con su carrito. Respondemos con los IDs
  // afectados y un mensaje genérico — sin revelar el número disponible.
  //
  // NOTA: hoy el checkout NO decrementa stock (solo el admin lo ajusta vía
  // /api/inventory/adjust), por lo que esta verificación no puede ir "dentro"
  // de un decremento transaccional que no existe. Queda una ventana de carrera
  // con compras simultáneas: dos pedidos podrían pasar esta validación sobre el
  // mismo stock. Cerrarla requiere decremento transaccional de stock, cambio
  // mayor fuera del alcance de esta tarea.
  const cantidadPorSlug = new Map<string, number>();
  for (const item of items) {
    cantidadPorSlug.set(item.slug, (cantidadPorSlug.get(item.slug) ?? 0) + item.cantidad);
  }
  const productosSinStock = [...cantidadPorSlug.entries()]
    .filter(([slug, cantidad]) => cantidad > bySlug.get(slug)!.stock)
    .map(([slug]) => bySlug.get(slug)!.id);

  if (productosSinStock.length > 0) {
    return NextResponse.json(
      { error: 'Cantidad no disponible', productosSinStock },
      { status: 400 },
    );
  }

  // La molienda enviada debe ser una opción marcada como `disponible` en el
  // producto — ocultar chips en la UI es UX, esto es la regla de negocio. Si el
  // producto define opciones y el cliente no envía molienda, también se rechaza.
  for (const item of items) {
    const product = bySlug.get(item.slug)!;
    const opciones = (product.moliendasOpciones ?? []) as unknown as MoliendaOpcion[];
    if (!Array.isArray(opciones) || opciones.length === 0) continue;
    const opcion = opciones.find((o) => o?.nombre === item.molienda);
    if (!item.molienda || !opcion || !opcion.disponible) {
      return NextResponse.json(
        { error: `Molienda no disponible para ${product.nombre}` },
        { status: 400 },
      );
    }
  }

  // Recompute unit price, line subtotal, order subtotal, shipping and total.
  const lines = items.map((item) => {
    const product = bySlug.get(item.slug)!;
    const precio_unitario = product.precio;
    const subtotal = precio_unitario * item.cantidad;
    return {
      producto_id:     product.id,
      producto_nombre: product.nombre,
      // Snapshot de la molienda elegida (validada arriba).
      moliendaSeleccionada: item.molienda ?? null,
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
      numeroPrefix:      'CN',
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
