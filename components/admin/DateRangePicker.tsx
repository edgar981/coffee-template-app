'use client';

import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { BUSINESS_TZ, zonedDayKey } from '@duna/core/timezone';
import { dayKeyToDate, dateToDayKey } from '@/lib/day-key';

// Shared admin date-range picker — extracted from the Órdenes filter so Pagos
// (and future admin pages) reuse the exact trigger button, two-month layout, and
// rules. Controlled + presentational: values are the `YYYY-MM-DD` America/Bogota
// day keys the callers already work in (the same keys the Órdenes URL carries),
// so no timezone conversion happens here — react-day-picker reasons in local
// Dates and we only read/write the calendar-date parts. URL sync (if any) stays
// in the page. Both current consumers filter on past-dated records (orders'
// createdAt, payments' fecha), so future dates are disabled.

const RANGE_LABEL = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' });

export function DateRangePicker({ desde, hasta, onChange }: {
  desde: string | null;
  hasta: string | null;
  onChange: (desde: string | null, hasta: string | null) => void;
}) {
  const active = Boolean(desde || hasta);
  const range = {
    from: desde ? dayKeyToDate(desde) : undefined,
    to:   hasta ? dayKeyToDate(hasta) : undefined,
  };

  // "Today" is the America/Bogota day (not the viewer's), converted to a local
  // Date because react-day-picker reasons in local calendar terms.
  const today             = dayKeyToDate(zonedDayKey(new Date(), BUSINESS_TZ));
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  // Records live in the PAST, so the two panes show [month-1, month] rather than
  // [month, month+1]. The right pane follows the selection when there is one,
  // clamped to the current month; `Date` normalises the January → December
  // rollover on its own.
  const anchor      = range.from ?? today;
  const anchorMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const rightMonth  = anchorMonth > currentMonthStart ? currentMonthStart : anchorMonth;
  const leftMonth   = new Date(rightMonth.getFullYear(), rightMonth.getMonth() - 1, 1);

  const label = !active
    ? 'Rango de fechas'
    : desde && hasta
      ? `${RANGE_LABEL.format(dayKeyToDate(desde))} – ${RANGE_LABEL.format(dayKeyToDate(hasta))}`
      : `Desde ${RANGE_LABEL.format(dayKeyToDate((desde ?? hasta)!))}`;

  // No standalone clear (✕) here: the range is cleared by each page's single
  // "Limpiar" reset, which also resets the page's other filters and the URL.
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={`h-9 gap-2 ${active ? 'border-primary/50 text-foreground' : 'text-muted-foreground'}`}>
          <CalendarDays className="w-4 h-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={active ? range : undefined}
          defaultMonth={leftMonth}
          // react-day-picker v10: `endMonth` caps forward navigation (v8's
          // `toMonth`). No `startMonth` — going back stays unrestricted.
          endMonth={currentMonthStart}
          disabled={{ after: today }}
          onSelect={(r) => onChange(
            r?.from ? dateToDayKey(r.from) : null,
            r?.to   ? dateToDayKey(r.to)   : null,
          )}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  );
}
