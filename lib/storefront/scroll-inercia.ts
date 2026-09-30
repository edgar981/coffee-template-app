// lib/storefront/scroll-inercia.ts — § SCROLL-INERCIA-CORTE-1
//
// EL MECANISMO — un PORT literal de `initSmoothScroll`/`scrollToY` del prototipo
// (`docs/prototipos/cafeone/js/app.js:209-244`): amortigua el scroll de rueda tipo Lenis (la rueda
// mueve un OBJETIVO, la posición REAL lo persigue con un paso de interpolación, frame a frame) en
// vez de saltar de golpe por el delta nativo del navegador. Es la PIEZA PURA — el paso de
// interpolación, el tope del documento y la condición de salida — que `ScrollInercia.tsx` (el
// componente cliente) envuelve con `window`/`requestAnimationFrame`/los listeners reales. Se separa
// así por el criterio de siempre del repo: la lógica que tiene un defecto que afirmar vive en una
// función que un test puede llamar sin DOM; el componente es el envoltorio delgado.
//
// LOS DOS NÚMEROS SON LOS DEL PROTOTIPO, NO INVENTADOS: `0.12` (`js/app.js:223`, el paso de
// amortiguación) y `0.4` (`js/app.js:224`, el umbral de asentamiento en píxeles). Copiarlos es lo que
// hace que "nuestro vs prototipo" sea la MISMA curva — cambiar cualquiera de los dos cambia cuán
// fluido o cuán pegajoso se siente el scroll, y el spec pide igualar el muestrario, no inventar uno
// propio.
//
// LO QUE ESTE ARCHIVO **NO** DECIDE: si el mecanismo se monta o no (eso es `corteAplicado`,
// `lib/config/themes.ts` — sólo CORTE lo enciende) y si el visitante tiene `pointer:coarse` o
// `prefers-reduced-motion` (eso lo mide `ScrollInercia.tsx` con `matchMedia`, DOM real que este
// archivo no toca). Este archivo sólo sabe: dado un estado y un evento, ¿cuál es el próximo paso?

/** El paso de amortiguación — `js/app.js:223`. Más alto = alcanza el objetivo más rápido (menos
 *  inercia); más bajo = más "pegajoso". */
export const PASO_INERCIA = 0.12;

/** El umbral de asentamiento, en píxeles — `js/app.js:224`. Por debajo de esta distancia al
 *  objetivo, el loop de animación se considera terminado y salta al valor exacto. */
export const UMBRAL_ASENTAMIENTO = 0.4;

/**
 * Un paso de interpolación hacia el objetivo — la MISMA fórmula que `js/app.js:223`
 * (`current += (target - current) * 0.12`), re-escrita para no mutar sus argumentos (el componente
 * es quien lleva el estado mutable, frame a frame).
 */
export function pasoInercia(actual: number, objetivo: number, paso: number = PASO_INERCIA): number {
  return actual + (objetivo - actual) * paso;
}

/**
 * ¿La posición ACTUAL ya está lo bastante cerca del OBJETIVO como para dejar de animar? Estricta
 * (`<`, no `<=`) — igual que `js/app.js:224` (`Math.abs(target - current) < 0.4`): a exactamente el
 * umbral, un frame más de animación es indetectable, así que la igualdad no corta el loop antes de
 * tiempo.
 */
export function seAsento(actual: number, objetivo: number, umbral: number = UMBRAL_ASENTAMIENTO): boolean {
  return Math.abs(objetivo - actual) < umbral;
}

/**
 * El tope de scroll del documento — alto total del documento menos el alto del viewport
 * (`js/app.js:220`, `function max()`). Nunca negativo: un documento más corto que el viewport (una
 * página sin scroll) no puede tener un objetivo por debajo de 0.
 */
export function limiteScroll(alturaDocumento: number, altoViewport: number): number {
  return Math.max(0, alturaDocumento - altoViewport);
}

/**
 * El nuevo OBJETIVO tras un evento de rueda — `js/app.js:232`
 * (`target = Math.max(0, Math.min(max(), target + e.deltaY))`): el delta se ACUMULA sobre el
 * objetivo previo (no sobre la posición actual, que puede seguir en vuelo), acotado a
 * `[0, limite]` para que un scroll rápido nunca empuje el objetivo fuera del documento.
 */
export function objetivoTrasRueda(objetivoPrevio: number, deltaY: number, limite: number): number {
  return Math.max(0, Math.min(limite, objetivoPrevio + deltaY));
}

export interface CondicionesEntorno {
  /** `matchMedia('(prefers-reduced-motion: reduce)').matches` */
  movimientoReducido: boolean;
  /** `matchMedia('(pointer: coarse)').matches` — táctil. */
  punteroGrueso: boolean;
}

/**
 * ¿Este visitante debe quedarse en scroll NATIVO, sin que el componente adjunte NINGÚN listener de
 * rueda? Las DOS salidas del prototipo (`js/app.js:210-214`): movimiento reducido (el mecanismo se
 * OMITE entero, ni siquiera el `scroll-behavior:smooth` de abajo) y puntero grueso/táctil (cae al
 * scroll suave NATIVO del navegador, sin JS por rueda — un dedo no dispara `wheel`, así que
 * amortiguar rueda no tiene sentido en táctil).
 */
export function debeUsarScrollNativo(c: CondicionesEntorno): boolean {
  return c.movimientoReducido || c.punteroGrueso;
}

export interface CondicionesRueda {
  /** `WheelEvent.ctrlKey` — trackpad pellizcando para hacer zoom del navegador. */
  ctrlKey: boolean;
  /** ¿Hay un modal/drawer que bloquea el scroll de la página (`js/app.js:229`,
   *  `document.body.classList.contains('is-locked')` en el prototipo; en este storefront la única
   *  señal real es `document.body.style.overflow === 'hidden'`, que pone
   *  `VistaRapidaProducto.tsx` — § el censo de scroll-lock en ese archivo, `CartDrawer.tsx`/
   *  `NavSearch.tsx` NO bloquean)? */
  cuerpoBloqueado: boolean;
  /** El delta horizontal del evento — un gesto de trackpad predominantemente horizontal (el track
   *  del riel, § `GrindChooserRiel.tsx`) no es un gesto de scroll de PÁGINA. El prototipo no
   *  necesitaba esta salida (nunca ejercita un track horizontal bajo el mismo `window`), pero este
   *  storefront sí. */
  deltaX: number;
  deltaY: number;
  /** ¿El evento nace dentro de un elemento con SU PROPIO scroll vertical con contenido real para
   *  desplazar (el cuerpo del carrito, la vista rápida, el menú móvil, cualquier
   *  `overflow-y:auto|scroll` — § el DOM walk de `ScrollInercia.tsx`)? Mismo motivo que `deltaX`
   *  arriba: capacidad que el prototipo no necesitaba ejercitar bajo el mismo mecanismo global. */
  dentroDeScrollPropio: boolean;
}

/**
 * ¿Este evento de rueda debe interceptarse para mover la PÁGINA con inercia? `false` en las MISMAS
 * dos salidas del prototipo (`ctrlKey`, `js/app.js:230`; cuerpo bloqueado, `:229`) MÁS las dos
 * salidas que este storefront necesita y el prototipo no (gesto predominantemente horizontal;
 * target dentro de un scroll propio) — ver `CondicionesRueda` arriba para el porqué de cada una.
 */
export function debeInterceptarRueda(c: CondicionesRueda): boolean {
  if (c.ctrlKey) return false;
  if (c.cuerpoBloqueado) return false;
  if (c.dentroDeScrollPropio) return false;
  if (Math.abs(c.deltaX) > Math.abs(c.deltaY)) return false;
  return true;
}
