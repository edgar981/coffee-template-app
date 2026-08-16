// THE shared "low stock" definition behind the dashboard's "Alertas de Stock"
// card AND the Inventario page's low-stock filter. Both import from HERE, so the
// number on the card equals the row count of the list it links to.
//
// PURE PREDICATE ONLY — no Prisma, no `server-only`. Runs client-side in both the
// dashboard and the Inventario page (both already load the product list).

/** Minimal product shape the low-stock rule needs. */
export interface StockRef {
  stock: number;
  /** Reorder threshold; defaults to 5 (schema default) when absent. */
  stock_minimo?: number | null;
  /** Inactive products aren't actionable stock alerts. `undefined` = active. */
  activo?: boolean | null;
}

/** Fallback reorder point when a product has no explicit `stock_minimo`. */
export const DEFAULT_STOCK_MINIMO = 5;

/**
 * Tamaño de la VENTANA del kardex: la lectura devuelve a lo sumo estos movimientos
 * (los más recientes que matchean el filtro). Vive acá —módulo puro, sin Prisma—
 * y no en `inventory.ts` para que el CLIENTE pueda leerlo sin arrastrar el cliente
 * de Prisma al bundle: la pantalla lo necesita para DECLARAR el corte cuando la
 * ventana viene llena ("mostrando los últimos N"), en vez de cortar en silencio —
 * mentir por omisión es el peor modo de falla de una auditoría. `logsDeInventario`
 * lo importa de acá como su `take` por defecto: una sola fuente.
 */
export const KARDEX_TOPE = 200;

/**
 * A product is a stock alert when it's ACTIVE and at/below its reorder point.
 * `stock <= stock_minimo` — the same comparison the Inventario table draws its
 * amber rows with, kept here so the dashboard card can't drift from the list.
 */
export function isLowStock(p: StockRef): boolean {
  return p.activo !== false && p.stock <= (p.stock_minimo ?? DEFAULT_STOCK_MINIMO);
}

/**
 * EL cruce del mínimo: estaba por encima y quedó en/por debajo. Es el disparador
 * de la alerta de stock — NO el estado "está bajo", que sigue siendo cierto en
 * cada movimiento posterior y avisaría una vez por venta de un producto agotado.
 *
 * Vive junto a `isLowStock` y lo REUSA a propósito: los dos emisores del evento
 * (el ajuste de inventario y el descuento al despachar) escribían esta misma
 * comparación por separado, y el día que una se desincronizara del predicado de
 * la card de Alertas de Stock, la campana y la card dejarían de reconciliar.
 *
 * `ref` son los datos que NO cambian con el movimiento (mínimo y actividad); el
 * stock de antes y el de después son los dos únicos parámetros que varían.
 */
export function cruzoMinimo(
  anterior: number,
  nuevo: number,
  ref: Omit<StockRef, 'stock'>,
): boolean {
  return !isLowStock({ ...ref, stock: anterior }) && isLowStock({ ...ref, stock: nuevo });
}

/**
 * El param LEGACY de la Inventario vieja: `/admin/inventario?stock=bajo-minimo`
 * abría su vista de stock bajo. Esa vista se retiró —la cola de reposición vive
 * ahora en el carril "Por reponer" de Productos—, así que estos constantes ya no
 * arman ningún enlace vivo: sólo los usa `redirect-inventario` para RECONOCER el
 * param en los enlaces congelados (viejas `Notification.href`, `cmdk-recents`) y
 * mandarlos a `/admin/productos?f=reponer`. Se mantienen mientras esa población
 * congelada exista.
 */
export const LOW_STOCK_PARAM = 'stock';
export const LOW_STOCK_VALUE = 'bajo-minimo';
