// § EDITOR-PAGINAS-ONIX-ARREGLOS-1 — T06 ("Tipografía gigante que cruza", § catalogo.ts) desliza el
// título entre `xPercent:10` y `xPercent:-40` a lo largo del scroll de la sección que lo contiene
// (`components/storefront/movimiento/animaciones.ts`, función `t06`). El `ScrollTrigger` que mide
// ese scroll usa `start:'top bottom'` por defecto —el umbral de progreso 0 es el scroll en el que el
// TOPE de la sección toca el FONDO del viewport, `seccion.top - alturaViewport`—, que es correcto
// para una sección que nace MÁS ABAJO que esa resta (todavía tiene que "entrar" desde abajo).
//
// EL DEFECTO MEDIDO (`.scratch/editor-paginas-onix-arreglos-1/`, repro con GSAP/ScrollTrigger reales,
// sin DB/`.env`): para una sección que nace AL TOPE del documento —la Apertura de /tienda, /nosotros,
// /suscripciones: es la PRIMERA banda de cada página— ese umbral es NEGATIVO (un scroll que no
// existe, porque la página nunca scrollea antes de 0). A scroll real 0 el progreso ya está muy por
// encima de 0 (medido: 0.22–0.42 según el alto de la apertura y el viewport) — el título arranca a
// mitad de camino en vez de en su posición de diseño (`xPercent:10`, "doesn't start in a right
// position", el reporte del owner), y el tramo final (`xPercent:-40`, "ends like it was cut") se
// alcanza bastante antes de que la sección termine de salir de la pantalla.
//
// `'top top'` (progreso 0 cuando el TOPE de la sección toca el TOPE del viewport) ancla el progreso
// 0 exactamente a scroll 0 cuando la sección nace en el tope — el caso real de la Apertura—, medido
// que da `progress=0, xPercent=10` en los CUATRO escenarios (85vh/70svh × escritorio/celular). Para
// una sección que nace más abajo (Banner.tsx/ImagenTexto.tsx, los otros dos consumidores de
// `.sf-movimiento-gigante`, § el censo por grep en el asiento de DECISIONS.md), el umbral de
// `'top bottom'` sigue siendo POSITIVO, así que sigue usándose sin cambio — medido que el resultado
// es idéntico a antes del fix (`'top bottom'`, progreso 0 mientras la sección no ha empezado a
// entrar).
//
// PURO: sin DOM. El llamador (`animaciones.ts`) mide `topDocumento`/`alturaViewport` con
// `getBoundingClientRect()`/`window.innerHeight` y le pasa los dos números a esta función — la
// DECISIÓN (qué `start` usar) se separa de la MEDICIÓN para poder afirmarla en un test en memoria.

/** `true` si el umbral de progreso 0 de `start:'top bottom'` (`topDocumento - alturaViewport`) es
 *  un scroll NEGATIVO — inalcanzable, porque la página nunca puede scrollear antes de 0. */
export function inicioCruceInalcanzable(topDocumento: number, alturaViewport: number): boolean {
  return topDocumento - alturaViewport < 0;
}

/** El `start` del `ScrollTrigger` de T06 para una sección cuyo tope (documento) está en
 *  `topDocumento`, medido contra un viewport de `alturaViewport`. `'top top'` para una sección que
 *  nace al tope del documento (el umbral de `'top bottom'` sería inalcanzable); `'top bottom'`
 *  —el de siempre— para cualquier otra, sin cambio de comportamiento. */
export function startCruceGigante(topDocumento: number, alturaViewport: number): 'top top' | 'top bottom' {
  return inicioCruceInalcanzable(topDocumento, alturaViewport) ? 'top top' : 'top bottom';
}
