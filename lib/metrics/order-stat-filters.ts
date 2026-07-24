import { BUSINESS_TZ, startOfZonedMonth, zonedDayKey } from '@/lib/timezone';
import type { OrderStatus } from '@/types/order';

// THE shared definitions behind the dashboard's clickable order stats. Each stat
// is counted server-side in app/api/dashboard/stats/route.ts and re-expressed as
// an /admin/ordenes query string on the card. Both sides import from HERE, so
// the number on the card and the row count of the list it links to cannot
// diverge.
//
// PURE DATE/VALUE LOGIC ONLY — no Prisma, no `server-only`, no next/headers. The
// stats route handler imports it on the server; the dashboard StatCard imports
// it in a client component. A server-side import here breaks the client build.

/**
 * The estado "Órdenes Pendientes" counts. The stat is `pendiente` MINUS the
 * por-cobrar set (a dispatched-unpaid contraentrega isn't "requiere atención" —
 * the courier is already out collecting it). The card links with `cobrar=0`
 * (exclude por-cobrar), which the Órdenes page parses back to the same set.
 */
export const PENDING_ESTADO = 'pendiente' satisfies OrderStatus;

/**
 * Query string (without `?`) reproducing the "Órdenes Pendientes" stat exactly:
 * pendiente AND NOT por-cobrar. Kept next to the definition so the card and the
 * list can't diverge.
 */
export const PENDING_ORDERS_QUERY = `estado=${PENDING_ESTADO}&cobrar=0`;

// ─── "Por cobrar" (cuentas por cobrar) ───────────────────────────────────────
// A CONTRAENTREGA order whose goods already left (dispatched or delivered) but
// whose money hasn't come in — the receivable the courier is out collecting.
// PURE (no Prisma): the Órdenes list filters with it client-side; the dashboard
// stats route counts with the same definition. Shared here so the card number
// and the filtered list can never diverge.

/**
 * Shipping estados that count as "dispatched": en_ruta (out) and entregado
 * (delivered, cash on its way back). `preparando` is NOT por cobrar yet (the
 * goods haven't left — it's still an ordinary pending order); `fallido` and
 * `cancelado` aren't receivables (the goods came back).
 */
export const POR_COBRAR_SHIPPING_ESTADOS = ['en_ruta', 'entregado'] as const;

/**
 * "Por cobrar" = CONTRAENTREGA + pago pendiente + despacho en curso o entregado.
 * For ANTICIPADO orders this is empty by construction (they can't dispatch
 * unpaid — server-enforced).
 */
export function isPorCobrar(order: {
  estado: string;
  condicion_pago?: string | null;
  shipping?: { estado: string } | null;
}): boolean {
  return (
    order.estado === PENDING_ESTADO &&
    order.condicion_pago === 'CONTRAENTREGA' &&
    !!order.shipping &&
    (POR_COBRAR_SHIPPING_ESTADOS as readonly string[]).includes(order.shipping.estado)
  );
}

export interface CurrentMonthRange {
  /** UTC instant of local midnight on the 1st — the server query's `gte`. */
  start: Date;
  /** UTC instant of local midnight on the 1st of NEXT month — the `lt`. */
  end:   Date;
  /** `YYYY-MM-DD` of the 1st, America/Bogota — the `desde` query param. */
  desde: string;
  /** `YYYY-MM-DD` of today, America/Bogota — the `hasta` query param. */
  hasta: string;
}

/**
 * Current calendar month in progress, anchored to America/Bogota wall clock.
 *
 * `start`/`end` are absolute instants for DB range queries; `desde`/`hasta` are
 * the local day keys the Órdenes page filters on. `hasta` is TODAY rather than
 * the last day of the month — the month is in progress, and no order is dated in
 * the future, so both forms select the same rows.
 */
export function currentMonthRange(now: Date = new Date()): CurrentMonthRange {
  const start = startOfZonedMonth(now, BUSINESS_TZ, 0);
  const end   = startOfZonedMonth(now, BUSINESS_TZ, 1);
  return {
    start,
    end,
    desde: zonedDayKey(start, BUSINESS_TZ),
    hasta: zonedDayKey(now, BUSINESS_TZ),
  };
}

/**
 * The estados the Órdenes del mes stat counts: everything except `cancelado`.
 * The stat expresses this as a negation (`estado != 'cancelado'`); the Órdenes
 * URL can only express a positive set, so this is the enumerated equivalent.
 *
 * It is exhaustive over OrderStatus by construction — if a fourth estado is ever
 * added, the `satisfies` below still compiles but this list must be revisited,
 * or the card and the list will disagree.
 */
export const MONTH_STAT_ESTADOS = ['pendiente', 'pagado'] satisfies OrderStatus[];

/**
 * Query string (without `?`) reproducing the Órdenes del mes stat exactly.
 *
 * The estado list is what keeps the link honest: the stat filters
 * `estado != 'cancelado'`, which a date-only link cannot express, so it would
 * over-count by every order cancelled inside the current month.
 */
export function currentMonthOrdersQuery(now: Date = new Date()): string {
  const { desde, hasta } = currentMonthRange(now);
  const qs = new URLSearchParams({
    estado: MONTH_STAT_ESTADOS.join(','),
    desde,
    hasta,
  }).toString();
  // Commas are legal unencoded in a query value; leaving them raw keeps the
  // shared URL readable (`?estado=pendiente,pagado` not `pendiente%2Cpagado`).
  return qs.replace(/%2C/g, ',');
}
