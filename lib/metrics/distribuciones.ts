import { CATEGORIAS } from '@/constants/product';
import type { ProductCategory } from '@/types/product';
import type { DashboardDistribuciones, DistribucionSlice } from '@/types/dashboard';

// Plegado de las dos vistas del pie del dashboard: UN query base agrupado por
// (categoría, peso) entra aquí y sale como dos distribuciones en porcentaje. Pura
// y sin Prisma a propósito — el bucket residual "Otros" es una regla de producto y
// merece tests, no quedar enterrado en un route handler donde solo lo ejercita la
// data que haya.
//
// Hubo una tercera vista por molienda; se retiró con la vista (replicaba el split
// de categoría). El dato de molienda sigue en OrderItem — esto solo dejó de
// agruparlo.

/** Fila del query base: la métrica es `SUM(OrderItem.subtotal)`. */
export interface DistribucionRow {
  categoria: string | null;
  /** `Product.peso_gramos` vía join; null = el producto no declara peso. */
  peso:      number | null;
  total:     number;
}

/** `250 g` / `500 g` / `1 kg` / `1.5 kg` — kg a partir de 1000 g. */
export function formatPeso(gramos: number): string {
  if (gramos >= 1000) {
    const kg = gramos / 1000;
    return `${Number.isInteger(kg) ? kg : kg.toFixed(1)} kg`;
  }
  return `${gramos} g`;
}

/**
 * Buckets → porcentajes enteros, orden descendente. El total es el de ESTA vista
 * (cada agrupación reparte lo que puede atribuir), así que las tres suman ~100 por
 * separado. El redondeo puede dejar 99 o 101: es el mismo redondeo que ya usaba el
 * pie de categoría, preferido a meter decimales en la leyenda.
 */
export function aPorcentajes(buckets: Map<string, number>): DistribucionSlice[] {
  const total = [...buckets.values()].reduce((s, v) => s + v, 0);
  if (total <= 0) return [];
  return [...buckets.entries()]
    .map(([name, v]) => ({ name, value: Math.round((v / total) * 100) }))
    .sort((a, b) => b.value - a.value);
}

const bump = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);

export function plegarDistribuciones(rows: DistribucionRow[]): DashboardDistribuciones {
  const cat  = new Map<string, number>();
  const peso = new Map<string, number>();

  for (const row of rows) {
    // CATEGORÍA: los items sin producto atribuible se DESCARTAN — comportamiento
    // heredado del pie actual, que reparte "las ventas atribuibles".
    if (row.categoria) {
      bump(cat, CATEGORIAS[row.categoria as ProductCategory] ?? row.categoria, row.total);
    }
    // PESO: por valor exacto del producto; sin peso (cajas regalo, suscripciones)
    // → "Otros", nunca fuera del reparto.
    bump(peso, row.peso == null ? 'Otros' : formatPeso(row.peso), row.total);
  }

  return {
    categoria: aPorcentajes(cat),
    peso:      aPorcentajes(peso),
  };
}
