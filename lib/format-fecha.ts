import { BUSINESS_TZ } from '@/lib/timezone';

// THE single admin date formatter. One legible short format everywhere a date is
// shown to a human (tables, cards, tooltips, chart subtitles): `14 may 2026`,
// es-CO, America/Bogota. Replaces the ad-hoc mix (`2026-05-14`, `9 de may de
// 2026`, `14/5/2026`). For comparison/day-key logic keep lib/timezone helpers —
// this is display only.

const FMT = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: BUSINESS_TZ,
});

/** `14 may 2026`. Accepts an ISO string or Date; returns `—` for empty/invalid,
 *  and echoes a non-date string unchanged (legacy date-only rows). */
export function formatFecha(input: string | Date | null | undefined): string {
  if (input == null || input === '') return '—';
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return typeof input === 'string' ? input : '—';
  // Strip the locale's short-month period and any stray "de" so the output is
  // always the compact `14 may 2026`, independent of the ICU build.
  return FMT.format(d).replace(/\./g, '').replace(/\sde\s/g, ' ');
}
