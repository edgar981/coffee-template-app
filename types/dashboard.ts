import type { Order } from './order';

export interface DashboardStats {
  /** Orders created today (America/Bogota), excluding cancelled. */
  ordersToday: number;
  /** Orders created yesterday (America/Bogota), excluding cancelled. */
  ordersYesterday: number;
  /**
   * Percentage change of today vs yesterday. `null` when yesterday had 0
   * orders (division undefined) so the UI can show a neutral state.
   */
  ordersDeltaPct: number | null;
  /** Orders currently in `pendiente` state. */
  pendingOrders: number;
  /** Sum of `total` over all non-cancelled orders. */
  totalRevenue: number;
  /** Sum of `total` over non-cancelled orders created today (America/Bogota). */
  revenueToday: number;
  /** totalRevenue / count of non-cancelled orders (0 when none). */
  avgTicket: number;
  /** N most recent orders by creation date (all statuses), newest first. */
  recentOrders: Order[];
  /**
   * Month-over-month comparison: current calendar month (in progress) vs the
   * previous complete month, America/Bogota, non-cancelled orders only. Revenue
   * is Order-based (same source as `totalRevenue`) — NOT the Payments ledger.
   * `prevMonthOrders` is the anti-noise gate basis for the trend pills.
   */
  monthly: {
    revenue:   { current: number; previous: number };
    orders:    { current: number; previous: number };
    avgTicket: { current: number; previous: number };
    prevMonthOrders: number;
  };
}
