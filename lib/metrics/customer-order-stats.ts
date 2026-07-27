import prisma from '@/lib/prisma';
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
