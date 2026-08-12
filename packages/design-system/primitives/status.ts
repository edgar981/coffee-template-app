/* =============================================================================
   MODELO DE ESTADO — y la IMPOSIBILIDAD ESTRUCTURAL del "en curso" sin progreso.

   Regla del owner: el sistema NO debe permitir renderizar un estado "en curso"
   como un tono suelto. No es una convención que haya que recordar — es imposible
   de expresar. Se logra por TIPOS, en dos movimientos:

     1. La paleta de badges NO tiene un tono "en curso"/azul. `BadgeTone` solo
        admite estados en reposo (atención · ok · problema · neutro). No existe
        el valor que habría que pasar para pintar un badge azul de "En ruta".

     2. "En curso" no es un color: es una POSICIÓN en una secuencia. La única API
        que la expresa es `Progress`, que EXIGE la secuencia completa (`steps`) y
        el índice actual. No se puede construir un progreso sin sus pasos.

   Este módulo es PURO TypeScript, agnóstico de framework y de negocio: no sabe
   qué es "un pedido" ni cuáles son sus etapas. El dominio (la app) trae sus
   propias etiquetas; el sistema solo garantiza que un "en curso" nunca viaje sin
   ellas.
   ========================================================================== */

/** Tonos del semáforo que NO implican progresión. No hay "info"/azul aquí — y
 *  esa ausencia es el punto. */
export const BADGE_TONES = ['attention', 'ok', 'problem', 'neutral'] as const;
export type BadgeTone = (typeof BADGE_TONES)[number];

/** Clases utilitarias por tono. Fill/dot/borde usan --sol/--ok/--bad; el TEXTO
 *  usa la variante -ink (que pasa AA). Neutro no lleva color de estado. */
export const BADGE_TONE_CLASS: Record<BadgeTone, string> = {
  attention: 'duna-badge--attention',
  ok:        'duna-badge--ok',
  problem:   'duna-badge--problem',
  neutral:   'duna-badge--neutral',
};

/* ─────────────────────────────────────────────────────────────────────────
   PROGRESO — la ÚNICA forma de expresar "en curso".
   ───────────────────────────────────────────────────────────────────────── */

/**
 * Una progresión es una secuencia de etapas y la posición actual dentro de ella.
 * El tipo se construye con `progress(...)`, que valida que:
 *   - haya al menos dos etapas (una sola no es una secuencia), y
 *   - `current` caiga dentro de la secuencia.
 * No hay manera de tener un "current" sin las etapas: van en el mismo objeto.
 */
export interface Progress {
  readonly labels: readonly string[];
  /** Índice de la etapa actual (0-based). Las < current están "hechas". */
  readonly current: number;
  /** Etapa terminal alcanzada: no hay "ahora" que marcar (todo hecho). */
  readonly done: boolean;
}

export function progress(labels: readonly string[], current: number, done = false): Progress {
  if (labels.length < 2) {
    throw new Error('Progress exige una secuencia de al menos 2 etapas: "en curso" es una posición, no un color.');
  }
  if (current < 0 || current >= labels.length) {
    throw new Error(`current (${current}) fuera de la secuencia de ${labels.length} etapas.`);
  }
  return { labels, current, done };
}

/** Estado por segmento, para que el renderer (steps/timeline) no reimplemente la
 *  regla: pasado = done, actual = now, futuro = todo. */
export type SegmentState = 'done' | 'now' | 'todo';

export function segmentStates(p: Progress): SegmentState[] {
  return p.labels.map((_, i) => {
    if (p.done) return 'done';
    if (i < p.current) return 'done';
    if (i === p.current) return 'now';
    return 'todo';
  });
}

/* ─────────────────────────────────────────────────────────────────────────
   Por qué esto es imposible de romper, y no solo desaconsejado:

     // ✗ No compila — 'in-progress' no es un BadgeTone:
     renderBadge('in-progress', 'En ruta')

     // ✗ No compila — no existe un tono azul que pasar:
     renderBadge('info', 'En ruta')

     // ✓ Única vía para "en curso": la secuencia viaja con la posición.
     renderSteps(progress(['Recibido','Preparando','En camino','Entregado'], 2))

   Un badge de reposo (pagado, cancelado, atención) sigue siendo un badge. Lo que
   ya no se puede es afirmar "va en camino" sin mostrar el camino.

   ── ESAS ETIQUETAS SON EJEMPLO, NO CONTRATO ───────────────────────────────

   Las trae el DOMINIO; este módulo sólo garantiza que la posición nunca viaje sin
   ellas. Son las reales de la vertical de este repo —salen del eje de FULFILLMENT
   (`Shipping.estado`)— y se muestran así, y no como "Etapa 1 · Etapa 2", porque un
   ejemplo abstracto no enseña cómo se ve una secuencia de verdad. Otra vertical
   traerá otras, y otra cantidad.

   Y conviene decir por qué NO son cinco, que es lo que este comentario decía
   antes: llevaba un "Confirmado" entre Recibido y Preparando. El dominio BORRÓ ese
   estado —una migración lo fusionó con "pagado", porque pago confirmado y orden
   confirmada eran el mismo momento—, así que la etapa significaba PAGO
   ACREDITADO. Y el pago no es una posición del camino: en contraentrega el pedido
   se prepara, se despacha y se entrega SIN pagar, y la plata entra al final; la
   barra habría quedado esperando un paso que en todo ese recorrido no ocurre.
   Queda escrito porque el ejemplo se leía como canon y llegó a producir dos
   secuencias que no cuadraban entre el sistema y la pantalla.

   "Lista para despacho" tampoco es una etapa, aunque lo parezca: es un predicado
   de completitud DENTRO de Preparando (tiene mensajero y fecha), no un estado.
   ───────────────────────────────────────────────────────────────────────── */
