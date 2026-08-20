'use client';

import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { BUSINESS_TZ, zonedDayKey } from '@duna/core/timezone';
import { dayKeyToDate, dateToDayKey } from '@/lib/day-key';
import { anioPisoPicker } from '@/lib/metrics/periodo';
import { avanzarSeleccion } from '@/lib/rango-picker';

// Shared admin date-range picker — extracted from the Órdenes filter so Pagos
// (and future admin pages) reuse the exact trigger button, two-month layout, and
// rules. Controlled + presentational: values are the `YYYY-MM-DD` America/Bogota
// day keys the callers already work in (the same keys the Órdenes URL carries),
// so no timezone conversion happens here — react-day-picker reasons in local
// Dates and we only read/write the calendar-date parts. URL sync (if any) stays
// in the page. Both current consumers filter on past-dated records (orders'
// createdAt, payments' fecha), so future dates are disabled.

const RANGE_LABEL = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' });

export function DateRangePicker({ desde, hasta, onChange, pisoAnio }: {
  desde: string | null;
  hasta: string | null;
  onChange: (desde: string | null, hasta: string | null) => void;
  // Año-piso de la navegación (dropdown de año + tope hacia atrás). Opcional: por
  // defecto el año ANTERIOR (ver `anioPisoPicker` y su test). Es el ASIENTO de la
  // opción A del backlog: el día que exista "primer año con datos", una página lo
  // pasa acá y el picker no cambia. El `DateField` del drawer no la usa.
  pisoAnio?: number;
}) {
  // El primer clic de un rango en curso vive ACÁ y no sale: `onChange` se llama SÓLO
  // con rangos completos, así que las pantallas nunca ven un medio-rango (§ el contrato
  // estrecho de lib/rango-picker). Se resetea al abrir/cerrar el popover: un rango a
  // medias no sobrevive a un Escape ni a un clic fuera.
  const [pendiente, setPendiente] = useState<string | null>(null);

  const active = Boolean(desde || hasta);
  const rangoComprometido = {
    from: desde ? dayKeyToDate(desde) : undefined,
    to:   hasta ? dayKeyToDate(hasta) : undefined,
  };
  // Lo que el calendario PINTA. Con un ancla pendiente va `{from, to: undefined}`: RDP
  // marca ese día como `selected` (vía `rangeIncludesDate` → `isSameDay(from, date)`,
  // medido en la fuente), así el operador VE que su primer clic registró; `range_start/
  // end/middle` exigen `from && to`, así que no aparece banda-media fantasma. Sin ancla,
  // el rango comprometido.
  const range = pendiente ? { from: dayKeyToDate(pendiente), to: undefined } : rangoComprometido;
  // Hay algo que pintar si hay un ancla pendiente O un rango comprometido. Con pendiente
  // pero sin rango previo (Pedidos/Inventario, primera selección) `active` es false, así
  // que no alcanza mirar sólo las props.
  const haySeleccion = pendiente !== null || active;

  // "Today" is the America/Bogota day (not the viewer's), converted to a local
  // Date because react-day-picker reasons in local calendar terms. `now` se lee UNA
  // vez y de él salen tanto `today` como el año-piso, para no leer el reloj dos veces.
  const now               = new Date();
  const today             = dayKeyToDate(zonedDayKey(now, BUSINESS_TZ));
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  // El primer mes navegable: 1-ene del año-piso. Cubre TODO preset —incluido "Mes
  // pasado" en enero, que apunta a diciembre del año anterior—. Ver `anioPisoPicker`.
  const startNav          = new Date(pisoAnio ?? anioPisoPicker(now), 0, 1);
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
    <Popover onOpenChange={() => setPendiente(null)}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={`h-9 gap-2 ${active ? 'border-primary/50 text-foreground' : 'text-muted-foreground'}`}>
          <CalendarDays className="w-4 h-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          // `captionLayout="dropdown"` da los selects de mes/año para SALTAR sin
          // clickear la flecha mes a mes (lo que reportó el owner). El de mes es la
          // ganancia real; el de año hoy es casi inerte (uno o dos años) y crece con
          // el histórico. Los `<select>` son nativos (aceptado); su overlay lo repone
          // `calendar.tsx` porque no importamos el CSS de la librería.
          captionLayout="dropdown"
          selected={haySeleccion ? range : undefined}
          defaultMonth={leftMonth}
          // v10: `startMonth`/`endMonth` acotan la navegación (v8: `fromMonth`/`toMonth`).
          // `startMonth` es OBLIGATORIO para que el dropdown de año no salga vacío
          // (getYearOptions devuelve undefined sin él).
          startMonth={startNav}
          endMonth={currentMonthStart}
          disabled={{ after: today }}
          // La sugerencia de la librería se IGNORA: react-day-picker, sobre un rango
          // completo, deja `from` clavado y mueve sólo `to` —así no se puede empezar un
          // rango que arranque después del `from` vigente—. Se maneja por el DÍA
          // CLICKEADO y nada más (`avanzarSeleccion`, § lib/rango-picker, con su test).
          // El primer clic ARRANCA (guarda el ancla, no emite); el segundo COMPLETA y
          // ahí sí sale `onChange` con el rango entero. El medio-rango no sale de acá.
          onSelect={(_r, diaClic) => {
            if (!diaClic) return;
            const paso = avanzarSeleccion(pendiente, dateToDayKey(diaClic));
            if (paso.fase === 'arranca') {
              setPendiente(paso.pendiente);
            } else {
              setPendiente(null);
              onChange(paso.desde, paso.hasta);
            }
          }}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  );
}
