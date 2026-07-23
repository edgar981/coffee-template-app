// Timezone helpers for computing local-day boundaries as absolute UTC instants.
//
// The business operates in Colombia, so "today"/"yesterday" must be defined by
// local midnight in America/Bogota — never the server's UTC clock. Bogota is a
// fixed UTC−5 offset (no DST), but we compute the offset dynamically so the
// helper stays correct for any IANA zone.

export const BUSINESS_TZ = 'America/Bogota';

/** Offset (ms) to add to a UTC instant to get wall-clock time in `tz`. */
function zoneOffsetMs(instant: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
    .formatToParts(instant)
    .reduce<Record<string, number>>((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = Number(p.value);
      return acc;
    }, {});

  const asUTC = Date.UTC(
    parts.year, parts.month - 1, parts.day,
    parts.hour, parts.minute, parts.second,
  );
  return asUTC - instant.getTime();
}

/**
 * UTC instant of 00:00 local time in `tz` for the local day that `ref` falls
 * on, shifted by `dayDelta` days (0 = today, -1 = yesterday, +1 = tomorrow).
 */
export function startOfZonedDay(ref: Date, tz: string, dayDelta = 0): Date {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  })
    .format(ref)
    .split('-')
    .map(Number);

  // Guess the instant as if local midnight were UTC, then correct by the zone
  // offset at that instant.
  const utcGuess = Date.UTC(y, m - 1, d + dayDelta, 0, 0, 0);
  const offset = zoneOffsetMs(new Date(utcGuess), tz);
  return new Date(utcGuess - offset);
}

/**
 * UTC instant of 00:00 local time on the 1st of the month that `ref` falls on
 * in `tz`, shifted by `monthDelta` months (0 = this month, -1 = last month,
 * +1 = next month). `Date.UTC` normalises month over/underflow across years.
 */
export function startOfZonedMonth(ref: Date, tz: string, monthDelta = 0): Date {
  const [y, m] = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit',
  })
    .format(ref)
    .split('-')
    .map(Number);

  const utcGuess = Date.UTC(y, (m - 1) + monthDelta, 1, 0, 0, 0);
  const offset = zoneOffsetMs(new Date(utcGuess), tz);
  return new Date(utcGuess - offset);
}
