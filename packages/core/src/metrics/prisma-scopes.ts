import { PENDING_ESTADO, POR_COBRAR_SHIPPING_ESTADOS } from '@duna/core/metrics/order-stat-filters';

// Los filtros Prisma compartidos por TODO lo que cuenta plata y órdenes: el
// dashboard, y ahora los reportes de las automatizaciones. Vivían dentro del
// handler de /api/dashboard/stats, así que un reporte que quisiera "las ventas de
// la semana" tenía que re-declararlos — y dos definiciones de "ingreso" que se
// separan un día son un correo que le miente al owner.
//
// OBJETOS PLANOS, sin importar Prisma: son argumentos `where`, no consultas.

/** Toda métrica excluye las órdenes canceladas: son registro auditable, no venta. */
export const NOT_CANCELLED = { estado: { not: 'cancelado' } } as const;

/**
 * INGRESO = el libro de PAGOS, no el total de las órdenes. Sobre órdenes reales
 * (`CN-`; las `SN-` son data de demo heredada) y nunca canceladas. Expresado como
 * filtro de la relación Payment→Order.
 */
export const REVENUE_ORDER_SCOPE = {
  order: { numero_orden: { startsWith: 'CN-' }, estado: { not: 'cancelado' } },
} as const;

/**
 * "Por cobrar": contraentrega, ya despachada (en_ruta/entregado), aún sin pagar —
 * la plata que el mensajero anda cobrando. Misma definición que `isPorCobrar`
 * (lib/metrics/order-stat-filters), en forma de filtro de relación.
 */
export const POR_COBRAR_WHERE = {
  estado:         PENDING_ESTADO,
  condicion_pago: 'CONTRAENTREGA' as const,
  shipping:       { estado: { in: [...POR_COBRAR_SHIPPING_ESTADOS] } },
};

/** Órdenes reales creadas por el negocio (excluye la data de demo `SN-`). */
export const ORDENES_REALES = { numero_orden: { startsWith: 'CN-' } } as const;
