// lib/storefront/foto-hover.ts — § TIENDA-HOVER-SEGUNDA-FOTO-1
//
// La lógica PURA del crossfade "foto de atrás" que `GrindChooserRiel.tsx` (`TarjetaRiel`) ya tenía
// inline desde § RIEL-PRODUCTOS-Y-VISTA-RAPIDA-1 — EXTRAÍDA para que `ProductCard.tsx` (/tienda y
// "Nuestro Catálogo · Selección del mes" de la home) la REUSE en vez de copiarla. Las dos tarjetas
// comparten la MISMA regla: al pasar el mouse (o con foco), la tarjeta cambia a su primera toma
// ADICIONAL (`galeriaCompleta`, § packages/core/src/product-gallery.ts); sin una segunda foto, la
// portada se queda quieta — no hay nada que extraer ahí, el CSS de cada consumidor ya lo decide con
// un `{fotoAtras && …}`.
//
// `fotoHover` devuelve el PAR frente/atrás en una sola pasada por `galeriaCompleta` — no sólo
// `atras` — para que un consumidor que también necesite la portada (el riel, que la resuelve con
// `imagenPortada`) no vuelva a llamar a `galeriaCompleta` por su cuenta. Dos llamadas al mismo
// cálculo puro no están MAL, pero sí son la clase de duplicación que esta extracción existe para
// cerrar.

import { galeriaCompleta } from '@duna/core/product-gallery';

export interface ProductoFotoHover {
  imagen?: string | null;
  imagenes?: string[] | null;
}

export interface FotoHover {
  /** `galeria[0]` TAL CUAL — puede ser `''`/`undefined` si el producto no tiene ninguna foto. Cada
   *  consumidor decide su propio fallback de portada (`imagenPortada` en el riel; el cuadro crema
   *  de `{imagen && …}` en `ProductCard`) — esta función no impone uno. */
  frente: string | undefined;
  /** La primera toma ADICIONAL (`galeria[1]`), o `null` sin una segunda foto — nunca `undefined`,
   *  para que un consumidor pueda hacer `{fotoAtras && …}` sin preguntarse cuál de los dos vacíos
   *  puede llegar. */
  atras: string | null;
}

/**
 * El par frente/atrás para el crossfade de hover de una tarjeta de producto — MISMA fuente
 * (`galeriaCompleta`) que ya usa el detalle del storefront y el admin, así que el orden y la
 * dedupe (la portada duplicada dentro de `imagenes[]`, § CLAUDE.md "Galería de producto") nunca
 * pueden divergir entre tarjeta y ficha.
 */
export function fotoHover(producto: ProductoFotoHover): FotoHover {
  const galeria = galeriaCompleta(producto.imagen, producto.imagenes);
  return { frente: galeria[0], atras: galeria[1] ?? null };
}
