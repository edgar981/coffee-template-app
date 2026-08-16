import { Prisma } from '@duna/core';
import { cruzoMinimo } from '@duna/core/metrics/inventory-filters';
import { appendOrderStatusTransition, type TransitionActor } from '@duna/core/order-transitions';

interface OrderShippingSnapshot {
  id: string;
  costo_envio: number;
}

// The whole "can this order get its delivery PREPARED now?" decision, as ONE pure
// function so the route is a thin HTTP translator and it stays unit-testable.
//
// Preparing a Shipping is HARMLESS — no stock moves, no estado changes; it just
// creates the `preparando` record. So it is no longer gated by payment: ANY
// non-cancelled order may be prepared (the condición is derived, not chosen, and
// the real safety gate lives at DISPATCH — an unpaid dispatch requires explicit
// confirmation, see the shippings PATCH route). Order matters: a cancelled order
// is rejected even if a (voided) Shipping exists; an existing Shipping is returned
// as-is (idempotent, never a second one, never a state reset).
export type SchedulingDecision =
  | { action: 'reject'; status: number; error: string }
  | { action: 'return_existing' }
  | { action: 'create' };

export function decideShippingSchedulable(
  estado: string,
  hasShipping: boolean,
): SchedulingDecision {
  // Cancelled orders are terminal — never schedulable.
  if (estado === 'cancelado') {
    return { action: 'reject', status: 409, error: 'No se puede programar la entrega de una orden cancelada' };
  }
  // Already has a delivery → hand it back unchanged; never a second one.
  if (hasShipping) {
    return { action: 'return_existing' };
  }
  return { action: 'create' };
}

// Ensure the order has a fulfillment Shipping in `preparando`. This is the ONLY
// path that creates a Shipping.
//
// It is deliberately POLICY-AGNOSTIC: it just makes the Shipping exist. WHO may
// trigger it is decided by the caller —
//   • confirming a payment (transitionOrder → `pagado`) always ensures it, and
//   • scheduling an unpaid order under `ALLOW_UNPAID` ensures it via the guarded
//     POST /api/shippings route.
// Keeping the guard out of here is what makes the paid-after-scheduled case
// idempotent (see below): payment confirmation calls this again and it no-ops.
//
// The delivery address is NOT copied here — it lives only on the Order and is
// read through the relation, so an added/edited address is always reflected.
// Only `costo_envio` is snapshotted (a stable figure at creation time).
//
// State-based and idempotent: the unique orden_id + upsert means calling it
// repeatedly (or for an order that already has a shipping) is a no-op — an
// existing shipping the operator already scheduled is never clobbered nor its
// estado reset. Takes a Prisma transaction client so it runs in the SAME
// transaction as the status write. Zona and courier start empty. An order with
// no address is allowed here (it simply has none); scheduling it is blocked by
// the PATCH guard.
export async function ensureShipping(
  tx: Prisma.TransactionClient,
  order: OrderShippingSnapshot,
  actor?: TransitionActor,
): Promise<void> {
  // ¿Existía ya? El upsert no lo dice, y el asiento sólo va en la CREACIÓN real.
  const existente = await tx.shipping.findUnique({
    where:  { orden_id: order.id },
    select: { id: true },
  });
  await tx.shipping.upsert({
    where:  { orden_id: order.id },
    update: {},
    create: {
      orden_id:    order.id,
      costo_envio: order.costo_envio,
      estado:      'preparando',
    },
  });
  // Asiento del eje FULFILLMENT sólo si el envío SE CREÓ (no en el no-op del
  // upsert): nace sin estado previo → estado_anterior null.
  if (!existente) {
    await appendOrderStatusTransition(tx, {
      ordenId: order.id, eje: 'fulfillment',
      estadoAnterior: null, estadoNuevo: 'preparando', actor,
    });
  }
}

// ─── Stock at dispatch (single, atomic, idempotent) ──────────────────────────
// Stock leaves the shelf when the goods leave the building: the decrement runs
// AT DISPATCH (preparando → en_ruta), for ALL orders (prepaid and contraentrega
// alike). Checkout/resolveOrderLines keep VALIDATING stock without decrementing;
// the manual /api/inventory/adjust flow is untouched. The restock twin runs when
// a dispatched delivery comes back (fallido, or cancelado after dispatch).
// `Shipping.stock_descontado_at` is the idempotency marker for the pair: the
// decrement only runs while it is null; the restock only while it is set — so
// status flapping or retries can never double-decrement nor double-restock.

// Dispatch blocked: at least one product no longer has enough stock. Routes map
// it to a 409 naming the products.
export class DispatchStockError extends Error {
  productos: string[];
  constructor(productos: string[]) {
    super(
      productos.length === 1
        ? `Stock insuficiente para despachar: ${productos[0]}`
        : `Stock insuficiente para despachar: ${productos.join(', ')}`,
    );
    this.name = 'DispatchStockError';
    this.productos = productos;
  }
}

interface ShippingStockRef {
  id: string;
  orden_id: string;
  stock_descontado_at: Date | null;
}

// THE dispatch decrement. Inside the caller's transaction: one conditional
// atomic decrement per order line (`stock >= qty` floor via updateMany); if ANY
// line fails, the thrown error rolls back EVERYTHING already decremented — no
// partial decrements. Logs each movement to InventoryLog (tipo 'venta') and
// stamps `stock_descontado_at` in the same transaction. No-op if already
// stamped. Lines without a linked product (legacy demo lines) are skipped —
// there is no stock row to decrement.
//
// DEVUELVE los productos que CRUZARON su stock mínimo con este decremento (antes
// no estaban bajos, ahora sí). El cruce sólo puede detectarse aquí, porque sólo
// aquí se conoce el valor anterior; el llamador emite el evento DESPUÉS del commit.
// Se usa `cruzoMinimo` —construido sobre el mismo `isLowStock` de la card de
// Alertas de Stock y del filtro de Inventario— para que el aviso y lo que se ve
// en pantalla no puedan discrepar. Lista vacía si el decremento ya había corrido
// (no-op idempotente).
export async function dispatchStockDecrement(
  tx: Prisma.TransactionClient,
  shipping: ShippingStockRef,
): Promise<string[]> {
  if (shipping.stock_descontado_at) return []; // already decremented — idempotent

  const order = await tx.order.findUniqueOrThrow({
    where:  { id: shipping.orden_id },
    select: {
      numero_orden: true,
      items: { select: { producto_id: true, producto_nombre: true, cantidad: true } },
    },
  });
  // Sum per product — an order may repeat a product across lines (moliendas).
  const porProducto = new Map<string, { nombre: string; cantidad: number }>();
  for (const item of order.items) {
    if (!item.producto_id) continue;
    const prev = porProducto.get(item.producto_id);
    porProducto.set(item.producto_id, {
      nombre:   item.producto_nombre,
      cantidad: (prev?.cantidad ?? 0) + item.cantidad,
    });
  }

  const fallidos: string[] = [];
  for (const [productoId, { nombre, cantidad }] of porProducto) {
    // Atomic conditional decrement — same pattern as /api/inventory/adjust's
    // 'salida': if the floor check fails no row is touched.
    const res = await tx.product.updateMany({
      where: { id: productoId, stock: { gte: cantidad } },
      data:  { stock: { decrement: cantidad }, updatedAt: new Date() },
    });
    if (res.count === 0) fallidos.push(nombre);
  }
  // ANY failure → throw. The transaction rolls back the decrements that did
  // apply, so the stock is untouched and the dispatch is blocked.
  if (fallidos.length > 0) throw new DispatchStockError(fallidos);

  // Kardex trail (tipo 'venta'), with the REAL post-decrement values.
  const cruzaronMinimo: string[] = [];
  for (const [productoId, { nombre, cantidad }] of porProducto) {
    const updated = await tx.product.findUniqueOrThrow({
      where: { id: productoId }, select: { stock: true, stock_minimo: true, activo: true },
    });
    const anterior = updated.stock + cantidad;
    await tx.inventoryLog.create({
      data: {
        producto_id:     productoId,
        producto_nombre: nombre,
        tipo:            'venta',
        cantidad,
        stock_anterior:  anterior,
        stock_nuevo:     updated.stock,
        motivo:          `Despacho orden ${order.numero_orden}`,
        // El movimiento NACE de esta orden — el enlace de la auditoría sale de acá,
        // no de parsear el motivo. `shipping.orden_id` es el id que ya se usó para
        // cargar la orden arriba.
        orden_id:        shipping.orden_id,
      },
    });
    // El CRUCE, no el estado: un producto que ya estaba bajo antes del despacho no
    // vuelve a avisar en cada venta posterior. `cruzoMinimo` vive junto a
    // `isLowStock` para que este emisor y el del ajuste de inventario no puedan
    // discrepar entre sí ni con la card de Alertas de Stock.
    if (cruzoMinimo(anterior, updated.stock, {
      stock_minimo: updated.stock_minimo, activo: updated.activo,
    })) {
      cruzaronMinimo.push(productoId);
    }
  }

  await tx.shipping.update({
    where: { id: shipping.id },
    data:  { stock_descontado_at: new Date(), updatedAt: new Date() },
  });

  return cruzaronMinimo;
}

// Restock twin: a dispatched delivery came back (fallido, or the order was
// cancelled after dispatch). Re-increments the SAME quantities, logs the return
// (tipo 'devolucion'), and CLEARS the marker — so a later re-dispatch (fallido →
// reprogramar → en_ruta) decrements again, exactly once. No-op unless the
// decrement actually ran.
export async function restockShippingStock(
  tx: Prisma.TransactionClient,
  shipping: ShippingStockRef,
  motivo: string,
): Promise<void> {
  if (!shipping.stock_descontado_at) return; // nothing was decremented

  const order = await tx.order.findUniqueOrThrow({
    where:  { id: shipping.orden_id },
    select: {
      numero_orden: true,
      items: { select: { producto_id: true, producto_nombre: true, cantidad: true } },
    },
  });
  const porProducto = new Map<string, { nombre: string; cantidad: number }>();
  for (const item of order.items) {
    if (!item.producto_id) continue;
    const prev = porProducto.get(item.producto_id);
    porProducto.set(item.producto_id, {
      nombre:   item.producto_nombre,
      cantidad: (prev?.cantidad ?? 0) + item.cantidad,
    });
  }

  for (const [productoId, { nombre, cantidad }] of porProducto) {
    const updated = await tx.product.update({
      where: { id: productoId },
      data:  { stock: { increment: cantidad }, updatedAt: new Date() },
      select: { stock: true },
    });
    await tx.inventoryLog.create({
      data: {
        producto_id:     productoId,
        producto_nombre: nombre,
        tipo:            'devolucion',
        cantidad,
        stock_anterior:  updated.stock - cantidad,
        stock_nuevo:     updated.stock,
        motivo:          `${motivo} — orden ${order.numero_orden}`,
        // Este reintegro cubre fallido Y cancelación tras despacho: las dos vías
        // nacen de esta orden, así que las dos llevan su enlace. `shipping.orden_id`
        // es el id con el que se cargó la orden arriba.
        orden_id:        shipping.orden_id,
      },
    });
  }

  await tx.shipping.update({
    where: { id: shipping.id },
    data:  { stock_descontado_at: null, updatedAt: new Date() },
  });
}
