import prisma from '@duna/core';
import { NON_CANCELLED_ESTADOS, TENANT_ORDER_PREFIX } from './order-stat-filters';

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
 *
 * ── UNA SOLA DEFINICIÓN, DOS ALCANCES (unificación 2026-08-21) ──────────────
 *
 * Antes había DOS caminos al mismo hecho y no diferían sólo en el período: éste
 * (lista y perfil de Clientes) no filtraba nada, y la concentración de Analítica
 * excluía `SN-` Y canceladas. Medido en dev el día de la unificación: **$315.000
 * contra $259.000** — dos pantallas afirmando el dinero del mismo cliente con
 * números distintos, que es exactamente el modo de falla de "Por cobrar vs
 * Órdenes Pendientes". Ahora hay UNA definición y el período es un PARÁMETRO, no
 * una segunda implementación.
 *
 * **LAS ÓRDENES CANCELADAS SÍ CUENTAN** (decisión de producto del owner): el
 * cliente pagó y la plata entró. Cancelar NO toca el `Payment` —doctrina
 * declarada—, así que esconderlo haría que la suma por cliente no cuadre con el
 * libro de Pagos. Un reembolso sería OTRO hecho, y hoy no se modela. Por eso acá
 * no hay filtro de estado: su ausencia es la decisión, no un olvido.
 *
 * **LAS `SN-` NO CUENTAN, EN NINGÚN LADO** — ver {@link TENANT_ORDER_PREFIX}. No es
 * definición de negocio: es limpieza de datos de demo.
 *
 * @param rango Ventana opcional sobre `Payment.fecha` (la fecha en que ENTRÓ la
 *   plata, no la de auditoría). Sin él, el total histórico.
 */
export async function paidTotalByCustomer(
  rango?: { desde: Date; hasta: Date },
): Promise<Map<string, number>> {
  const rows = await prisma.payment.findMany({
    where: {
      order: { is: { numero_orden: { startsWith: TENANT_ORDER_PREFIX } } },
      ...(rango ? { fecha: { gte: rango.desde, lt: rango.hasta } } : {}),
    },
    select: { monto: true, order: { select: { cliente_id: true } } },
  });
  const byId = new Map<string, number>();
  for (const p of rows) {
    const cid = p.order?.cliente_id;
    if (cid) byId.set(cid, (byId.get(cid) ?? 0) + p.monto);
  }
  return byId;
}
