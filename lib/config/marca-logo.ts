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
 * El texto alternativo de la imagen del logo: lo que el dueño escribió, o —vacío— el nombre del
 * negocio. Mismo patrón que la galería de /nosotros (§ NosotrosGaleria, "ALT opcional con
 * FALLBACK CONTEXTUAL, no requerido"): un campo requerido que el operador no llena se rellenaría
 * con basura, peor para un lector de pantalla que un fallback que describe el contexto real.
 */
export function altDeLogo(logo: LogoContent, nombreNegocio: string): string {
  return logo.alt.trim() !== '' ? logo.alt : nombreNegocio;
}
