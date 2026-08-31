import type { Order } from './order';
import type { InsightMonthPoint } from '@/lib/metrics/insights';
import type { OrdenAtencion } from '@/lib/atencion/items';

export interface DashboardStats {
  // ── Fila "Hoy" (America/Bogota) ──
  /** Sum of Payment.monto received today. CN- orders, CANCELADAS INCLUIDAS
   *  (§ REVENUE_ORDER_SCOPE: cancelar no toca el pago, la plata entró). */
  ventasHoy: number;
  /** Orders created today, excluding cancelled and SN- demo data. */
  pedidosHoy: number;
  /**
   * Curva del día: pedidos por HORA, 24 buckets (índice = hora, reloj de Bogotá),
   * rellenos server-side. Eje del CONTEO — misma definición que `pedidosHoy`
   * (excluye canceladas), así que la suma de la curva = `pedidosHoy`.
   */
  pedidosPorHora: number[];
  /**
   * Lo que más vendió hoy: hasta 5 productos por `SUM(OrderItem.subtotal)` de las
   * órdenes creadas hoy. Eje del DINERO — INCLUYE canceladas, por el snapshot
   * `producto_nombre`. Ya ordenado desc por el SQL. `producto_id` sólo si es
   * inequívoco (si no, la fila va sin link — ver `TopHoyRow`).
   */
  topHoy: { nombre: string; total: number; producto_id: string | null }[];
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
   * Las ÓRDENES que necesitan atención AHORA, filtradas por `necesitaAtencion` —la
   * MISMA definición que el pill de `/admin/pedidos` y el punto sol del nav— y CON
   * los detalles que la lista transversal "Necesita tu atención" necesita (la página
   * las combina con sus productos bajos vía `itemsDeAtencion`). Antes era sólo el
   * conteo (`porAtender`); ahora es la lista, y el conteo es su largo. `porCobrar` es
   * uno de los cuatro motivos, así que es un SUBCONJUNTO de este conjunto.
   */
  atencionPedidos: OrdenAtencion[];

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
}
