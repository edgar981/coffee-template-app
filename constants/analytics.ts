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
  topProducts: [],
};

// `productData` (fixture de 6 productos con ventas e ingresos inventados) se
// eliminó: pintaba "Productos Más Vendidos" e "Ingresos por Producto" con
// nombres que ni siquiera están en el catálogo ("Café Bolsa 250g", "Cold Brew
// 500ml"). Ambas secciones leen ahora `topProducts` del endpoint, agregado desde
// OrderItem. No reintroducir datos de ejemplo acá: con la base limpia lo
// correcto es el estado vacío, no un catálogo imaginario.