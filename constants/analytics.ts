import { AnalyticsData } from "@/types/analytics";

export const EMPTY_ANALYTICS: AnalyticsData = {
  kpis: {
    totalRevenue: 0, ticketPromedio: 0,
    tasaRetencion: 0, margenBruto: 0,
    totalOrders: 0,  totalCustomers: 0,
  },
  salesByMonth: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
    .map(mes => ({ mes, ventas: 0, ordenes: 0 })),
  canalData: [],
  categoryData: [],
  weekData:  ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']
    .map(dia => ({ dia, ordenes: 0, ingresos: 0 })),
};

export const productData = [
  { producto: 'Café Bolsa 250g',     ventas: 245, ingresos: 20825000 },
  { producto: 'Café Grano 500g',     ventas: 178, ingresos: 24920000 },
  { producto: 'Cold Brew 500ml',     ventas: 134, ingresos: 14740000 },
  { producto: 'Caja Regalo Esp.',    ventas:  89, ingresos: 18690000 },
  { producto: 'Suscripción Mensual', ventas:  67, ingresos: 30150000 },
  { producto: 'Café Molido 250g',    ventas: 201, ingresos: 15075000 },
];