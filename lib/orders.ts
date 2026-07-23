import prisma from '@/lib/prisma';
import { Prisma } from '@/src/generated/prisma/client';
import { ensureShippingForPaidOrder } from '@/lib/fulfillment';
import { toWhatsappNumber } from '@/lib/whatsapp-link';

// Fields any caller may change on an order. `?? undefined` semantics (a null/
// absent value is left untouched) match the original PATCH handler.
export interface OrderTransitionData {
  estado?: string | null;
  metodo_pago?: string | null;
  notas_internas?: string | null;
  notas_entrega?: string | null;
  direccion_entrega?: string | null;
}

// THE single write path for Order.estado. Updates the order and runs the
// state-driven fulfillment side effects — auto-create the Shipping in
// `preparando` on `pagado`, void it on `cancelado` — inside the SAME transaction
// the caller supplies. Every flow that moves an order (the status dropdown, the
// order-edit modal, and payment registration) funnels through here, so a paid
// order can never be left without its Shipping and the logic lives in one place.
// Returns the order WITH items + shipping so callers can reflect it immediately.
export async function transitionOrder(
  tx: Prisma.TransactionClient,
  id: string,
  data: OrderTransitionData,
) {
  const updated = await tx.order.update({
    where: { id },
    data: {
      estado:            data.estado            ?? undefined,
      metodo_pago:       data.metodo_pago       ?? undefined,
      notas_internas:    data.notas_internas    ?? undefined,
      notas_entrega:     data.notas_entrega     ?? undefined,
      direccion_entrega: data.direccion_entrega ?? undefined,
      updatedAt:         new Date(),
    },
  });

  if (updated.estado === 'pagado') {
    await ensureShippingForPaidOrder(tx, updated);
  } else if (updated.estado === 'cancelado') {
    // Cancelling voids the delivery as a STATE TRANSITION (never a delete) — an
    // auditable trail. updateMany is a no-op when there's no shipping yet.
    await tx.shipping.updateMany({
      where: { orden_id: id },
      data:  { estado: 'cancelado', updatedAt: new Date() },
    });
  }

  return tx.order.findUnique({
    where:   { id },
    include: { items: true, shipping: true },
  });
}

// ─── Order creation (customer-associating) ───────────────────────────────────

// Canonical stored phone: E.164 Colombia ("+57" + 10-digit mobile) — the SAME
// format the checkout's `telefonoColombiaField` enforces, so phone-based customer
// matching lines up with web-created customers. Reuses the existing normalizer
// `toWhatsappNumber` ("573…") and prepends "+". Returns null for anything that is
// not a Colombian mobile. Phone matching is worthless without ONE consistent
// format, so every stored phone (Customer AND order snapshot) goes through here.
export function normalizeCustomerPhone(phone: string | null | undefined): string | null {
  const digits = toWhatsappNumber(phone); // "573XXXXXXXXX" | null
  return digits ? `+${digits}` : null;
}

// Neither an email nor a usable phone was supplied. Routes map this to a 400.
// Checkout never hits it (email is Zod-required upstream); the admin path can.
export class OrderCustomerIdentityError extends Error {
  constructor() {
    super('Se requiere al menos un correo o un teléfono (celular colombiano) del cliente');
    this.name = 'OrderCustomerIdentityError';
  }
}

export interface CreateOrderInput {
  customer: { nombre: string; email?: string | null; telefono?: string | null };
  canal: string;
  estado?: string | null;
  metodo_pago?: string | null;
  total: number;
  costo_envio?: number;
  direccion_entrega?: string | null;
  direccion_detalle?: string | null;
  ciudad_entrega?: string | null;
  notas_internas?: string | null;
  notas_entrega?: string | null;
  deliverySlot?: string | null;
  items: Array<{
    producto_id?: string | null;
    producto_nombre: string;
    moliendaSeleccionada?: string | null;
    cantidad: number;
    precio_unitario?: number | null;
    subtotal: number;
  }>;
  // Optional client-generated idempotency key (uuid). If a request with the same
  // key already created an order, that order is returned instead of creating a
  // new one — a double submit or network retry can never duplicate.
  idempotencyKey?: string | null;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

// THE single order-creation path. Both the storefront checkout and the admin
// "Nueva Orden" funnel through here, so EVERY order upserts/associates a Customer
// (the bug was that the admin path created the Order without touching Customer).
//
// Customer identity is flexible — matching rules, IN THIS ORDER:
//   a) email present → upsert by email (unique); refresh the phone if provided.
//   b) only phone    → match by normalized phone (findFirst — `telefono` is not a
//                      unique column, so upsert-by-phone isn't available), else
//                      create.
// The phone is ALWAYS stored normalized (+57…), on BOTH the Customer and the
// order snapshot, so the phone match works.
//
// KNOWN LIMITATION (deliberately unresolved): a customer who bought on the web
// with an email and later by WhatsApp with only a phone is created TWICE. Merging
// customers is a future feature; these rules only minimize the split.
//
// Legitimate checkout↔admin differences are PARAMETERS, not duplicated logic: the
// order-number prefix (CN/SN), the channel, whether an address/estado is supplied,
// and per-line price/molienda. A `pagado` order (the admin can create one
// directly) auto-creates its Shipping via the same hook the status path uses.
export async function createOrderWithCustomer(input: CreateOrderInput) {
  const email = input.customer.email?.trim() || null;
  const telefono = normalizeCustomerPhone(input.customer.telefono);

  // Server-side identity guard (defense in depth — the routes validate too).
  if (!email && !telefono) throw new OrderCustomerIdentityError();

  const nombre = input.customer.nombre.trim();
  const idem = input.idempotencyKey?.trim() || null;

  // Idempotency fast path: if this key already produced an order, return it — a
  // double-clicked or retried submit never creates a second order.
  if (idem) {
    const existing = await prisma.order.findUnique({
      where:   { idempotencyKey: idem },
      include: { items: true, shipping: true },
    });
    if (existing) return existing;
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    // Every real order (checkout AND admin) uses the CN- series. SN- is legacy
    // demo data only.
    const numero_orden = `CN-${Math.floor(100_000 + Math.random() * 900_000)}`;
    try {
      const created = await prisma.$transaction(async (tx) => {
        // ── Customer identity (rules a/b above) ──
        if (email) {
          await tx.customer.upsert({
            where:  { email },
            update: telefono ? { telefono } : {},
            create: {
              nombre, email, telefono,
              ciudad:    input.ciudad_entrega ?? null,
              direccion: input.direccion_entrega ?? null,
              canal:     input.canal,
            },
          });
        } else {
          // email is null here, so the guard guarantees telefono is non-null.
          const existing = await tx.customer.findFirst({ where: { telefono: telefono! } });
          if (!existing) {
            await tx.customer.create({
              data: {
                nombre, telefono,
                ciudad:    input.ciudad_entrega ?? null,
                direccion: input.direccion_entrega ?? null,
                canal:     input.canal,
              },
            });
          }
        }

        // ── Order + items ──
        const order = await tx.order.create({
          data: {
            numero_orden,
            idempotencyKey:    idem,
            cliente_nombre:    nombre,
            cliente_email:     email,
            cliente_telefono:  telefono,
            canal:             input.canal,
            estado:            input.estado ?? undefined, // undefined → schema default 'pendiente'
            metodo_pago:       input.metodo_pago ?? null,
            total:             input.total,
            costo_envio:       input.costo_envio ?? 0,
            direccion_entrega: input.direccion_entrega ?? null,
            direccion_detalle: input.direccion_detalle ?? null,
            ciudad_entrega:    input.ciudad_entrega ?? null,
            notas_internas:    input.notas_internas ?? null,
            notas_entrega:     input.notas_entrega ?? null,
            deliverySlot:      input.deliverySlot ?? null,
            items: {
              create: input.items.map((l) => ({
                producto_id:          l.producto_id ?? null,
                producto_nombre:      l.producto_nombre,
                moliendaSeleccionada: l.moliendaSeleccionada ?? null,
                cantidad:             l.cantidad,
                precio_unitario:      l.precio_unitario ?? null,
                subtotal:             l.subtotal,
              })),
            },
          },
        });

        if (order.estado === 'pagado') {
          await ensureShippingForPaidOrder(tx, order);
        }

        return tx.order.findUnique({
          where:   { id: order.id },
          include: { items: true, shipping: true },
        });
      });

      return created;
    } catch (error) {
      if (isUniqueViolation(error)) {
        // Concurrent duplicate on the idempotency key → return the order the
        // winning request created (dedup without parsing which constraint hit).
        if (idem) {
          const existing = await prisma.order.findUnique({
            where:   { idempotencyKey: idem },
            include: { items: true, shipping: true },
          });
          if (existing) return existing;
        }
        // Otherwise it was an order-number collision → retry with a new number.
        if (attempt < 4) continue;
      }
      throw error;
    }
  }

  throw new Error('No se pudo generar un número de orden único');
}

// ─── Order line resolution (server-side pricing) ─────────────────────────────

// Shape of Product.moliendasOpciones (Json in Prisma).
interface MoliendaOpcion { nombre: string; metodo: string; disponible: boolean; }

export interface RawOrderLine {
  slug: string;
  cantidad: number;
  molienda?: string | null;
}

export interface ResolvedOrderLine {
  producto_id: string;
  producto_nombre: string;
  moliendaSeleccionada: string | null;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

// Raised when submitted lines fail resolution (missing product, insufficient
// stock, or an unavailable molienda). Routes map it to a 400.
export class OrderLinesError extends Error {
  productosSinStock?: string[];
  constructor(message: string, productosSinStock?: string[]) {
    super(message);
    this.name = 'OrderLinesError';
    this.productosSinStock = productosSinStock;
  }
}

// THE single line resolver: prices raw {slug, cantidad, molienda} lines from real
// Product records — server-side price recompute + stock validation + molienda
// availability. Both the storefront checkout and the admin manual order run
// through here, so a manually created order has the SAME structure and rules as a
// web order (the admin never types the total). Stock is validated, NOT
// decremented — same policy as checkout (stock changes only via
// /api/inventory/adjust). Throws OrderLinesError (→ 400) on any violation.
export async function resolveOrderLines(
  items: RawOrderLine[],
): Promise<{ lines: ResolvedOrderLine[]; subtotal: number }> {
  const slugs = [...new Set(items.map((i) => i.slug))];
  const products = await prisma.product.findMany({ where: { slug: { in: slugs } } });
  const bySlug = new Map(products.map((p) => [p.slug, p]));

  // Reject the whole order if any slug no longer resolves.
  if (items.some((i) => !bySlug.has(i.slug))) {
    throw new OrderLinesError('Uno o más productos ya no están disponibles');
  }

  // Stock: sum quantities per product (lines may share a slug) vs current stock.
  const cantidadPorSlug = new Map<string, number>();
  for (const item of items) {
    cantidadPorSlug.set(item.slug, (cantidadPorSlug.get(item.slug) ?? 0) + item.cantidad);
  }
  const productosSinStock = [...cantidadPorSlug.entries()]
    .filter(([slug, cantidad]) => cantidad > bySlug.get(slug)!.stock)
    .map(([slug]) => bySlug.get(slug)!.id);
  if (productosSinStock.length > 0) {
    throw new OrderLinesError('Cantidad no disponible', productosSinStock);
  }

  // Molienda: if the product defines options, the chosen one must exist and be
  // `disponible` (same source — Product.moliendasOpciones — as the storefront).
  for (const item of items) {
    const product = bySlug.get(item.slug)!;
    const opciones = (product.moliendasOpciones ?? []) as unknown as MoliendaOpcion[];
    if (!Array.isArray(opciones) || opciones.length === 0) continue;
    const opcion = opciones.find((o) => o?.nombre === item.molienda);
    if (!item.molienda || !opcion || !opcion.disponible) {
      throw new OrderLinesError(`Molienda no disponible para ${product.nombre}`);
    }
  }

  const lines: ResolvedOrderLine[] = items.map((item) => {
    const product = bySlug.get(item.slug)!;
    const precio_unitario = product.precio;
    return {
      producto_id:          product.id,
      producto_nombre:      product.nombre,
      moliendaSeleccionada: item.molienda ?? null,
      cantidad:             item.cantidad,
      precio_unitario,
      subtotal:             precio_unitario * item.cantidad,
    };
  });
  const subtotal = lines.reduce((sum, l) => sum + l.subtotal, 0);
  return { lines, subtotal };
}
