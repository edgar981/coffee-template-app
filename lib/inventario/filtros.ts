import { isLowStock, type StockRef } from '@duna/core/metrics/inventory-filters';
import { conteosDeCola, type CarrilBase, type ConteosDeCola } from '@/lib/carriles';

// ─── LOS CARRILES DE INVENTARIO · la cola de reposición ──────────────────────
//
// La pregunta de Inventario es "¿qué tengo que reponer?", así que su organizador
// es la COLA de reposición — un carril, no una tabla (§ CLAUDE.md, la frontera con
// Productos). Los dos carriles son de tipo `cola` (llevan número) y CONSUMEN
// `isLowStock`, la fuente única detrás de cinco superficies. No se redefine acá:
// un recorte propio haría que la card del dashboard, el punto sol del nav y esta
// cola contaran distinto el mismo hecho.
//
// Es el MISMO par que en Productos (`lib/productos/filtros.ts`), y eso es correcto,
// no una duplicación: las dos pantallas superficializan la reposición y reconcilian
// justamente porque comparten el predicado. Lo que cambia es el rol —en Productos
// es UNO de cuatro carriles que facetean el catálogo; acá es el organizador—.
//
// NO hay carril "Todos": esa sería la tabla de stock completa, que es vista de
// PRODUCTO y vive en Productos. El ajuste proactivo de un producto que no está
// bajo mínimo se hace con el botón "Ajustar Stock" (selector), no navegando una
// lista de todo el catálogo acá.

export type CarrilKey = 'reponer' | 'agotados';

export interface CarrilInventario extends CarrilBase<CarrilKey> {
  aplica: (p: StockRef) => boolean;
}

/** POR REPONER · `isLowStock` tal cual — la alerta, no una definición nueva. */
export const porReponer = (p: StockRef): boolean => isLowStock(p);

/**
 * AGOTADOS ⊂ POR REPONER, por CONSTRUCCIÓN. Un producto en cero cumple
 * `isLowStock` siempre (`0 <= cualquier mínimo`), así que es un RECORTE del
 * anterior. Se deriva de `porReponer` en vez de escribir `p.stock === 0` suelto,
 * por lo mismo que en Productos: así la contención es una propiedad del código y
 * el trato de `activo` no puede divergir (un inactivo en cero no es reposición
 * pendiente, y `isLowStock` ya lo excluye).
 */
export const agotados = (p: StockRef): boolean => porReponer(p) && p.stock === 0;

export const CARRILES_INVENTARIO: CarrilInventario[] = [
  { key: 'reponer',  label: 'Por reponer', tipo: 'cola', aplica: porReponer },
  { key: 'agotados', label: 'Agotados',    tipo: 'cola', aplica: agotados },
];

/** El carril por defecto: la pregunta operativa "¿qué repongo hoy?". */
export const CARRIL_INVENTARIO_DEFAULT: CarrilKey = 'reponer';

/** `null` para una key que no existe — no se cae al default en silencio: un
 *  parámetro de URL basura debe ser visible, no interpretado. */
export const carrilPorKey = (key: string): CarrilInventario | null =>
  CARRILES_INVENTARIO.find(c => c.key === key) ?? null;

export function aplicarCarril<T extends StockRef>(productos: T[], key: CarrilKey): T[] {
  const carril = carrilPorKey(key);
  return carril ? productos.filter(carril.aplica) : productos;
}

/** Conteo de las colas, sobre la lista que se muestra. Los dos son `cola`, así
 *  que los dos llevan número. */
export const conteosInventario = <T extends StockRef>(productos: T[]): ConteosDeCola<CarrilKey> =>
  conteosDeCola(CARRILES_INVENTARIO, productos);
