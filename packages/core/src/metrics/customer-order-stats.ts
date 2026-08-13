import prisma from '@duna/core';
import { NON_CANCELLED_ESTADOS } from './order-stat-filters';

// Server-side per-customer aggregates, keyed by cliente_id. THE single place that
// turns the shared definitions into numbers, so the customers list, Top 5, profile
// and the recurrentes metric all agree. (order-stat-filters stays Prisma-free —
// it holds the definition; this holds the query.)

/**
 * Count of NON-cancelled orders per customer — the "N órdenes" the UI shows. A
 * pending order counts; a cancelled one does not. NOT the referential `_count`
 * behind the delete guard (that one includes cancelled — see the customers route).
 */
export async function nonCancelledOrderCountByCustomer(): Promise<Map<string, number>> {
  const rows = await prisma.order.groupBy({
    by:     ['cliente_id'],
    where:  { cliente_id: { not: null }, estado: { in: NON_CANCELLED_ESTADOS } },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.cliente_id!, r._count._all]));
}

/**
 * Fecha de la ÚLTIMA orden no cancelada de cada cliente (ISO), para la recencia
 * que la lista muestra como TEXTO ("hace 3 días").
 *
 * ── LA DEFINICIÓN ES LA MISMA QUE LA DEL CONTEO, Y ESO IMPORTA ──────────────
 *
 * Se excluyen las canceladas porque el número que va al lado —"N pedidos"— ya las
 * excluye. Con dos definiciones distintas, un cliente con una sola orden y
 * cancelada diría "0 pedidos · hace 2 días", que es una fila que se contradice a
 * sí misma.
 *
 * NO es la del barrido de reactivación (`clienteInactivo`), que mira la última
 * orden PAGADA: esa pregunta es "¿hace cuánto que este cliente no deja plata?" y
 * ésta es "¿hace cuánto que no aparece?". Son dos preguntas y por eso son dos
 * funciones; lo que no puede pasar es que la misma pregunta tenga dos respuestas.
 */
export async function lastOrderDateByCustomer(): Promise<Map<string, Date>> {
  const rows = await prisma.order.groupBy({
    by:    ['cliente_id'],
    where: { cliente_id: { not: null }, estado: { in: NON_CANCELLED_ESTADOS } },
    _max:  { createdAt: true },
  });
  const byId = new Map<string, Date>();
  for (const r of rows) {
    if (r.cliente_id && r._max.createdAt) byId.set(r.cliente_id, r._max.createdAt);
  }
  return byId;
}

/**
 * Total PAID per customer = sum of the customer's Payments (real money in). A
 * pending order contributes 0 until it is actually paid. Payments link to the
 * customer through their order (Payment → Order.cliente_id).
 */
export async function paidTotalByCustomer(): Promise<Map<string, number>> {
  const rows = await prisma.payment.findMany({
    select: { monto: true, order: { select: { cliente_id: true } } },
  });
  const byId = new Map<string, number>();
  for (const p of rows) {
    const cid = p.order?.cliente_id;
    if (cid) byId.set(cid, (byId.get(cid) ?? 0) + p.monto);
  }
  return byId;
}
