// La portada de un producto y su fallback, en UN SOLO lugar.
//
// La columna `Product.imagen` es `String @default("")`, así que "sin foto" es la
// CADENA VACÍA, no `null`. El bug que esto cierra: los sitios de render usaban
// `imagen ?? PLACEHOLDER`, y `??` NO atrapa `''` — sólo `null`/`undefined`—, así que
// un producto sin foto (importado, o recién creado) quedaba con `src=''` y una
// miniatura ROTA en el carrito, el buscador, el checkout y el hero del detalle.
//
// El fix es `||` (truthy: cubre `''`, `null` y `undefined`), pero centralizado en esta
// función para que el gotcha `??`-vs-`||` no vuelva a colarse por-sitio: quien necesite
// la portada llama a `imagenPortada`, no arma el fallback a mano. (Los cards grandes
// —catálogo y admin— NO usan esto: tienen su propio vacío de marca —cuadro crema /
// ícono `Package`— vía un guard `{imagen && …}`, más lindo que un placeholder genérico.)

/** Placeholder de portada. Asset POR-DESPLIEGUE (el mark de la marca; hoy el de Nayoli),
 *  como el favicon — un cliente nuevo lo reemplaza en la tanda de assets. */
export const PLACEHOLDER_PRODUCTO = '/images/placeholder-producto-v1.png';

/** La portada del producto, cayendo al placeholder cuando NO hay imagen. Truthy a
 *  propósito: trata `''` (el default de la columna) igual que `null`/`undefined`. */
export function imagenPortada(imagen: string | null | undefined): string {
  return imagen || PLACEHOLDER_PRODUCTO;
}
