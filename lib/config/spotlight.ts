// lib/config/spotlight.ts — § DESTACADO-PANEL-COMPLETO-Y-BOTONES-PDP-1
//
// Lógica PURA de la banda Spotlight que el storefront (`components/storefront/home/Spotlight.tsx`)
// y el panel (`TiendaSeccionEditor`, vía el picker de producto) comparten: derivar la ETIQUETA de un
// chip de variante (Presentación/Tamaño) a partir de DATO real del producto —nunca un literal
// inventado, misma familia que el "rating fabricado" que CLAUDE.md ya prohibió— y resolver cuál es
// el producto ACTIVO del escenario dado el pin principal, hasta dos alternos (Presentación/Tamaño) y
// la elección en vivo del visitante.
//
// EL EJE NUEVO — hoy `spotlight` tiene TRES punteros al catálogo (§ SpotlightContent,
// site-content-defaults.ts): `productoSlug` (el principal), `presentacionSlug` (la OTRA
// presentación — p. ej. Molido cuando el principal es En grano, para el tenant que modela cada
// combinación como un producto DISTINTO) y `otroTamanoSlug` (el OTRO tamaño, MISMO campo de
// siempre — sin romper lo guardado). Los dos alternos son INDEPENDIENTES entre sí: no hay una
// matriz completa de combinaciones (eso es Backlog #62, un proyecto aparte) — cada uno es, como
// mucho, un segundo producto que REEMPLAZA entero al principal cuando se elige (foto, precio,
// "Agregar al carrito" y molienda pasan a ser los del producto activo).

export interface ProductoVarianteSpotlight {
  slug: string;
  variante?: string | null;
  peso_gramos?: number | null;
  nombre: string;
}

/**
 * La etiqueta de un chip de variante (Presentación/Tamaño): el campo `variante` del producto si
 * está declarado (p. ej. "En grano · 250 g"), si no el peso ("250 g"), si no el nombre completo.
 * Los TRES caminos son DATO del producto — nunca un literal inventado por esta función.
 */
export function etiquetaVarianteSpotlight(p: ProductoVarianteSpotlight): string {
  if (p.variante) return p.variante;
  if (p.peso_gramos != null) return `${p.peso_gramos} g`;
  return p.nombre;
}

/**
 * El producto ACTIVO del escenario: el `principal`, salvo que `slugElegido` coincida con uno de
 * los `alternos` configurados — un slug que no coincide con NINGUNO (dato corrupto, o el alterno
 * se retiró del panel entre renders) cae al `principal`, nunca a un producto a medias. `null`/`''`
 * en `slugElegido` es "sin elección todavía" → el principal, el mismo criterio de siempre.
 */
export function productoActivoSpotlight<T extends { slug: string }>(
  principal: T,
  alternos: readonly (T | null)[],
  slugElegido: string | null,
): T {
  if (!slugElegido) return principal;
  return alternos.find((p) => p?.slug === slugElegido) ?? principal;
}
