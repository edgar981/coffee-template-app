// EL ANCHO DEL PANEL del editor de tienda (§ EDITOR-PANEL-ANCHO-1). Datos PUROS — sin React, sin
// DOM, sin `localStorage` directo — mismo criterio que `editor-iframe.ts`/`recorrido-editor.ts`: el
// cálculo de límites y pasos se prueba sin montar nada; el componente (`TiendaPaginas.tsx`) lee/
// escribe el storage (envuelto en `try/catch`, mismo patrón que `dispositivoDesdeStorage`) y llama
// a estas funciones para decidir el valor.
//
// Pedido del owner (2026-10-05, revisando el editor): "El ancho del side debería ser variable como
// hace vercel con el suyo… La zona de editar está muy angosta por eso creo que necesitamos que sea
// ajustable ese side".

/** El ancho con el que el panel nace — el de siempre (§ EDITOR-VISUAL-MARCO-1, "Panel (308 px)"),
 *  calcado del prototipo. Es también el valor al que vuelve un doble clic / Enter en la manija. */
export const ANCHO_PANEL_DEFECTO = 308;

/** Por debajo de esto el panel deja de ser legible: dos columnas ya cortan el texto a 308px
 *  (§ EDITOR-VISUAL-PANEL-1), así que achicar más sólo empeora un caso que el sistema ya resolvió
 *  yendo a una sola columna, nunca lo arregla. */
export const ANCHO_PANEL_MIN = 280;

/** El tope ABSOLUTO, independiente de la ventana — un panel más ancho que esto empieza a competir
 *  con el lienzo por ser "la" columna principal, que es justo lo que el rediseño de EDITOR-VISUAL-
 *  MARCO-1 quitó al pasar de 1fr elástico a un ancho fijo. */
export const ANCHO_PANEL_MAX = 640;

/** El panel nunca se come más del 60% del ancho de la ventana — el lienzo de la tienda real
 *  necesita quedar siempre más ancho que el panel que lo edita, o la vista en vivo deja de ser
 *  útil como vista. */
export const ANCHO_PANEL_MAX_FRACCION_VENTANA = 0.6;

/** El paso de cada flecha de teclado sobre la manija (§ el spec, "las flechas izquierda/derecha lo
 *  mueven de a 16px"). */
export const PASO_TECLADO_ANCHO_PANEL = 16;

/** La clave de `localStorage` donde se recuerda el ancho elegido, por navegador — mismo patrón que
 *  `CLAVE_DISPOSITIVO_EDITOR` (`editor-iframe.ts`). */
export const CLAVE_ANCHO_PANEL = 'admin:editor-tienda:ancho-panel';

/**
 * El máximo VIGENTE para una ventana de este ancho: el menor entre el tope absoluto (640) y el 60%
 * del ancho de la ventana. `anchoVentana <= 0` es "todavía no medido" (antes del primer efecto que
 * lee `window.innerWidth` — mismo caso que ya documenta `calcularEscalaDispositivo`): se trata como
 * "sin restricción de ventana", cayendo al tope absoluto, para que el primer paint no recorte contra
 * una medida de 0.
 */
export function anchoPanelMaximo(anchoVentana: number): number {
  if (!(anchoVentana > 0)) return ANCHO_PANEL_MAX;
  return Math.min(ANCHO_PANEL_MAX, Math.round(anchoVentana * ANCHO_PANEL_MAX_FRACCION_VENTANA));
}

/**
 * Recorta un ancho propuesto a los límites vigentes para esa ventana. El MÍNIMO (280) siempre gana
 * sobre el máximo vigente si una ventana angostísima los cruzara (`Math.max(ANCHO_PANEL_MIN, …)`):
 * el panel no se angosta más allá de lo legible por el 60% de una ventana muy chica — ese caso ya
 * cae bajo el umbral de `useSheetDesdeAbajo`, donde el editor apila y no hay manija que mostrar.
 *
 * Un `ancho` no finito (NaN, Infinity — un valor guardado corrupto que `anchoPanelDesdeStorage` ya
 * debería haber atajado, pero esta función no confía en su llamador) cae al DEFECTO, nunca a un
 * ancho inventado por la aritmética del clamp.
 */
export function clampAnchoPanel(ancho: number, anchoVentana: number): number {
  if (!Number.isFinite(ancho)) return ANCHO_PANEL_DEFECTO;
  const techo = Math.max(ANCHO_PANEL_MIN, anchoPanelMaximo(anchoVentana));
  return Math.min(Math.max(ancho, ANCHO_PANEL_MIN), techo);
}

/**
 * El valor guardado en `localStorage` puede ser basura, otra versión, o `null` (nunca se guardó).
 * Sólo un número finito y positivo cuenta como un ancho elegido alguna vez — cualquier otra cosa
 * cae al DEFECTO, nunca a un ancho inventado (mismo criterio que `dispositivoDesdeStorage`).
 *
 * NO recorta a los límites vigentes: el recorte depende del ancho de VENTANA actual, que esta
 * función no conoce — eso lo hace el llamador con `clampAnchoPanel`, cada vez que lo necesita (así
 * la preferencia guardada sobrevive a una ventana angosta momentánea, § el spec: "no se pierde:
 * vuelve si la ventana crece").
 */
export function anchoPanelDesdeStorage(valor: string | null): number {
  if (valor === null) return ANCHO_PANEL_DEFECTO;
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : ANCHO_PANEL_DEFECTO;
}

/**
 * El próximo ancho tras una flecha de teclado sobre la manija: izquierda angosta, derecha
 * ensancha, de a `PASO_TECLADO_ANCHO_PANEL` (16px) — ya recortado a los límites vigentes de la
 * ventana actual, así que una flecha repetida en el borde no hace nada (misma referencia numérica
 * que el clamp ya daría, no un valor que se pase de largo).
 */
export function siguienteAnchoPorTeclado(
  actual: number,
  tecla: 'ArrowLeft' | 'ArrowRight',
  anchoVentana: number,
): number {
  const delta = tecla === 'ArrowLeft' ? -PASO_TECLADO_ANCHO_PANEL : PASO_TECLADO_ANCHO_PANEL;
  return clampAnchoPanel(actual + delta, anchoVentana);
}
