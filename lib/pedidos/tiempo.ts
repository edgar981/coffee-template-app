import { formatFecha } from '@duna/core/format-fecha';

// ─── "HACE X" · el tiempo de la fila ─────────────────────────────────────────
//
// Pura y con tests porque los CORTES son decisión de producto, no formato: dónde
// deja de valer la pena el minuto exacto y dónde una fecha dice más que una
// cuenta. Un `if` cambiado dentro del JSX movería eso sin que nada lo notara.

const MIN = 60_000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

/**
 * Cuánto pasó desde `iso`, para el slot de tiempo de la tarjeta.
 *
 * ── PASADA UNA SEMANA, LA FECHA GANA ────────────────────────────────────────
 *
 * "hace 23 d" obliga a hacer una resta mental para saber de cuándo habla, y a esa
 * distancia el número deja de ser la respuesta: lo que uno quiere saber es la
 * fecha. Se cambia por `formatFecha` —la única utilidad de fecha visible del
 * panel—, así que el mismo pedido dice "14 may 2026" acá y en cualquier otra
 * vista. Debajo de la semana pasa lo contrario: "hace 2 h" responde de un vistazo
 * y la hora exacta no aporta nada.
 *
 * ── EL FUTURO NO SE NIEGA, SE MUESTRA COMO AHORA ────────────────────────────
 *
 * Un timestamp futuro por unos segundos es reloj desfasado entre el servidor y el
 * navegador, no un hecho del negocio. "hace un momento" es lo más cercano a la
 * verdad; un "en 3 s" delataría un detalle técnico que al operador no le sirve.
 *
 * `null` = no hay nada que decir. Quien llama decide si eso es un hueco o una
 * omisión legítima; esta función no inventa un texto para tapar la ausencia.
 */
export function hace(iso: string | null | undefined, ahora: Date = new Date()): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;

  const ms = ahora.getTime() - t;
  if (ms < MIN) return 'hace un momento';
  if (ms < HORA) return `hace ${Math.floor(ms / MIN)} min`;
  if (ms < DIA) return `hace ${Math.floor(ms / HORA)} h`;
  if (ms < 7 * DIA) {
    const d = Math.floor(ms / DIA);
    return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
  }
  return formatFecha(iso);
}
