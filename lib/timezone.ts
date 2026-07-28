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
 * Calendar day `ref` falls on in `tz`, as a `YYYY-MM-DD` key. This is the day
 * bucket the daily charts group by — it must agree with the SQL side, which
 * buckets with `AT TIME ZONE 'UTC' AT TIME ZONE <tz>` (the DB columns are
 * `timestamp without time zone` holding UTC instants).
 */
export function zonedDayKey(ref: Date, tz: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(ref);
}

/**
 * The `days` local-day keys ending on the day `ref` falls on in `tz`, oldest
 * first. Charts zero-fill against this list so a day with no orders renders as
 * 0 instead of being skipped.
 */
export function zonedDayKeyRange(ref: Date, tz: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) =>
    zonedDayKey(startOfZonedDay(ref, tz, i - (days - 1)), tz),
  );
}

/**
 * UTC instant of 00:00 local time on the MONDAY of the week that `ref` falls on
 * in `tz`, shifted by `weekDelta` weeks (0 = this week, -1 = last week). Weeks
 * are Monday–Sunday (ISO), matching the es-CO business convention.
 */
export function startOfZonedWeek(ref: Date, tz: string, weekDelta = 0): Date {
  // Local weekday of `ref` in `tz`: ISO index 0 = Monday … 6 = Sunday.
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(ref);
  const isoIndex = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(weekday);
  return startOfZonedDay(ref, tz, -isoIndex + weekDelta * 7);
}

/**
 * Local hour (0–23) that `ref` falls on in `tz`. THE clock the scheduled
 * automations compare against: the hourly cron fires in UTC, and each automation
 * declares its hour in Bogotá wall time, so the conversion happens here and
 * nowhere else (no hardcoded "13:00 UTC = 08:00 Bogotá" scattered around).
 */
export function zonedHour(ref: Date, tz: string): number {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' })
      .format(ref),
  );
}

/** ISO weekday of `ref` in `tz`: 1 = Monday … 7 = Sunday. */
export function zonedIsoWeekday(ref: Date, tz: string): number {
  const short = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(ref);
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(short) + 1;
}

/**
 * ISO-8601 week `ref` falls on in `tz`, as `2026-W31`. The idempotency key of the
 * weekly automations (AutomationRun.periodo), so a cron that fires 24× on Monday
 * still produces exactly one weekly report.
 *
 * ISO rule: a week belongs to the year containing its THURSDAY — which is why the
 * year here is taken from that Thursday, not from `ref` (Dec 31 2026 lands in
 * `2027-W01`). Day arithmetic runs on a UTC-anchored copy of the LOCAL calendar
 * date, so no zone offset can shift the day mid-computation.
 */
export function isoWeekKey(ref: Date, tz: string): string {
  const [y, m, d] = zonedDayKey(ref, tz).split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const isoDay = date.getUTCDay() || 7;              // 1..7, lunes = 1
  date.setUTCDate(date.getUTCDate() + 4 - isoDay);   // el jueves de esa semana ISO
  const year = date.getUTCFullYear();
  const jan1 = Date.UTC(year, 0, 1);
  const week = Math.ceil(((date.getTime() - jan1) / 86_400_000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
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
