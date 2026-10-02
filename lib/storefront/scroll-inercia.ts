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

// ── LA RESTAURACIÓN DE SCROLL AL RECARGAR — § SUSCRIPCION-TITULO-Y-RECARGA-1 ──────────────────────
//
// EL REPORTE DEL OWNER, LITERAL: *"revisa el recargar de la página, siempre me lleva al centro de la
// página luego de haber recargado… siempre luego de recargar la página se ubica sobre las fotos de:
// Nuestra Historia"*.
//
// LA CAUSA, MEDIDA (Playwright, `.arnes-tooling/playwright`, contra el muestrario desplegado Y contra
// un build local, § el asiento de este slice en `DECISIONS.md` para la tabla completa): es un defecto
// de **Chromium**, no de este código — WebKit restaura el `scrollY` exacto en los TRES casos medidos
// (arriba, a mitad, al fondo); Chromium lo CLAMPEA contra el alto del documento que tiene disponible
// en el instante en que decide restaurar, y esa restauración ocurre ANTES de que el storefront
// termine de montar — medido: `document.documentElement.scrollHeight` pasa por 900px (recién
// empezando a cargar) → ~4.750px → ~6.300px (asentado) en una ventana de 0.3 a 3s, tanto contra el
// despliegue real como en local. Como `html{scroll-behavior:smooth}` (`app/globals.css`) convierte
// cada corrección del navegador en una animación que la SIGUIENTE corrección cancela a medio camino,
// el resultado visible es la "subida trabada y luego de golpe" que el prototipo original ya describía
// para ESTE MISMO mecanismo de rueda (§ el comentario de `ScrollInercia.tsx`, "la página casi no
// bajaba y luego saltaba de golpe") — pero acá el disparador es la restauración NATIVA del navegador,
// no nuestra inercia.
//
// EL FIX NO ES "esperar a que el navegador termine": es TOMAR LA RESTAURACIÓN NOSOTROS MISMOS,
// después de confirmar que el documento dejó de crecer, y aplicarla con un salto instantáneo — el
// mismo criterio que ya usa `irA` en `ScrollInercia.tsx` para no pelear con `scroll-behavior:smooth`.
// Las piezas de acá son PURAS: la clave de almacenamiento, el parseo defensivo del valor guardado, el
// recorte al límite ACTUAL del documento, y el pequeño autómata que decide "¿ya puedo confiar en esta
// altura, o sigo esperando?" — el `window`/`sessionStorage`/`requestAnimationFrame` que los alimenta
// vive en `ScrollInercia.tsx`, igual que el resto del mecanismo de rueda.
//
// SEGUNDO CONSUMIDOR (§ EDITOR-TIENDA-POSTMESSAGE-1): `estadoInicialEstabilizacion`/
// `siguienteEstadoEstabilizacion`/`listoParaRestaurar`/`objetivoDeRestauracion` son GENÉRICAS sobre
// números (altura, reloj, scrollY) — no dependen de `sessionStorage` ni de `corteAplicado`, así que
// `VistaTiendaIframe.tsx` (admin) las reusa para el MISMO problema (un `scrollTo` disparado antes de
// que la altura del documento se estabilice) al restaurar el scroll tras recargar el iframe del
// editor — sin ese reuso, `VistaTiendaIframe` habría reimplementado el mismo autómata, y una
// divergencia entre las dos copias habría sido el próximo bug de esta familia. Si se toca la forma de
// alguna de estas cuatro funciones, revisar ese consumidor también (`npm run typecheck` ya lo
// obliga: un cambio de firma rompe su import).

/** El prefijo de la clave de `sessionStorage` — namespaced para no chocar con otra cosa que guarde
 *  bajo la misma pestaña, y para que un futuro censo de claves lo encuentre por nombre. */
export const CLAVE_SCROLL_PREFIJO = 'corte:scrollY:';

/** La clave es por RUTA (pathname): volver a `/` recuerda su posición sin pisar la de `/tienda`. */
export function claveScrollGuardado(pathname: string): string {
  return `${CLAVE_SCROLL_PREFIJO}${pathname}`;
}

/**
 * Parseo DEFENSIVO del valor crudo de `sessionStorage` — `null` (nunca se guardó nada, primera
 * visita de la pestaña a esta ruta) y cualquier basura no numérica o negativa se tratan igual: "no
 * hay nada que restaurar". Preferir callar (no restaurar) a restaurar un número inventado — mismo
 * criterio que `sugerirZona`/`Origen.tsx` ya aplican con datos que no se pueden validar.
 */
export function parsearScrollGuardado(valor: string | null): number | null {
  if (valor === null) return null;
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * El objetivo final de la restauración: el valor guardado, recortado al límite de scroll que el
 * documento tiene AHORA — nunca más allá de lo que la página puede mostrar. Reusa `limiteScroll`
 * (arriba, el mismo tope que ya usa la rueda) en vez de reimplementar el `Math.max(0, altura-vh)`.
 */
export function objetivoDeRestauracion(guardado: number, alturaDocumento: number, altoViewport: number): number {
  return Math.min(guardado, limiteScroll(alturaDocumento, altoViewport));
}

export interface EstadoEstabilizacion {
  /** La última altura de documento observada. */
  altura: number;
  /** `performance.now()` de la ÚLTIMA VEZ que la altura CAMBIÓ — no de la última lectura. */
  ultimoCambioMs: number;
}

export function estadoInicialEstabilizacion(alturaInicial: number, ahoraMs: number): EstadoEstabilizacion {
  return { altura: alturaInicial, ultimoCambioMs: ahoraMs };
}

/**
 * Un paso del autómata: una lectura más de `document.documentElement.scrollHeight`, con el reloj que
 * la acompaña. Si la altura es la MISMA, `ultimoCambioMs` NO se toca (el documento sigue quieto desde
 * entonces); si CAMBIÓ, se reinicia a `ahoraMs` — recién ahora "lleva quieto 0ms".
 *
 * ES POR TIEMPO, NO POR CONTEO DE FRAMES — y ésa es la parte que casi queda mal: la primera versión
 * de este autómata contaba LECTURAS consecutivas idénticas (3 frames ≈ 48ms a 60fps). Medido contra
 * la serie REAL (§ el docstring de arriba): la altura pasa por un PLANO INTERMEDIO —900px, luego
 * ~4.750px— que dura más que unos pocos frames (hasta ~1.5s contra el despliegue real, más lento que
 * en local) antes de llegar a su valor final. Tres frames iguales bastan para "confirmar" ese plano
 * intermedio como si fuera el final, y ahí es exactamente donde el fix fallaba: medido, restauraba
 * contra 4.750px y dejaba el reload corto en el mismo punto que el defecto original (3851px en vez
 * de los 5437px guardados). Por tiempo, el plano intermedio de ~1.5s no alcanza el umbral de abajo
 * (`MS_ALTURA_ESTABLE`, mayor a propósito) y el autómata sigue esperando hasta la altura de verdad.
 */
export function siguienteEstadoEstabilizacion(estado: EstadoEstabilizacion, alturaActual: number, ahoraMs: number): EstadoEstabilizacion {
  return alturaActual === estado.altura
    ? estado
    : { altura: alturaActual, ultimoCambioMs: ahoraMs };
}

/**
 * Milisegundos SIN que la altura cambie antes de confiar en que el documento terminó de crecer.
 * MEDIDO, no elegido a ojo: contra el despliegue real, el plano intermedio (~4.750px, antes del valor
 * final) duró hasta ~1.500ms (de t≈1.500ms a t≈3.000ms, § el asiento de este slice en
 * `DECISIONS.md`); 1.800ms deja margen sin acercarse al tope de espera de abajo.
 */
export const MS_ALTURA_ESTABLE = 1800;

/**
 * ¿Ya hay que restaurar? Dos salidas independientes: la altura lleva quieta `MS_ALTURA_ESTABLE`, O
 * se agotó el tiempo de espera total — este segundo caso es el que evita esperar PARA SIEMPRE si, por
 * lo que sea, el documento nunca deja de cambiar (una automatización futura, un layout roto): mejor
 * restaurar contra la mejor altura que se tenga que no restaurar nunca. `ahoraMs`/`inicioMs` los mide
 * el llamador (`performance.now()`), no esta función — mantiene el autómata puro, sin un reloj propio
 * que un test tendría que simular con fakes.
 */
export const MS_TOPE_ESPERA_ESTABILIZACION = 6000;

export function listoParaRestaurar(estado: EstadoEstabilizacion, ahoraMs: number, inicioMs: number): boolean {
  return (ahoraMs - estado.ultimoCambioMs) >= MS_ALTURA_ESTABLE || (ahoraMs - inicioMs) >= MS_TOPE_ESPERA_ESTABILIZACION;
}

/**
 * § RESTAURACION-CEDE-AL-USUARIO-1 — los eventos con los que el visitante toma el control del scroll.
 * Cualquiera de ellos cancela la restauración pendiente al recargar: si el visitante ya se movió, la
 * posición guardada dejó de ser la que quiere (el "rebote hacia arriba" al deslizar el riel en el
 * teléfono). `scroll` NO está: la propia restauración y el navegador también lo disparan.
 */
export const EVENTOS_QUE_CANCELAN_RESTAURACION = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
