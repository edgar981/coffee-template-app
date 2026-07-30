// LA resolución del slot único de contexto de una stat card. Vive aparte del
// componente para poder testearla: la preservación del scope es un invariante de
// producto (dos tarjetas que parecen contradecirse son un bug de comunicación,
// ver CLAUDE.md § "Por cobrar" vs "Órdenes Pendientes"), no un detalle de estilo.
//
// Regla: la tarjeta muestra como máximo DOS líneas bajo el valor — título + una.
// El insight y el sub compiten por esa única línea.

export interface StatLineInput {
  /** Hecho derivado de los datos (gana el slot cuando existe). */
  insight?:        string;
  /** Línea descriptiva de fallback (scope, fuente, período). */
  sub?:            string;
  /** Énfasis del insight (tendencias). Se ignora si gana el sub. */
  insightEnfasis?: boolean;
  /**
   * Scope de la tarjeta, apendido entre paréntesis a la línea que gane. Va aparte
   * del texto justamente para que no dependa de CUÁL línea ganó: una tarjeta
   * acumulada que mañana gane un insight sigue declarando que no habla de hoy.
   */
  scopeSuffix?:    string;
}

export interface StatLine {
  text:    string;
  /** Un paso más de contraste, dentro de la familia muted (nunca color). */
  enfasis: boolean;
}

/**
 * Devuelve la única línea de contexto, o `null` si la tarjeta no tiene ninguna
 * (título solo es un estado válido).
 *
 * El scope se apende SIEMPRE que haya línea. Si no hay ni insight ni sub, no se
 * emite una línea suelta con el scope: "(acumulado)" solo no dice nada.
 */
export function resolveStatLine(input: StatLineInput): StatLine | null {
  const { insight, sub, insightEnfasis, scopeSuffix } = input;
  const base = insight?.trim() || sub?.trim() || '';
  if (!base) return null;

  const scope = scopeSuffix?.trim();
  return {
    text:    scope ? `${base} (${scope})` : base,
    enfasis: !!insight?.trim() && !!insightEnfasis,
  };
}
