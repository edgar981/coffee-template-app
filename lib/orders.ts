import prisma from '@/lib/prisma';
import { Prisma, MetodoPago, CondicionPago } from '@/src/generated/prisma/client';
import { ensureShipping, restockShippingStock } from '@/lib/fulfillment';
// THE phone normalizer lives in the pure phone module (lib/whatsapp-link); it is
// re-exported here so existing importers (`@/lib/orders`) keep working.
import { normalizeCustomerPhone } from '@/lib/whatsapp-link';
export { normalizeCustomerPhone };

// THE rule that turns a payment method into a payment CONDITION. `condicion_pago`
// is never asked in a form anymore — it is DERIVED here, in one place, so the day
// the rule evolves there is a single line to change. Used at creation (from the
// declared method, admin `metodoPagoPrevisto` or checkout `metodo_pago`) and at
// method edits before fulfillment starts. The dispatch-of-an-unpaid-order flip
// (markContraentregaAtDispatch) is a separate, action-driven mutation.
//
// EFECTIVO ("pago contra entrega") → CONTRAENTREGA: the order may be prepared and
// dispatched while `pendiente` and the money is collected on delivery. Any other
// method — or none declared ("Por definir") — → ANTICIPADO. Accepts the typed
// enum or the free checkout string (case-insensitive), so both creation callers
// funnel through it.
export function derivarCondicionPago(
  metodo: MetodoPago | string | null | undefined,
): CondicionPago {
  return String(metodo ?? '').trim().toUpperCase() === 'EFECTIVO'
    ? 'CONTRAENTREGA'
    : 'ANTICIPADO';
}

// The dispatch of an UNPAID order flips its condición to CONTRAENTREGA — the goods
// left before the money did, so it IS now cash-on-delivery. This is the LAST
// permitted mutation of condición (after it, a Payment or the dispatch itself
// locks it). It deliberately bypasses the edit-time lock in `transitionOrder`
// because it IS the dispatch action, run inside the dispatch transaction. Kept
// here so every write to `condicion_pago` lives in this file.
export async function markContraentregaAtDispatch(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  await tx.order.update({
    where: { id: orderId },
    data:  { condicion_pago: 'CONTRAENTREGA', updatedAt: new Date() },
  });
}

// Fields any caller may change on an order. `?? undefined` semantics (a null/
// absent value is left untouched) match the original PATCH handler.
export interface OrderTransitionData {
  estado?: string | null;
  metodo_pago?: string | null;
  notas_internas?: string | null;
  notas_entrega?: string | null;
  direccion_entrega?: string | null;
  // Método de pago previsto (intención declarada). Editarlo RE-DERIVA la
  // condición de pago (derivarCondicionPago) — la condición nunca se acepta
  // cruda del cliente. La re-derivación solo procede mientras la orden no tenga
  // Shipping ni Payment; después el ciclo de vida ya corrió bajo una condición y
  // cambiarla corrompe invariantes (bloqueo server-side abajo). `undefined` = no
  // se toca; `null` = "Por definir" (→ ANTICIPADO).
  metodoPagoPrevisto?: MetodoPago | null;
}

// La condición de pago está bloqueada por el ciclo de vida. Routes → 409.
export class CondicionPagoLockedError extends Error {
  constructor() {
    super('La condición de pago no puede cambiarse: la orden ya tiene un envío o un pago registrado');
    this.name = 'CondicionPagoLockedError';
  }
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
  // Editing the declared method RE-DERIVES the condición. It is IMMUTABLE once the
  // lifecycle ran under it: any Shipping or Payment locks a CHANGE of condición
  // (server-side guard — the UI never offers the change post-fulfillment).
  let derivedCondicion: CondicionPago | undefined;
  if (data.metodoPagoPrevisto !== undefined) {
    derivedCondicion = derivarCondicionPago(data.metodoPagoPrevisto);
    const current = await tx.order.findUniqueOrThrow({
      where:  { id },
      select: { condicion_pago: true, shipping: { select: { id: true } }, payments: { select: { id: true }, take: 1 } },
    });
    if (current.condicion_pago !== derivedCondicion && (current.shipping || current.payments.length > 0)) {
      throw new CondicionPagoLockedError();
    }
  }

  const updated = await tx.order.update({
    where: { id },
    data: {
      estado:             data.estado            ?? undefined,
      metodo_pago:        data.metodo_pago       ?? undefined,
      notas_internas:     data.notas_internas    ?? undefined,
      notas_entrega:      data.notas_entrega     ?? undefined,
      direccion_entrega:  data.direccion_entrega ?? undefined,
      // `undefined` when the method wasn't touched; when it was, write both the
      // method (null = "Por definir") and its derived condición together.
      metodoPagoPrevisto: data.metodoPagoPrevisto === undefined ? undefined : data.metodoPagoPrevisto,
      condicion_pago:     derivedCondicion ?? undefined,
      updatedAt:          new Date(),
    },
  });

  if (updated.estado === 'pagado') {
    await ensureShipping(tx, updated);
  } else if (updated.estado === 'cancelado') {
    // Cancelling voids the delivery as a STATE TRANSITION (never a delete) — an
    // auditable trail. If the goods had already left (dispatched → stock was
    // decremented), they come back: restock in the SAME transaction, exactly
    // once (marker-guarded). No-op when there's no shipping yet.
    const shipping = await tx.shipping.findUnique({
      where:  { orden_id: id },
      select: { id: true, orden_id: true, estado: true, stock_descontado_at: true },
    });
    if (shipping && shipping.estado !== 'cancelado') {
      await restockShippingStock(tx, shipping, 'Orden cancelada');
      await tx.shipping.update({
        where: { id: shipping.id },
        data:  { estado: 'cancelado', updatedAt: new Date() },
      });
    }
  }

  return tx.order.findUnique({
    where:   { id },
    include: { items: true, shipping: true },
  });
}

// ─── Payment registration (the single money-in write path) ───────────────────

export interface RegisterPaymentTxInput {
  // Snapshot of the amount, taken by the CALLER from the order total (never a
  // client-sent value). Kept as a param so this helper stays agnostic of where
  // the order came from.
  monto: number;
  metodo: MetodoPago;
  referencia?: string | null;
  notas?: string | null;
  registrado_por?: string | null;
  registrado_por_nombre?: string | null;
}

// THE single "registrar pago" write, inside a caller-supplied transaction:
// create the Payment row and move the order to `pagado` via `transitionOrder`
// (which owns the idempotent Shipping auto-create). Both entry points funnel
// through here so "money in" is defined in exactly one place:
//   • POST /api/orders/[id]/payments — pay an EXISTING pendiente order, and
//   • createOrderWithCustomer({ immediatePayment }) — "el pago ya fue recibido"
//     al crear la orden manual.
// Returns the Payment and the refreshed order (with items + shipping).
export async function registerOrderPaymentTx(
  tx: Prisma.TransactionClient,
  orderId: string,
  input: RegisterPaymentTxInput,
) {
  const payment = await tx.payment.create({
    data: {
      orden_id:              orderId,
      monto:                 input.monto,          // snapshot, server-side
      metodo:                input.metodo,
      referencia:            input.referencia?.trim() ? input.referencia.trim() : null,
      notas:                 input.notas?.trim() ? input.notas.trim() : null,
      registrado_por:        input.registrado_por ?? null,
      registrado_por_nombre: input.registrado_por_nombre ?? null,
    },
  });

  // Moves order → pagado AND auto-creates the Shipping in `preparando` (no-op if
  // one already exists — e.g. it was scheduled first under ALLOW_UNPAID).
  const order = await transitionOrder(tx, orderId, { estado: 'pagado' });

  return { payment, order };
}

// ─── Order creation (customer-associating) ───────────────────────────────────

// Neither an email nor a usable phone was supplied. Routes map this to a 400.
// Checkout never hits it (email is Zod-required upstream); the admin path can.
export class OrderCustomerIdentityError extends Error {
  constructor() {
    super('Se requiere al menos un correo o un teléfono (celular colombiano) del cliente');
    this.name = 'OrderCustomerIdentityError';
  }
}

// An explicit `cliente_id` was passed but no such customer exists. Routes → 400,
// so a stale/malicious id never creates an order with a broken relation.
export class OrderCustomerNotFoundError extends Error {
  constructor() {
    super('El cliente seleccionado no existe');
    this.name = 'OrderCustomerNotFoundError';
  }
}

export interface CreateOrderInput {
  customer: { nombre: string; email?: string | null; telefono?: string | null };
  // EXPLICIT customer chosen in the admin modal ("Usar este cliente" from the
  // duplicate banner). When set, the order is ATTACHED to that customer — no
  // upsert, no email/phone matching. Validated to exist first; the snapshot
  // fields still come from the form. Checkout never sends it (can't ask).
  cliente_id?: string | null;
  canal: string;
  estado?: string | null;
  metodo_pago?: string | null;
  // Método por el que el cliente DIJO que va a pagar (intención declarada). NO
  // crea Payment, NO cambia Order.estado, NO es el registro del dinero — sólo un
  // dato de la orden. La orden sigue naciendo `pendiente`. Checkout lo deja null.
  metodoPagoPrevisto?: MetodoPago | null;
  // NOTA: `condicion_pago` NO es un input. Se DERIVA server-side del método
  // declarado (derivarCondicionPago) — admin `metodoPagoPrevisto` o checkout
  // `metodo_pago`. Un valor enviado por el cliente se ignora por diseño.
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
  // "El pago ya fue recibido" al crear la orden manual. Cuando está presente, la
  // orden nace `pendiente` y ACTO SEGUIDO, en la MISMA transacción, se registra
  // el pago por el mismo camino que "Registrar pago" (Payment + estado→pagado +
  // Shipping). `monto` se snapshotea del total server-side, no se pasa aquí.
  immediatePayment?: {
    metodo: MetodoPago;
    referencia?: string | null;
    notas?: string | null;
    registrado_por?: string | null;
    registrado_por_nombre?: string | null;
  } | null;
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
  const clienteIdOverride = input.cliente_id?.trim() || null;
  const email = input.customer.email?.trim() || null;
  const telefono = normalizeCustomerPhone(input.customer.telefono);

  // Server-side identity guard (defense in depth — the routes validate too). An
  // explicit customer satisfies identity on its own.
  if (!clienteIdOverride && !email && !telefono) throw new OrderCustomerIdentityError();

  // Validate the explicit customer up front (outside the create/retry loop): a
  // stale or forged id is rejected before any order is written.
  if (clienteIdOverride) {
    const chosen = await prisma.customer.findUnique({ where: { id: clienteIdOverride }, select: { id: true } });
    if (!chosen) throw new OrderCustomerNotFoundError();
  }

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
        // The resolved id is captured into `cliente_id` on the order below. This
        // upsert already KNOWS which customer it is, so recording it here is
        // exact — every later "orders of this customer" read stops depending on
        // matching snapshot values that the customer may since have edited.
        let clienteId: string;
        if (clienteIdOverride) {
          // Attach to the operator's chosen customer — no upsert, no matching.
          clienteId = clienteIdOverride;
        } else if (email) {
          const customer = await tx.customer.upsert({
            where:  { email },
            update: telefono ? { telefono } : {},
            create: {
              nombre, email, telefono,
              ciudad:    input.ciudad_entrega ?? null,
              direccion: input.direccion_entrega ?? null,
              canal:     input.canal,
            },
          });
          clienteId = customer.id;
        } else {
          // email is null here, so the guard guarantees telefono is non-null.
          const existing = await tx.customer.findFirst({ where: { telefono: telefono! } });
          if (existing) {
            clienteId = existing.id;
          } else {
            const created = await tx.customer.create({
              data: {
                nombre, telefono,
                ciudad:    input.ciudad_entrega ?? null,
                direccion: input.direccion_entrega ?? null,
                canal:     input.canal,
              },
            });
            clienteId = created.id;
          }
        }

        // ── Order + items ──
        const order = await tx.order.create({
          data: {
            numero_orden,
            idempotencyKey:    idem,
            cliente_id:        clienteId,
            cliente_nombre:    nombre,
            cliente_email:     email,
            cliente_telefono:  telefono,
            canal:             input.canal,
            estado:            input.estado ?? undefined, // undefined → schema default 'pendiente'
            metodo_pago:       input.metodo_pago ?? null,
            metodoPagoPrevisto: input.metodoPagoPrevisto ?? null,
            // DERIVED, never taken from the client: admin declares
            // `metodoPagoPrevisto`, checkout declares `metodo_pago` — either drives
            // the condición through the single rule (EFECTIVO → CONTRAENTREGA).
            condicion_pago:    derivarCondicionPago(input.metodoPagoPrevisto ?? input.metodo_pago),
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

        // "El pago ya fue recibido": born `pendiente` above, then paid RIGHT NOW
        // through the shared money-in path (Payment + estado→pagado + Shipping) —
        // same code as "Registrar pago", one transaction, so the ledger and the
        // order can never disagree. Otherwise a directly-`pagado` order (rare;
        // callers today never set estado) still gets its Shipping ensured.
        if (input.immediatePayment) {
          await registerOrderPaymentTx(tx, order.id, {
            monto:                 order.total,
            metodo:                input.immediatePayment.metodo,
            referencia:            input.immediatePayment.referencia ?? null,
            notas:                 input.immediatePayment.notas ?? null,
            registrado_por:        input.immediatePayment.registrado_por ?? null,
            registrado_por_nombre: input.immediatePayment.registrado_por_nombre ?? null,
          });
        } else if (order.estado === 'pagado') {
          await ensureShipping(tx, order);
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
// decremented — the decrement happens AT DISPATCH (see dispatchStockDecrement
// in lib/fulfillment.ts); manual changes stay in /api/inventory/adjust.
// Throws OrderLinesError (→ 400) on any violation.
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
