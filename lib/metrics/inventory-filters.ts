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
 * A product is a stock alert when it's ACTIVE and at/below its reorder point.
 * `stock <= stock_minimo` — the same comparison the Inventario table draws its
 * amber rows with, kept here so the dashboard card can't drift from the list.
 */
export function isLowStock(p: StockRef): boolean {
  return p.activo !== false && p.stock <= (p.stock_minimo ?? DEFAULT_STOCK_MINIMO);
}

/**
 * URL param that switches the Inventario page to the low-stock view:
 * `/admin/inventario?stock=bajo-minimo`. The dashboard card links with it and the
 * page parses it back to `isLowStock`, so card and list show the same rows.
 */
export const LOW_STOCK_PARAM = 'stock';
export const LOW_STOCK_VALUE = 'bajo-minimo';
export const LOW_STOCK_QUERY = `${LOW_STOCK_PARAM}=${LOW_STOCK_VALUE}`;
