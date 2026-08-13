import type { Order } from './order';
import type { InsightMonthPoint } from '@/lib/metrics/insights';

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

// ─── Distribución (pie conmutable del dashboard) ─────────────────────────────

/** Una porción del pie: nombre de bucket + porcentaje (0–100, entero). */
export interface DistribucionSlice {
  name:  string;
  value: number;
}

/**
 * Las vistas del pie del dashboard. Mismo PERÍODO en las tres (año en curso,
 * America/Bogota) y misma exclusión de `SN-`, pero OJO con la base:
 *
 * - `categoria` y `peso` reparten `SUM(OrderItem.subtotal)` — ventas de producto,
 *   sin envío.
 * - `metodoPago` reparte `SUM(Payment.monto)` — dinero recibido, envío incluido.
 *
 * Son dos preguntas distintas sobre los mismos días, así que sus porcentajes no
 * tienen por qué coincidir; el sub de cada vista declara su base.
 *
 * `null` sería indistinguible de "sin ventas", así que las tres siempre vienen
 * (arrays vacíos cuando no hay datos).
 */
export interface DashboardDistribuciones {
  categoria:  DistribucionSlice[];
  peso:       DistribucionSlice[];
  metodoPago: DistribucionSlice[];
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

  // ── Pedidos que piden acción ──
  /**
   * Cuántos pedidos necesitan atención AHORA, por `necesitaAtencion` — la MISMA
   * definición que filtra el pill de `/admin/pedidos` y que enciende el punto sol
   * del nav. Tres consumidores, una definición: no pueden divergir.
   *
   * REEMPLAZA a `pendingOrders` ("pendiente menos por-cobrar"), que era una cifra
   * del eje de COBRO. La relación con `porCobrar` cambió de forma y conviene
   * tenerlo escrito: antes eran un conjunto y su COMPLEMENTO (sumaban todo
   * `pendiente`); ahora por-cobrar es uno de los cuatro motivos de atención, así
   * que es un SUBCONJUNTO de éste. El sub de la tarjeta lo dice.
   */
  porAtender: number;

  // ── Ingresos (Payments ledger, CN- orders, non-cancelled) ──
  /** Sum of Payment.monto this calendar month (America/Bogota). */
  revenueMonth: number;
  /** Sum of Payment.monto all-time — el widget "Ingresos históricos". */
  revenueTotal: number;
  /**
   * Fecha del PRIMER pago del libro (ISO), o null si todavía no hay ninguno —
   * el "Desde …" del widget histórico. Es el primer pago y no la primera orden
   * creada a propósito: `revenueTotal` suma pagos, así que el período que
   * describe el sub es exactamente el que cubre el valor.
   */
  revenueSince: string | null;

  // ── Últimos eventos (insight de las tarjetas de scope HOY) ──
  // Esas tarjetas no tienen serie mensual: su hecho es CUÁNDO fue el último
  // evento real. Cada uno hereda el scope de su tarjeta. `null` = nunca ocurrió.
  /** Último Payment del libro (CN-, no cancelada) — tarjeta "Ventas de hoy". */
  ultimoPago: string | null;
  /** Último despacho (`stock_descontado_at`) — tarjeta "Despachos de hoy". */
  ultimoDespacho: string | null;
  /** Última orden creada (CN-, no cancelada) — tarjeta "Pedidos de hoy". */
  ultimaOrden: string | null;
  /** Hoy en America/Bogota (`YYYY-MM-DD`): base del "hace N días" del cliente. */
  hoyKey: string;
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

  /**
   * Serie mensual corta (7 meses: 6 cerrados + el mes en curso, ascendente) que
   * alimenta los INSIGHTS de las tarjetas. `ordenes` viaja en cada punto porque
   * es la base de muestra que decide si un % significa algo — ver
   * lib/metrics/insights.ts. El último punto es el mes EN CURSO (`cerrado:
   * false`) y las reglas lo descartan.
   */
  serieMensual: {
    revenue: InsightMonthPoint[];
    orders:  InsightMonthPoint[];
  };

  /** Las tres vistas del pie (mismo período, misma métrica). */
  distribuciones: DashboardDistribuciones;
}
