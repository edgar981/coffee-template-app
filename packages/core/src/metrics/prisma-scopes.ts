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
 * (`CN-`; las `SN-` son data de demo heredada). Expresado como filtro de la
 * relación Payment→Order.
 *
 * CANCELADAS INCLUIDAS, y es una decisión (2026-08-22): el `Payment` no lo toca
 * cancelar (§ "El eje de COBRO se escribe una sola vez"), así que la plata entró.
 * Excluirlas hacía que el Dashboard fuera la ÚNICA superficie que reportaba menos
 * que el libro de Pagos —$259k contra los $315k de Analítica y Clientes
 * (`paidTotalByCustomer`, que ya incluye canceladas)—. Un reembolso sería otro
 * hecho, y hoy no se modela.
 *
 * CONSECUENCIA, dicha porque llega por correo sin que nadie toque la pantalla:
 * este scope lo comparten los DOS reportes de automatización
 * (`lib/automations/reportes.ts` — resumen diario y reporte semanal), así que
 * también empiezan a sumar los pagos sobre órdenes canceladas (+$56.000 en dev,
 * 2 pagos). Es el MISMO principio, no daño colateral; un scope local del
 * Dashboard sería una segunda definición de "ingreso", que es la divergencia que
 * este cambio cierra, no una que abra.
 */
export const REVENUE_ORDER_SCOPE = {
  order: { numero_orden: { startsWith: 'CN-' } },
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
