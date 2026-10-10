// EL SELECTOR «¿QUÉ TE PROVOCA?» (§ TIENDA-CHAMISAS-ALBUM-1, composición «Carta» de
// `tiendaEncabezado`). PURO (capa 1): sin red, sin DOM. Con 6 productos o menos se elige por
// antojo (una pastilla por café, con sus dos primeras notas); con más, el spec deja los filtros de
// «Actual» — este módulo sólo decide el UMBRAL y arma las pastillas; el componente decide qué
// renderizar con el resultado.

import type { Product } from '@/types/product';
import { colorDeLamina } from './laminas';
import type { RaicesPaleta } from '@/lib/config/palette-derive';

/** El tope de productos para el que el selector de antojo tiene sentido (§ el spec: "Con más de 6
 *  productos el selector no se muestra y quedan los filtros de «Actual»"). */
export const MAX_PRODUCTOS_SELECTOR_ANTOJO = 6;

/** ¿Se muestra el selector de antojo (en vez de los filtros de «Actual»)? Un catálogo vacío tampoco
 *  lo muestra — no hay nada por lo que sentir antojo (§ el estado "Sin productos" del catálogo,
 *  que ya existe y no cambia). */
export function mostrarSelectorAntojo(catalogo: readonly Product[]): boolean {
  return catalogo.length > 0 && catalogo.length <= MAX_PRODUCTOS_SELECTOR_ANTOJO;
}

export interface PildoraAntojo {
  productId: string;
  slug: string;
  nombre: string;
  color: string;
  /** Las DOS primeras `notas` del producto — puede tener 0, 1 o 2, nunca más (§ el spec: "sus dos
   *  primeras notas"). Sin `notas`, la pastilla se queda sólo con el nombre y el color. */
  notas: string[];
}

/** Las pastillas del selector: una por café, con el color de SU lámina (§ `colorDeLamina` — misma
 *  fuente que el catálogo de abajo, nunca una segunda derivación que pudiera divergir) y sus dos
 *  primeras notas. */
export function pildorasAntojo(
  catalogo: readonly Product[],
  coloresPorProducto: Record<string, string>,
  raices?: RaicesPaleta,
): PildoraAntojo[] {
  return catalogo.map((p, i) => ({
    productId: p.id,
    slug: p.slug,
    nombre: p.nombre,
    color: colorDeLamina(p.id, i, coloresPorProducto, raices),
    notas: (p.notas ?? []).slice(0, 2),
  }));
}
