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

export interface AnalyticsData {
  kpis:         AnalyticsKpis;
  salesByMonth: SalesByMonth[];
  canalData:    CanalData[];
  weekData:     WeekData[];
}