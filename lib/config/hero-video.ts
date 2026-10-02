// LA ELECCIÓN del hero entre el VIDEO DE ESCRITORIO y el VIDEO DE TELÉFONO (§ HERO-VIDEO-MOVIL-1).
// Puro — sin React, sin DOM— para que capa 1 lo pruebe sin montar un componente. El video de teléfono
// es un SEGUNDO archivo OPCIONAL, vertical (9:16): sin él, todo se comporta IGUAL que hoy (una sola
// fuente, un solo póster) — byte-idéntico para Nayoli y cualquier tenant que no lo cargue.
//
// EL CORTE es "pantalla angosta en orientación vertical" — relación de aspecto del viewport MENOR que
// 1 (más alto que ancho). Se expresa como UNA SOLA cadena de media feature CSS, que alimenta DOS
// mecanismos nativos distintos (§ el docstring de cabecera de HeroMedia.tsx/HeroMediaMarquesina.tsx
// para el detalle de cada uno):
//  - dentro de un `<picture>`, el navegador RE-EVALÚA `media` en cada cambio de viewport — es lo que
//    hace que el PÓSTER cambie al rotar el teléfono SIN una sola línea de JS;
//  - dentro de un `<video>`, el navegador sólo evalúa `media` en los `<source>` AL CARGAR (o al
//    llamar `.load()`) — no se re-evalúa solo al rotar, así que el VIDEO necesita un `.load()`
//    explícito disparado por un listener de `matchMedia` (JS, pero sólo para el CAMBIO post-montaje,
//    nunca para el primer pintado — el spec pide "sin JS" sólo para elegir el PÓSTER del primer
//    pintado, no para la reacción a un evento posterior como rotar el teléfono).
export const HERO_VIDEO_MOVIL_MEDIA = '(max-aspect-ratio: 1/1)';

// LA NEGACIÓN EXACTA de arriba — para el `media` de un `<link rel="preload">` del póster de
// ESCRITORIO (§ el `preload()` de `react-dom` en HeroMedia.tsx/HeroMediaMarquesina.tsx, que YA
// existía antes de este slice para priorizar la carga del póster — HERO-VIDEO-POSTER-PRIORIDAD-1).
// Ese `preload()` es un MECANISMO DISTINTO del `<picture>`/`<video><source>` (es un `<link>`, no un
// hijo de un elemento de media) y por eso tiene que declarar su PROPIO `media` para no romper
// "nunca se descargan los dos": sin esto, el preload del póster de escritorio se dispararía SIEMPRE,
// incluso en un teléfono angosto donde el `<picture>` ya eligió el póster de teléfono — midiéndolo
// se encontró exactamente este defecto (§ HERO-VIDEO-MOVIL-1, el cierre del slice). `not (…)` es
// sintaxis de media query válida y estándar — niega la condición completa, sin el solapamiento que
// tendría usar `(min-aspect-ratio: 1/1)` (que matchea TAMBIÉN el caso límite aspecto=1, el mismo
// que `HERO_VIDEO_MOVIL_MEDIA` ya cubre).
export const HERO_VIDEO_ESCRITORIO_MEDIA = `not ${HERO_VIDEO_MOVIL_MEDIA}`;

/** La forma mínima que esta capa necesita del hero — un subconjunto de `HeroContent`
 *  (site-content-defaults.ts). */
export interface HeroVideoFuentes {
  imagen: string;
  imagenPoster: string;
  imagenMovil?: string;
  imagenMovilPoster?: string;
}

/**
 * `true` si el hero declaró un video de teléfono USABLE — string no vacío tras `trim()`. Un
 * `imagenMovil` en blanco (sólo espacios) se trata como ausente, el mismo criterio que el resto de
 * los campos opcionales del modelo (§ site-content-defaults.ts, "la frontera fina de
 * defaults-como-fallback").
 */
export function tieneVideoMovil(hero: Pick<HeroVideoFuentes, 'imagenMovil'>): boolean {
  return !!(hero.imagenMovil && hero.imagenMovil.trim() !== '');
}

/** Una fuente de `<source>`: la URL y, si corresponde, el media query que la activa. La ÚLTIMA
 *  fuente de la lista NUNCA lleva `media` — es el comodín al que el navegador cae si ninguna de las
 *  anteriores matchea (el mismo rol que la rama `else` de un switch, o la ausencia de `media` en el
 *  `<img>` de respaldo de un `<picture>`). */
export interface FuenteMedia {
  src: string;
  media?: string;
}

/**
 * Las fuentes de VIDEO, en el ORDEN en que el navegador debe evaluarlas dentro de `<video>`: el
 * source MÓVIL primero —con `media`, sólo si `tieneVideoMovil`— y el de ESCRITORIO al final, SIN
 * `media` (comodín, siempre matchea). Sin video móvil: UNA sola fuente, el comodín — equivalente a
 * `src={hero.imagen}` directo; el componente decide si usa `<source>` o el atributo `src` (§ el
 * docstring de cabecera de HeroMedia.tsx: la rama "sin movil" sigue usando `src=` directo para no
 * cambiar un solo byte del DOM de hoy).
 */
export function fuentesVideoHero(hero: HeroVideoFuentes): FuenteMedia[] {
  const fuentes: FuenteMedia[] = [];
  if (tieneVideoMovil(hero)) fuentes.push({ src: hero.imagenMovil!, media: HERO_VIDEO_MOVIL_MEDIA });
  fuentes.push({ src: hero.imagen });
  return fuentes;
}

/**
 * El póster del video de TELÉFONO, con fallback al de escritorio si no se cargó uno propio — dato
 * SOFT: el `.refine()` del schema (site-content-schema.ts) exige el par al ESCRIBIR, pero el
 * resolver nunca valida, así que esta función se defiende de una fila escrita por otro camino (una
 * corrección a mano, un runbook — § el mismo argumento que ya motiva el `.refine()` del video de
 * escritorio). Sólo tiene sentido llamarla cuando `tieneVideoMovil(hero)` es `true`; con eso ya
 * garantizado, el llamador no necesita volver a chequear antes de leer el resultado.
 */
export function posterVideoMovil(hero: HeroVideoFuentes): string {
  return hero.imagenMovilPoster && hero.imagenMovilPoster.trim() !== ''
    ? hero.imagenMovilPoster
    : hero.imagenPoster;
}
