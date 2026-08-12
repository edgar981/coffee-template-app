// Recorrido — la secuencia de hechos de algo, en orden. AGNÓSTICA: no conoce
// `OrderStatusTransition` ni ningún dominio. Recibe entradas ya resueltas por el
// consumidor (qué pasó, cuándo, quién) y decide cómo se ven.
//
// ── POR QUÉ ES COMPONENTE Y NO SÓLO LAS CLASES `.duna-tl` ────────────────────
//
// Porque el ACTOR puede faltar, y "cómo se ve un actor ausente" es una decisión
// del sistema, no de cada pantalla. Con clases sueltas, cada consumidor tendría
// que concatenar el sub a mano —`${cuándo} · ${quién}`— y dos pantallas lo
// formatearían distinto: una con "·", otra con "—", otra metiendo un "Sistema"
// inventado. La ranura opcional es la diferencia entre una primitiva que ACEPTA
// DATOS y una que obliga al consumidor a pre-formatear.
//
// ── UN ACTOR AUSENTE NO SE NOMBRA ────────────────────────────────────────────
//
// Cuando `actor` es null/ausente, la línea muestra sólo el "cuándo" y NADA más.
// El sistema deliberadamente NO inventa una etiqueta ("Sistema", "Automático"):
// eso es lenguaje de producto, y este paquete es agnóstico de negocio y de
// idioma. Si el producto quiere una palabra para el actor no-humano, la pasa
// como `actor` y el sistema la pinta igual que a cualquier otra.
//
// Lo que el sistema SÍ decide y centraliza es la forma: el separador, el orden
// (cuándo antes que quién) y que la línea entera desaparezca si no hay ninguno
// de los dos.

export type TimelineState = 'done' | 'now' | 'todo';

export interface TimelineEntry {
  /** Qué pasó. Texto ya resuelto por el consumidor. */
  title: string;
  /** Cuándo — YA formateado. El DS no formatea fechas. */
  time?: string | null;
  /** Quién lo hizo. `null`/ausente = sin humano detrás; no se nombra (ver arriba). */
  actor?: string | null;
  /**
   * Posición en la secuencia. Omitido = punto neutro (aro hueco): es lo correcto
   * para un hecho del que sólo consta que ocurrió, sin secuencia alrededor —
   * como el recorrido derivado de un registro viejo que no tiene todos los pasos.
   */
  state?: TimelineState;
}

export interface TimelineProps {
  entries: readonly TimelineEntry[];
}

function itemClass(state?: TimelineState): string {
  // `todo` no lleva modificador: es el estilo base del item (aro hueco).
  if (state === 'done' || state === 'now') return `duna-tl__item is-${state}`;
  return 'duna-tl__item';
}

export function Timeline({ entries }: TimelineProps) {
  return (
    // <ol> y no <div>: un recorrido ES una lista ordenada, y en un lector de
    // pantalla eso es la diferencia entre "5 elementos, 1 de 5" y una tirada de
    // texto suelto. El bullet nativo lo apaga `.duna-tl`.
    <ol className="duna-tl">
      {entries.map((e, i) => {
        const sub = [e.time, e.actor].filter(Boolean).join(' · ');
        return (
          <li key={i} className={itemClass(e.state)}>
            <div className="duna-tl__t">{e.title}</div>
            {sub && <div className="duna-tl__s">{sub}</div>}
          </li>
        );
      })}
    </ol>
  );
}
