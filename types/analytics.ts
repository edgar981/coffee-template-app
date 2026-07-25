export interface AnalyticsKpis {
  totalRevenue:    number;
  ticketPromedio:  number;
  tasaRetencion:   number;
  margenBruto:     number;
  totalOrders:     number;
  totalCustomers:  number;
}

export interface SalesByMonth {
  mes:     string;
  ventas:  number;
  ordenes: number;
}

export interface CanalData {
  name:  string;
  value: number;
  fill?: string;
}

export interface WeekData {
  dia:      string;
  ordenes:  number;
  ingresos: number;
}

/**
 * Payload of GET /api/analytics/weekly — ONE specific Monday–Sunday week
 * (America/Bogota) for the Actividad Semanal card, zero-filled Lun→Dom.
 * `week` echoes the normalized Monday day-key so the client can match
 * in-flight responses to the visible week.
 */
export interface WeeklyActivityData {
  week: string;
  days: WeekData[];
}

export interface AnalyticsData {
  kpis:         AnalyticsKpis;
  salesByMonth: SalesByMonth[];
  canalData:    CanalData[];
  categoryData: CanalData[];
}