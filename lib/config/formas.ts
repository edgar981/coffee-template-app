// El SET CERRADO de PERSONALIDADES DE FORMA del storefront (§ eje 4, mitad 1: mecanismo + radios
// var-backed). GEMELO de `lib/config/fuentes`: un cliente elige UNA forma —radios, píldora, grosores
// de borde/divisor, trazo de ícono—; no hay editor libre. La forma vive en `content.tema.forma`
// (tercera clave del tema, junto a las 3 raíces de paleta y `fuentePar`), y de ella salen las vars que
// el `<style>` del layout del storefront inyecta (§ forma-style, gemelo de fuentes-style).
//
// NULL = SUAVE (el default), como null en `fuentePar` = Editorial y null en las raíces = fábrica: sin
// override, las utilidades de radio caen a su valor de HOY. Por eso `suave` NUNCA se guarda: el picker
// manda `null` para Suave (§ resolverForma), y sin `<style>` `--radius-3xl/2xl/xl` quedan en los
// defaults de Tailwind v4 (1.5rem/1rem/0.75rem) → Nayoli byte-idéntico.
//
// LOS NOMBRES esquivan a propósito los del set de fuentes (Editorial/Cálido/Moderno/…): dos ejes con la
// misma etiqueta y distinto default serían una trampa en el picker.
//
// SUAVE VA EN REM con los valores EXACTOS de hoy (radios 1.5/1/0.75rem), no en px: a root 16px son
// idénticos, pero en rem la identidad byte-a-byte es literal y no depende de que nadie cambie el root.
// Recta y Mínima van en las unidades que su diseño pide.
//
// LO QUE ESTA MITAD CONECTA vs LO QUE QUEDA INERTE: sólo `--radius-3xl/2xl/xl` los LEE algo hoy —en
// Tailwind v4 `rounded-2xl` compila a `var(--radius-2xl)`, así que overridearlos mueve el radio de las
// tarjetas del storefront con CERO cambio de JSX—. Los demás tokens (`--sf-radio-lg`, `--sf-pildora`,
// `--sf-borde`, `--sf-divisor`, `--sf-trazo`) se emiten pero quedan INERTES: nadie los lee todavía; los
// cablea la segunda mitad (el swap de píldoras, el escalón `rounded-lg`, bordes/divisores, el trazo de
// ícono y el badge). Se emiten igual para que esa mitad sea puro cableado de superficie.
//
// `badgeCaja`/`badgeTracking` (§ eje 4, REMATE 1) son los dos últimos: la FORMA del badge (píldora) la
// cableó B2 vía `.sf-pildora`; la TIPOGRAFÍA (versalitas + tracking) no tenía mecanismo hasta acá.
// Suave = `none`/`normal` (byte-idéntico); van SÓLO en `.sf-badge` (globals.css), sólo sobre etiquetas
// de estado (product.badge, "Más Popular") — nunca en un chip/control.
//
// SOMBRAS FUERA en v1 (decisión del owner): no hay `--sf-sombra`. Las tres personalidades funcionan sin
// ella; entra cuando una la necesite.
//
// PURO / client-safe: sin red, sin `server-only`. Lo consumen `forma-style` (el `<style>` del server),
// el layout del storefront (via forma-style) y el picker del panel (`PaletaSeccion`).

// El tuple runtime del set cerrado — para el `z.enum` del schema del PUT (una sola fuente con el tipo).
export const CLAVES_FORMAS = ['suave', 'recta', 'minima'] as const;
export type ClaveForma = (typeof CLAVES_FORMAS)[number];

export interface Forma {
  clave: ClaveForma;
  label: string;
  descripcion: string;
  // Los TRES escalones var-backed de Tailwind v4 (`rounded-3xl/2xl/xl` → `var(--radius-*)`). LEÍDOS hoy.
  radius3xl: string;
  radius2xl: string;
  radiusXl: string;
  // Tokens PROPIOS del storefront, INERTES en esta mitad (los cablea la segunda):
  radioLg: string;   // --sf-radio-lg  (el escalón `lg`, p. ej. las fotos)
  pildora: string;   // --sf-pildora   (el radio de las píldoras)
  borde: string;     // --sf-borde     (grosor del borde)
  divisor: string;   // --sf-divisor   (grosor del divisor de banda)
  trazo: string;     // --sf-trazo     (stroke-width del ícono; unitless)
  // Tipografía del BADGE (§ eje 4, remate 1). SÓLO etiquetas —product.badge, "Más Popular"—,
  // nunca un chip/control (§ .sf-badge en globals.css). Suave = caja natural sin tracking
  // (byte-idéntica a hoy); Recta/Mínima = versalitas con distinto tracking.
  badgeCaja: string;      // --sf-badge-caja      (text-transform del badge)
  badgeTracking: string;  // --sf-badge-tracking  (letter-spacing del badge)
}

// El registro. `suave` va PRIMERO (es el default) y su muestra en el picker representa "la de hoy".
export const FORMAS: readonly Forma[] = [
  {
    clave: 'suave', label: 'Suave',
    descripcion: 'La de Nayoli. Píldoras, esquinas generosas, hairline crema, trazo lleno.',
    // Los valores EXACTOS de hoy, en REM (byte-idéntico: = los defaults de Tailwind v4). Suave es null y
    // NUNCA se guarda, así que estos valores NO se emiten en un <style>; existen para el picker y el test.
    radius3xl: '1.5rem', radius2xl: '1rem', radiusXl: '0.75rem',
    radioLg: '0.75rem', pildora: '9999px', borde: '1px', divisor: '1px', trazo: '2',
    badgeCaja: 'none', badgeTracking: 'normal',
  },
  {
    clave: 'recta', label: 'Recta',
    descripcion: 'Esquina viva y regla tipográfica.',
    radius3xl: '0', radius2xl: '0', radiusXl: '0',
    radioLg: '2px', pildora: '0', borde: '1.5px', divisor: '1px', trazo: '1.25',
    badgeCaja: 'uppercase', badgeTracking: '0.12em',
  },
  {
    clave: 'minima', label: 'Mínima',
    descripcion: 'Radio corto y parejo, sin divisores de banda.',
    radius3xl: '10px', radius2xl: '8px', radiusXl: '6px',
    radioLg: '6px', pildora: '8px', borde: '1px', divisor: '0', trazo: '1.5',
    badgeCaja: 'uppercase', badgeTracking: '0.05em',
  },
] as const;

const POR_CLAVE = new Map(FORMAS.map((f) => [f.clave, f]));

/** El default (Suave): lo que representa `forma === null`. */
export const FORMA_DEFECTO = POR_CLAVE.get('suave')!;

/** Las formas CUSTOM (todo menos el default). Una `forma` guardada sólo puede ser una de éstas. */
const CLAVES_CUSTOM = new Set<string>(['recta', 'minima']);

/**
 * Normaliza la `forma` guardada a una clave CUSTOM válida, o `null` (= Suave, el default).
 * `null`, `'suave'`, o cualquier basura → `null`: Suave nunca se guarda (el default es "sin override"),
 * igual que `fuentePar` en null = Editorial. Defensa del loader SOFT (§ resolverTema).
 */
export function resolverForma(v: unknown): ClaveForma | null {
  return typeof v === 'string' && CLAVES_CUSTOM.has(v) ? (v as ClaveForma) : null;
}

/** La forma resuelta (la CUSTOM guardada, o el default Suave). Nunca null. */
export function formaDeForma(forma: ClaveForma | null): Forma {
  return (forma && POR_CLAVE.get(forma)) || FORMA_DEFECTO;
}

/**
 * Las vars de forma para un `style` INLINE (la vista previa del panel, que no pasa por el `<style>`
 * server de cssForma). Suave/null → `{}`: sin override, las utilidades de radio caen a su valor de hoy
 * (Tailwind v4). Una forma CUSTOM → las 10 vars (las 3 leídas + las 5 de superficie + las 2 de badge,
 * para que preview y `<style>` no puedan divergir; § el test de consistencia). Gemelo de `varsDeFuentePar`.
 */
export function varsDeForma(forma: ClaveForma | null): Record<string, string> {
  const clave = resolverForma(forma);
  if (!clave) return {};
  const f = formaDeForma(clave);
  return {
    '--radius-3xl': f.radius3xl,
    '--radius-2xl': f.radius2xl,
    '--radius-xl': f.radiusXl,
    '--sf-radio-lg': f.radioLg,
    '--sf-pildora': f.pildora,
    '--sf-borde': f.borde,
    '--sf-divisor': f.divisor,
    '--sf-trazo': f.trazo,
    '--sf-badge-caja': f.badgeCaja,
    '--sf-badge-tracking': f.badgeTracking,
  };
}
