// El predicado de coincidencia del buscador del storefront (`NavSearch`) — EXTRAÍDO para poder
// afirmarlo en un test, por el mismo criterio que el resto de `lib/productos/*`: se extrae lo que
// tiene la decisión para poder afirmarla. Vivía inline en un `useMemo` de `NavSearch.tsx`; un test
// que quisiera probarlo ahí habría tenido que REESCRIBIR el predicado, y entonces afirmaría su
// propia copia — la misma trampa que `CATEGORIAS`/`CATEGORIA_LABELS` y el schema editable de
// `presentaciones` (§ CLAUDE.md, "dos declaraciones del mismo conjunto").
//
// MOVIDO TAL CUAL, no reescrito: coincide por `nombre`, `categoria` u `origen`, case-insensitive,
// con `includes` (subcadena, no por palabra). El guard usa `query.trim()`; la comparación usa
// `query.toLowerCase()` SIN trim — es el comportamiento de hoy y no se corrige acá (cambiar el
// predicado cambia resultados para todo visitante; es otra decisión, no ésta).
//
// El TOPE de cuántos resultados MOSTRAR (hoy 6) es de PRESENTACIÓN —cuántas tarjetas caben en el
// panel—, no de COINCIDENCIA —si el producto matchea la consulta—, así que se queda en `NavSearch`
// y no entra a este predicado.
export function buscarProductos<
  T extends { nombre: string; categoria: string; origen?: string | null },
>(catalog: T[], query: string): T[] {
  if (!query.trim()) return [];

  return catalog.filter(
    (product) =>
      product.nombre.toLowerCase().includes(query.toLowerCase()) ||
      product.categoria.toLowerCase().includes(query.toLowerCase()) ||
      product.origen?.toLowerCase().includes(query.toLowerCase())
  );
}
