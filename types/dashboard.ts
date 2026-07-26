import type { Order } from './order';

// ─── Daily chart module (Ventas / Pedidos) ───────────────────────────────────

/** Windows offered by the chart's range selector. Validated server-side. */
export type ChartRange = '3m' | '30d' | '7d';

export const CHART_RANGES: ChartRange[] = ['3m', '30d', '7d'];

export const CHART_RANGE_LABEL: Record<ChartRange, string> = {
  '3m':  'Últimos 3 meses',
  '30d': 'Últimos 30 días',
  '7d':  'Últimos 7 días',
};

/** Days each range spans, ending today (America/Bogota). */
export const CHART_RANGE_DAYS: Record<ChartRange, number> = {
  '3m': 90, '30d': 30, '7d': 7,
};

/**
 * One day of revenue, split by the method the payment was ACTUALLY registered
 * with (Payment.metodo), grouped through METODO_CATEGORIA — not the customer's
 * declared Order.metodo_pago. Amounts in COP.
 */
// `type` (not `interface`) on purpose: the chart card renders either series
// through one generic row type, and only type aliases get the implicit index
// signature that makes them assignable to it.
export type VentasDailyPoint = {
  /** `YYYY-MM-DD` in America/Bogota. */
  date:          string;
  efectivo:      number;
  /** Nequi + Daviplata + bank transfer (the METODO_CATEGORIA bucket). */
  transferencia: number;
  /** `OTRO` — kept so the series still sum to the ledger total. */
  otro:          number;
};

/**
 * One day of order-line counts, split by the product's `peso_gramos`. Lines on
 * any other weight — or with no linked product — land in `otros` rather than
 * being dropped.
 */
export type PedidosDailyPoint = {
  /** `YYYY-MM-DD` in America/Bogota. */
  date:  string;
  g250:  number;
  g500:  number;
  otros: number;
};

/** Payload of GET /api/dashboard/chart. Both series are zero-filled. */
export interface DashboardChartData {
  range:   ChartRange;
  ventas:  VentasDailyPoint[];
  pedidos: PedidosDailyPoint[];
}

export interface DashboardStats {
  // ── Fila "Hoy" (America/Bogota) ──
  /** Sum of Payment.monto received today (CN- orders, non-cancelled). */
  ventasHoy: number;
  /** Orders created today, excluding cancelled and SN- demo data. */
  pedidosHoy: number;
  /**
   * Shipments dispatched today — Shipping rows whose `stock_descontado_at`
   * (stamped at the preparando→en_ruta transition) falls on today.
   */
  despachosHoy: number;

  // ── Cuentas por cobrar ──
  /**
   * Contraentrega orders dispatched (en_ruta/entregado) but unpaid — the courier
   * is out collecting. Same shared definition as `isPorCobrar`.
   */
  porCobrar: number;
  /** Sum of `total` over the por-cobrar set — the receivable, in pesos. */
  porCobrarMonto: number;

  // ── Órdenes pendientes ──
  /**
   * Orders currently `pendiente` EXCLUDING the por-cobrar set — the ones that
   * genuinely await action. `pendingOrders + porCobrar` = every pendiente.
   */
  pendingOrders: number;

  // ── Ingresos (Payments ledger, CN- orders, non-cancelled) ──
  /** Sum of Payment.monto this calendar month (America/Bogota). */
  revenueMonth: number;
  /** Sum of Payment.monto all-time — the "Histórico" subtext. */
  revenueTotal: number;
  /** Current-month average received per sale (revenueMonth / payments this month). */
  avgTicket: number;

  /** N most recent NON-CANCELLED orders by creation date, newest first. */
  recentOrders: Order[];

  /**
   * Month-over-month: current calendar month (in progress) vs the previous
   * complete month, America/Bogota. Revenue + avgTicket come from the PAYMENTS
   * ledger (same source as the Ventas chart); orders is the non-cancelled order
   * count. `prevMonthOrders` is the anti-noise gate basis for the trend pills.
   */
  monthly: {
    revenue:   { current: number; previous: number };
    orders:    { current: number; previous: number };
    avgTicket: { current: number; previous: number };
    prevMonthOrders: number;
  };
}
