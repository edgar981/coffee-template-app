// LA COMPOSICIÓN «STICKERS» DEL INTERLUDIO DE /nosotros (§ CHAMISAS-NOSOTROS-ARCO-E-INTERLUDIO-1,
// sobre § CHAMISAS-NOSOTROS-ALBUM-1). PURA (capa 1): sin red, sin DOM. Es "qué se muestra por café"
// —color, foto-o-ausencia, nombre, notas— que antes vivía inline dentro de
// `NosotrosInterludioStickers.tsx` (tres circulitos de color sin foto ni nombre). Se extrae para
// afirmarla sin montar React: el color sale de `colorDeLamina` (`lib/tienda/laminas.ts`), el MISMO
// mapa que «Láminas» de /tienda y las Casillas de frecuencia — nunca un segundo sistema de color.
//
// LAS NOTAS VAN JOINEADAS CON ' · ', NO `fraseNotas` (`lib/tienda/producto-lamina.ts`). Son dos
// voces distintas y YA conviven en el repo: `fraseNotas` arma una oración ("Floral, Frutos rojos y
// Dulce.") para la Lámina abierta de la página de producto; el ' · ' lo usan las CUATRO superficies
// de catálogo que ya muestran notas como TAG corto (`TiendaLaminas.tsx`, `TiendaEncabezado.tsx`,
// `TiendaTaquilla.tsx`, `SuscripcionCasillas.tsx`) — y es la forma que el spec de este slice pide
// literal ("«Floral · Frutos rojos · Dulce»"). Un sticker es un tag corto, no una oración: se suma
// a la mayoría ya existente, no a `fraseNotas`.

import { colorDeLamina } from '@/lib/tienda/laminas';
import type { RaicesPaleta } from '@/lib/config/palette-derive';
import type { Product } from '@/types/product';

export interface StickerCafe {
  id: string;
  slug: string;
  nombre: string;
  /** El color de la tarjeta — SIEMPRE presente, `colorDeLamina` nunca falla (cae a la paleta de
   *  reserva derivada del tema). Una tarjeta sin foto se muestra con sólo este color. */
  color: string;
  /** `null` = sin foto: la tarjeta se muestra SÓLO con el color (§ el spec: "nunca una imagen
   *  rota"), nunca un placeholder inventado. */
  imagen: string | null;
  /** `null` = sin notas: la línea entera se omite (§ el spec: "sin notas, sin línea"), nunca una
   *  frase vacía o un guion. */
  notas: string | null;
}

/** Los stickers del Interludio, en el orden del catálogo — el mismo orden/índice que decide
 *  `colorDeLamina` para que un café no cambie de color entre esta sección y «Láminas» de /tienda. */
export function stickersDeCatalogo(
  catalogo: readonly Product[],
  coloresPorProducto: Record<string, string>,
  raices?: RaicesPaleta,
): StickerCafe[] {
  return catalogo.map((producto, indice) => ({
    id: producto.id,
    slug: producto.slug,
    nombre: producto.nombre,
    color: colorDeLamina(producto.id, indice, coloresPorProducto, raices),
    imagen: producto.imagen && producto.imagen.trim() !== '' ? producto.imagen : null,
    notas: producto.notas && producto.notas.length > 0 ? producto.notas.join(' · ') : null,
  }));
}
