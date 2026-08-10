import { BUSINESS_TZ } from '@duna/core/timezone';

// THE single admin date formatter. One legible short format everywhere a date is
// shown to a human (tables, cards, tooltips, chart subtitles): `14 may 2026`,
// es-CO, America/Bogota. Replaces the ad-hoc mix (`2026-05-14`, `9 de may de
// 2026`, `14/5/2026`). For comparison/day-key logic keep lib/timezone helpers —
// this is display only.

const OPTS = { day: 'numeric', month: 'short', year: 'numeric' } as const;
const FMT_TZ  = new Intl.DateTimeFormat('es-CO', { ...OPTS, timeZone: BUSINESS_TZ });
// Date-only values (`YYYY-MM-DD`, e.g. Shipping.fecha_programada) are wall-clock
// calendar dates with NO time — formatting them in a UTC-anchored formatter keeps
// the day intact. Using BUSINESS_TZ on a UTC-midnight parse would shift them back
// a day (Bogotá is UTC-5), printing "13 may" for "2026-05-14".
const FMT_UTC = new Intl.DateTimeFormat('es-CO', { ...OPTS, timeZone: 'UTC' });
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const compact = (s: string) => s.replace(/\./g, '').replace(/\sde\s/g, ' ');

/** `14 may 2026`. Accepts an ISO timestamp, a `YYYY-MM-DD` date-only string, or a
 *  Date; returns `—` for empty/invalid, and echoes a non-date string unchanged. */
export function formatFecha(input: string | Date | null | undefined): string {
  if (input == null || input === '') return '—';
  if (typeof input === 'string' && DATE_ONLY.test(input)) {
    return compact(FMT_UTC.format(new Date(`${input}T00:00:00Z`)));
  }
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return typeof input === 'string' ? input : '—';
  return compact(FMT_TZ.format(d));
}

/**
 * `recién` · `hace 5 m` · `hace 3 h` · `hace 2 d`. La OTRA forma legítima de
 * mostrar una fecha en el admin: cuando lo que importa no es qué día fue sino
 * cuánto hace. Vive junto a `formatFecha` y no suelta en cada componente por la
 * misma razón que aquella — dos implementaciones divergen y el mismo instante
 * termina leyéndose distinto en dos pantallas.
 *
 * `ahora` es parámetro para que quien necesite un reloj vivo (la campana lo
 * refresca cada 30 s) lo pase, y para que sea testeable sin depender de Date.now.
 */
export function tiempoRelativo(
  input: string | Date | null | undefined,
  ahora: number = Date.now(),
): string {
  if (input == null || input === '') return '—';
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return '—';

  const mins = Math.floor((ahora - d.getTime()) / 60_000);
  // Un instante futuro (reloj torcido, fila sembrada) se lee como recién y no
  // como "hace -3 m", que no significa nada para quien lo mira.
  if (mins < 1) return 'recién';
  if (mins < 60) return `hace ${mins} m`;
  const horas = Math.floor(mins / 60);
  if (horas < 24) return `hace ${horas} h`;
  return `hace ${Math.floor(horas / 24)} d`;
}
