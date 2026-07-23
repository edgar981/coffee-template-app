// ─── Dashboard trend policy — SINGLE SOURCE OF TRUTH ──────────────────────────
// Everything about how the stat-card trend pills behave is tunable from here.
//
// WINDOW: current CALENDAR MONTH (in progress) vs the PREVIOUS COMPLETE month,
// both anchored to America/Bogota wall-clock. The month boundaries are computed
// with `startOfZonedMonth` in app/api/dashboard/stats/route.ts.
//
// ANTI-NOISE FLOOR: if the previous month had fewer than TREND_MIN_PREV_ORDERS
// non-cancelled orders (or its value was 0), we DON'T show a delta arrow — a
// percentage computed on a tiny base lies. The pill falls back to a neutral
// "— sin comparativa" state instead.
export const TREND_MIN_PREV_ORDERS = 5;

export type TrendDirection = 'up' | 'down' | 'flat' | 'none';

export interface Trend {
  direction: TrendDirection;
  /** Rounded % change vs previous period; null when not comparable. */
  pct: number | null;
  /** False → show the neutral "sin comparativa" pill (base too small). */
  comparable: boolean;
}

/** Neutral pill — base too small, or a metric with no period-over-period backing yet. */
export const NEUTRAL_TREND: Trend = { direction: 'none', pct: null, comparable: false };

/**
 * Build a Trend from current vs previous period values. `prevPeriodOrders` is
 * the anti-noise gate basis (non-cancelled orders in the previous month) — the
 * same floor gates every metric so the whole row stays consistent.
 */
export function computeTrend(current: number, previous: number, prevPeriodOrders: number): Trend {
  if (prevPeriodOrders < TREND_MIN_PREV_ORDERS || previous <= 0) {
    return NEUTRAL_TREND;
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  const direction: TrendDirection = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  return { direction, pct, comparable: true };
}
