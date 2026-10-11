// lib/storefront/barra-fija.ts — § ONIX-BARRA-FLOTANTE-MOVIL-1
//
// LA REGLA DE VISIBILIDAD de la barra flotante de compra del celular (/tienda, /suscripciones).
// Gate del owner, con captura de /tienda en su propio celular: «The section with the "agregar"
// button still seems to me that has a bug. It shows and dissappear when I scroll down or up, with
// no pattern.» La causa: el mecanismo de ANTES (`IntersectionObserver` + `!entry.isIntersecting`,
// § TiendaTaquilla.tsx/SuscripcionTaquilla.tsx previos a este slice) trataba "el botón no está
// intersectando el viewport" como un solo caso — pero "fuera de pantalla" cubre DOS situaciones
// opuestas: todavía no llegué (el botón está MÁS ABAJO) y ya pasé (el botón quedó MÁS ARRIBA). Sólo
// la segunda debe mostrar la barra; la primera es exactamente la ventana (0–600px de scroll en el
// demo medido por el orquestador, 390×844) donde la barra aparecía sin que el visitante hubiera
// llegado al botón todavía.
//
// PURA — recibe la caja del botón de compra (`top`/`bottom`, relativos al viewport: lo que da
// `getBoundingClientRect()`) y el alto de pantalla; NUNCA toca el DOM. El componente
// (`TiendaTaquilla.tsx`/`SuscripcionTaquilla.tsx`) es quien mide con `getBoundingClientRect()` en
// cada scroll/resize y llama a esta función — mismo criterio que `destacado-cruce.ts`: la decisión
// se afirma con un test de `node:test`, el DOM se deja fuera de este archivo.
export interface CajaBotonCompra {
  readonly top: number;
  readonly bottom: number;
}

// El margen de histéresis (§ cifras-decision del spec, 16). Sin él, un `bottom` que oscila a un
// lado y otro de 0 —un redondeo de sub-píxel, un reflow al cargar una fuente— hace que la barra
// aparezca y desaparezca en el mismo tramo de scroll: el "parpadea sin patrón" que el gate reporta.
// Con el margen, la barra sólo CAMBIA de estado cuando el botón cruza GENUINAMENTE más allá de él;
// dentro de la franja (-margen, 0] conserva el estado que ya tenía (`visibleAntes`).
export const MARGEN_HISTERESIS_BARRA_FIJA_PX = 16;

/**
 * Decide si la barra flotante debe mostrarse, dada la caja del botón de compra de la página.
 *
 * Tres zonas, en el orden en que se evalúan:
 *  1. El botón está EN PANTALLA (`top < alturaPantalla && bottom > 0`) → oculta, SIEMPRE — no hay
 *     histéresis que aplicar acá: mientras una parte del botón se ve, no hay ambigüedad posible.
 *  2. Todavía no se llegó al botón (`top >= alturaPantalla`) → oculta, SIEMPRE — el caso que el
 *     `IntersectionObserver` viejo confundía con "ya pasé".
 *  3. El botón ya quedó arriba de la pantalla (`bottom <= 0`, y ninguna de las dos de arriba
 *     aplica) → visible si `bottom` cruzó más allá del margen; si está DENTRO de la franja de
 *     histéresis, conserva `visibleAntes` sin titilar.
 */
export function visibilidadBarraFija(
  boton: CajaBotonCompra,
  alturaPantalla: number,
  visibleAntes: boolean,
  margen: number = MARGEN_HISTERESIS_BARRA_FIJA_PX,
): boolean {
  const botonEnPantalla = boton.top < alturaPantalla && boton.bottom > 0;
  if (botonEnPantalla) return false;
  if (boton.top >= alturaPantalla) return false; // antes de llegar al botón
  // Acá: boton.bottom <= 0 — el botón ya pasó arriba de la pantalla.
  if (boton.bottom <= -margen) return true;
  return visibleAntes; // franja de histéresis: conserva el estado anterior
}

// La duración de la transición de entrada/salida de la barra, Y la del desplazamiento de BackToTop
// cuando la barra aparece/desaparece — "con la misma transición" (§ el spec, item 4). En SEGUNDOS
// porque es lo que espera `transition.duration` de framer-motion, el canal que ya respeta
// `ReducedMotionProvider`/`MotionConfig reducedMotion="user"` (§ el docstring de cabecera de
// `BackToTop.tsx`) — una sola constante para que Tienda, Suscripción y BackToTop no puedan divergir
// en la duración (§ cifras-decision del spec, 250).
export const DURACION_BARRA_FIJA_S = 0.25;

// El nombre de la variable CSS que la barra publica en `<html>` con su alto VISIBLE (§ el spec,
// item 4: "la barra publica su alto visible... y BackToTop la suma a su bottom"). `0px` cuando no
// hay barra visible en la página; su alto real (card + el espacio que la separa del borde) cuando
// sí la hay. Una sola constante para que las DOS taquillas (que nunca están montadas a la vez —
// son páginas distintas) y `BackToTop` no puedan escribir/leer nombres distintos del mismo dato,
// la misma clase de divergencia que ya mordió a `razonDelServidor`/`cruzoMinimo` en este repo.
export const VAR_ALTO_BARRA_FIJA = '--onix-barra-fija-alto';

/** El valor a publicar en `VAR_ALTO_BARRA_FIJA`: `0px` oculta, el alto real (clamp a 0) visible. */
export function altoPublicadoBarraFija(visible: boolean, altoPx: number): string {
  return visible ? `${Math.max(0, altoPx)}px` : '0px';
}
