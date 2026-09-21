// LA ESCALA DE DISPLAY DE UN PRESET (§ TEMAS-ESCALA-DISPLAY-1). El prototipo (`docs/prototipos/
// cafeone/ds/typography.css:10-11`, = `css/tokens.css:99-100`) declara sus titulares de display
// FLUIDOS y ENORMES —`--text-display-xl:clamp(72px,9vw,168px)` para el titular del hero,
// `--text-display-l:clamp(48px,5vw,76px)` para los titulares de sección—, mientras que los
// nuestros son clases Tailwind FIJAS, horneadas en cada componente (`text-4xl sm:text-5xl
// lg:text-6xl` en el hero; `text-3xl sm:text-4xl`/`text-4xl sm:text-5xl`/`text-4xl` según la
// sección — medido, no uniforme entre variantes). Ver `docs/prototipos/cafeone/ds/typography.css`.
//
// MISMA FAMILIA ADITIVA que `origenTexto`/`origenAccion` (`palette-derive.ts`) y `navTinta`/
// `navSubtitulo`/`navBadge` (`site-content-defaults.ts`, `CromoContent`): AUSENTE en un preset =
// `null` = el comportamiento de HOY, byte a byte. De los seis presets del catálogo, sólo CORTE
// declara `escalaDisplay: 'amplia'` (§ themes.ts).
//
// PURO: sin prisma, sin server-only, sin React. `fontSizeDisplay` es la ÚNICA función que un
// titular de display consulta, y su contrato es lo que garantiza la invariante:
//
//   SIN escala declarada → devuelve `undefined` → el llamador NO aplica ningún `style` de
//   font-size → el elemento sigue rindiendo EXACTAMENTE su clase Tailwind de hoy (2.25rem/3rem/
//   3.75rem para `text-4xl`/`sm:text-5xl`/`lg:text-6xl`, o lo que sea la clase de esa sección/
//   variante) — nunca una réplica en CSS de esos breakpoints que pudiera desviarse un bit.
//
//   CON escala 'amplia' → devuelve el `clamp(...)` medido del prototipo, y el llamador lo aplica
//   como `style={{ fontSize: ... }}`, que por especificidad de inline-style gana sobre las clases
//   Tailwind que el elemento conserva sin tocar (no hace falta quitarlas).
//
// POR QUÉ NO ES UNA VARIABLE CSS `:root{--sf-display-xl:...}` EMITIDA DESDE EL LAYOUT (el patrón de
// `cssPaleta`/`cssFuentes`/`cssForma`): ese patrón funciona porque esos tres ejes tienen UN default
// compartido por TODO el storefront. La escala de display NO — el hero tiene TRES variantes con
// TRES tamaños de hoy distintos (`HeroCurtina` 3rem/3.75rem/4.5rem; `HeroFicha`/`HeroMedia`
// 2.25rem/3rem/3.75rem) y las secciones tienen bases distintas entre sí (`text-3xl sm:text-4xl` en
// featured/presentaciones, `text-4xl sm:text-5xl` en brandStory, `text-4xl` fijo en subscriptionCTA,
// `text-3xl` fijo en testimonials). Una sola variable `:root` con UN default por breakpoint no
// puede representar tres tamaños de HOY distintos a la vez: forzarla habría MOVIDO a HeroCurtina
// (el hero de Nayoli, canónica) al tamaño de HeroFicha/HeroMedia, o viceversa — el defecto opuesto
// al que este slice existe para evitar. Que cada llamador decida "aplico override o no" es lo que
// deja a cada variante con SU propio tamaño de hoy, intacto.
export type ClaveEscalaDisplay = 'amplia';
export const CLAVES_ESCALA_DISPLAY: readonly ClaveEscalaDisplay[] = ['amplia'];

/** El rol del titular: `'xl'` = el h1 del hero (display-xl del prototipo); `'l'` = el h2 de una
 *  banda de sección (display-l del prototipo). */
export type RolDisplay = 'xl' | 'l';

// Medido en `docs/prototipos/cafeone/ds/typography.css:10-11` (= `css/tokens.css:99-100`).
const CLAMP_XL: Record<ClaveEscalaDisplay, string> = {
  amplia: 'clamp(72px, 9vw, 168px)',
};
const CLAMP_L: Record<ClaveEscalaDisplay, string> = {
  amplia: 'clamp(48px, 5vw, 76px)',
};

/** SOFT: cualquier valor que no sea el único miembro del set cerrado (ausente, basura, un string
 *  que no es 'amplia') cae a `null` — mismo criterio que `origenTexto`/`origenAccion`. */
export function resolverEscalaDisplay(value: unknown): ClaveEscalaDisplay | null {
  return value === 'amplia' ? 'amplia' : null;
}

/**
 * El font-size de OVERRIDE para un titular de display, o `undefined` si el preset no declaró
 * escala. `undefined` es la señal para el llamador: "no toques el `style`, dejá que la clase
 * Tailwind de hoy rinda sola" — nunca una cadena vacía ni un valor que reproduzca el default,
 * porque reproducirlo en un segundo lugar es cómo dos copias divergen (§ doctrina, "cuando dos
 * declaraciones describen el mismo conjunto, o una DERIVA de la otra o hay un TEST que las ata" —
 * acá la salida es no declarar una segunda vez).
 */
export function fontSizeDisplay(escala: ClaveEscalaDisplay | null, rol: RolDisplay): string | undefined {
  if (escala === null) return undefined;
  return rol === 'xl' ? CLAMP_XL[escala] : CLAMP_L[escala];
}
