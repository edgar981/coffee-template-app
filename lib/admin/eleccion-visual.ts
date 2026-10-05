// LA ELECCIÓN VISUAL (§ EDITOR-PANEL-CONTROLES-1): reemplaza al `.duna-switch` para los rasgos de
// ASPECTO del editor — dos o tres opciones lado a lado, cada una con una miniatura dibujada, en vez
// de un ON/OFF abstracto (pedido del owner: "el panel debería sentirse más interactivo... no solo
// activo desactivo, prendo apago"). Este archivo es la parte PURA — sin React, sin DOM — del teclado
// del grupo de radios (`role="radiogroup"`, § WAI-ARIA): el roving-tabindex con flechas se prueba sin
// montar nada; `components/admin/editor/EleccionVisual.tsx` sólo la USA.
//
// Mismo criterio que `recorrido-editor.ts`/`editor-iframe.ts`: la aritmética de índices es donde vive
// el defecto (un wrap-around mal calculado deja una opción inalcanzable con teclado), así que es lo
// que se afirma en el carril, no la forma del JSX.

/** Las teclas que mueven la elección dentro de un grupo de radios — Flechas en las CUATRO direcciones
 *  (una fila de opciones puede envolver en angosto, así que Arriba/Abajo también mueven) + Home/End
 *  para saltar a los extremos. Cualquier otra tecla no es asunto de este módulo. */
export type TeclaEleccion = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';

const TECLAS_ELECCION: readonly TeclaEleccion[] = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];

export function esTeclaDeEleccion(tecla: string): tecla is TeclaEleccion {
  return (TECLAS_ELECCION as readonly string[]).includes(tecla);
}

/** El índice siguiente dado el actual, el total de opciones y la tecla presionada. `null` cuando no
 *  hay opciones (un grupo vacío no tiene "siguiente") — nunca se afirma un índice fuera de rango.
 *  Derecha/Abajo avanza; Izquierda/Arriba retrocede; las dos envuelven (la última Derecha desde la
 *  última opción vuelve a la primera, y viceversa) — así ninguna opción queda fuera de alcance del
 *  teclado sin importar desde cuál se arranque. */
export function siguienteIndiceEleccion(actual: number, total: number, tecla: TeclaEleccion): number | null {
  if (total <= 0) return null;
  if (tecla === 'Home') return 0;
  if (tecla === 'End') return total - 1;
  if (tecla === 'ArrowRight' || tecla === 'ArrowDown') return (actual + 1) % total;
  // ArrowLeft / ArrowUp
  return (actual - 1 + total) % total;
}

/** El índice de la opción cuyo `value` coincide con el valor actual del campo. `0` si ninguna
 *  coincide (un valor legado que ya no existe en la lista) — nunca `-1`: un índice negativo rompería
 *  tanto el roving-tabindex (ningún botón quedaría con `tabIndex=0`) como la aritmética de arriba. */
export function indiceDeValor(opciones: readonly { value: string }[], valor: string): number {
  const i = opciones.findIndex((o) => o.value === valor);
  return i === -1 ? 0 : i;
}
