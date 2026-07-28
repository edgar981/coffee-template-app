import { BUSINESS_TZ } from '@/lib/timezone';

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
