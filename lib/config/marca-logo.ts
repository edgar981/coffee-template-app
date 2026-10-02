// EL LOGO SUBIDO del storefront (§ MARCA-LOGO-IMAGEN-1) — reglas PURAS de qué versión mostrar y
// cuál texto alternativo usar, compartidas por `Logo.tsx` (el componente) y cualquier consumidor
// futuro que necesite la misma decisión sin re-renderizar el lockup completo.
//
// Vive APARTE de `site-content-defaults.ts` (que sólo declara el CONTRATO de dato — `LogoContent`,
// el REGISTRY, los defaults) porque esto es lógica de PRESENTACIÓN: qué versión corresponde a qué
// fondo, no qué se guarda. Mismo criterio de separación que `lib/config/email-colors.ts` o
// `lib/productos/categorias.ts` — un módulo puro, chico, testeado aparte de la mecánica de guardado.

import type { LogoContent } from './site-content-defaults';

/** ¿Hay AL MENOS una imagen de logo subida (oscura o clara)? Si no, el storefront muestra el
 *  wordmark de texto (o la flor de Nayoli, § STOREFRONT_TIENE_MARK) — exactamente lo de hoy. */
export function hayLogoImagen(logo: LogoContent): boolean {
  return logo.oscuro.trim() !== '' || logo.claro.trim() !== '';
}

/**
 * La URL del logo para una VARIANTE del lockup (§ Logo.tsx: `'light'` = superficie clara —texto
 * oscuro, páginas internas y encabezado sólido—; `'dark'` = superficie oscura/tinta —la portada
 * flotando sobre el hero, el pie de página—).
 *
 * Si falta la versión preferida para esa variante, usa la OTRA: nunca deja de mostrar el logo
 * subido sólo porque falta una de las dos versiones (§ el spec de este slice, "si falta una
 * versión, usa la otra"). `''` si NINGUNA está subida — el consumidor cae al wordmark de texto.
 */
export function logoParaVariante(logo: LogoContent, variant: 'light' | 'dark'): string {
  const preferida = variant === 'light' ? logo.oscuro : logo.claro;
  if (preferida.trim() !== '') return preferida;
  const alterna = variant === 'light' ? logo.claro : logo.oscuro;
  return alterna;
}

/**
 * CÓMO SE MUESTRA LA MARCA (§ NAV-LOGO-Y-NOMBRE-1) — tres modos, uno elegido EXPLÍCITAMENTE por el
 * dueño (`logo.modo`), los otros dos el default según haya o no imagen subida (§ el spec de este
 * slice: "Default: el comportamiento de hoy según haya o no logo"):
 *
 *  · `'soloNombre'` — ignora cualquier imagen subida, siempre mark+wordmark de texto. Es el default
 *    SIN logo (el caso de HOY, Nayoli) y también una elección válida CON logo (el dueño puede
 *    querer volver al texto sin borrar las imágenes que ya subió).
 *  · `'soloLogo'` — la imagen REEMPLAZA mark+wordmark enteros, en TODOS los anchos. Es el default
 *    CON logo (el caso de HOY para cualquier tenant que ya subió uno, § MARCA-LOGO-IMAGEN-1).
 *  · `'logoYNombre'` — NUEVO: sólo el logo en el ancho de teléfono, logo + nombre en escritorio
 *    (Café Las Chamisas, con su sello redondo).
 *
 * `logo.modo` es un campo 'opcional' más (§ REGISTRY.logo.campos, site-content-defaults.ts): SOFT,
 * nunca lanza, y el resolver lo pasa TAL CUAL —sin clampar— porque `resolverVariante`/`escalares`
 * exige una canónica FIJA y el default de este campo es CONDICIONAL (depende de `hayLogoImagen`,
 * que `resolverVariante` no puede mirar). El clamp —y la interpretación de `''`, ausente o basura—
 * vive ACÁ, en la única función que lo resuelve: `Logo.tsx` (el storefront, § el prop `logo`) y
 * `EncabezadoSeccion.tsx` (el admin, para mostrar la opción vigente en el `<select>`) la comparten,
 * así que las dos superficies no pueden discrepar sobre qué significa un valor guardado.
 */
export type ModoLogo = 'soloNombre' | 'soloLogo' | 'logoYNombre';
const MODOS_LOGO = new Set<ModoLogo>(['soloNombre', 'soloLogo', 'logoYNombre']);

export function modoLogoResuelto(logo: LogoContent): ModoLogo {
  if (MODOS_LOGO.has(logo.modo as ModoLogo)) return logo.modo as ModoLogo;
  return hayLogoImagen(logo) ? 'soloLogo' : 'soloNombre';
}

/**
 * El texto alternativo de la imagen del logo: lo que el dueño escribió, o —vacío— el nombre del
 * negocio. Mismo patrón que la galería de /nosotros (§ NosotrosGaleria, "ALT opcional con
 * FALLBACK CONTEXTUAL, no requerido"): un campo requerido que el operador no llena se rellenaría
 * con basura, peor para un lector de pantalla que un fallback que describe el contexto real.
 */
export function altDeLogo(logo: LogoContent, nombreNegocio: string): string {
  return logo.alt.trim() !== '' ? logo.alt : nombreNegocio;
}

/**
 * EL ALTO DEL LOGO EN `'logoYNombre'` (§ NAV-LOGO-Y-NOMBRE-AJUSTE-1, corrige NAV-LOGO-Y-NOMBRE-1):
 * el logo dejó de ser un ícono FIJO de 28px (`h-7`, ilegible para un sello con ilustración — medido
 * ~22px de alto REAL de tinta en la demo de Café Las Chamisas) y pasa a un alto DERIVADO en los dos
 * anchos, nunca un número suelto.
 *
 * EN EL TELÉFONO (`<lg`, el único hijo visible — el bloque nombre+tagline está `hidden`): el alto
 * DISPONIBLE de la barra, el MISMO valor que ya fija `navFilaAltoClase` (StoreNav.tsx) para ese
 * tramo — 64px para el resto del catálogo, 76/88px para CORTE (§ NAV-ALTURA-CON-FILETE-1, ya
 * afirmado en `nav-internas.test.ts` vía `navOffsetClase`). Se REPLICA, no se importa: este módulo
 * es puro (sin JSX) y `navFilaAltoClase` vive en el componente — mismo criterio que ya separa
 * `navOffsetClase` (themes.ts) de la barra que describe. La fila no lleva padding vertical propio
 * (§ StoreNav.tsx, `navContenedorClase`/el `<header>`), así que este alto LLENA la barra borde a
 * borde — "que ocupe la altura útil… sin cambiar el alto de la barra" (§ el spec de este slice),
 * ni más ni menos.
 */
export function altoLogoNavMovilClase(posicion: boolean): string {
  return posicion ? 'h-[76px] min-[640px]:h-[88px]' : 'h-16';
}

/**
 * EN ESCRITORIO (`lg:` ≡ `min-[1024px]:`, logo + nombre lado a lado): el alto del BLOQUE
 * nombre+tagline que el logo acompaña (`BloqueNombreTagline`, `Logo.tsx`) — MEDIDO contra el
 * componente real, no una fórmula de línea-de-texto adivinada (Chromium 1440×900, harness ad-hoc
 * `.scratch/medir-logo-nav.ts`, gitignorado, no parte del producto):
 *
 *   | wordmarkTratado | tagline | alto MEDIDO del bloque | logo (iguala + un poco) |
 *   |---|---|---|---|
 *   | — (cualquiera) | ausente  | 22px | `h-6`  (24px) |
 *   | false          | presente | 35px | `h-9`  (36px) |
 *   | true           | presente | 45px | `h-12` (48px) |
 *
 * SIN tagline el nombre SIEMPRE renderiza a 22px sin importar `wordmarkTratado` —es la rama SIN
 * `subtitle` de `BloqueNombreTagline`, que ignora esa prop por diseño: "Sólo afecta la rama
 * `subtitle`" (§ el docstring de `wordmarkTratado`, `Logo.tsx`), porque el tratamiento apilado sólo
 * tiene sentido junto a una segunda línea—, por eso las dos primeras filas comparten destino.
 *
 * El `line-height` del tagline (`text-[11px]`, sin `leading-none` propio) HEREDA el `leading-none`
 * del `<span>` que lo envuelve (`line-height` es una propiedad CSS heredada), así que renderiza a
 * 11px exactos — no a los ~16.5px que la línea-de-texto AMBIENTE (1.5, Tailwind preflight) habría
 * hecho suponer sin medir. Es la razón de medir contra el componente real y no de calcular a mano.
 */
export function altoLogoNavEscritorioClase(wordmarkTratado: boolean, hayTagline: boolean): string {
  if (!hayTagline) return 'min-[1024px]:h-6';
  return wordmarkTratado ? 'min-[1024px]:h-12' : 'min-[1024px]:h-9';
}
