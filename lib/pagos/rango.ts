import { dayKeyStart, startOfZonedDay, startOfZonedMonth } from '@duna/core/timezone';

// Los límites `[gte, lt)` de la consulta del libro de pagos, anclados a `tz`.
//
// `desde`/`hasta` son claves de día `YYYY-MM-DD` (las que emite el date picker). Sin
// ellas, el default es el MES EN CURSO: la pantalla siempre abre con un rango, así que
// el server nunca consulta sin acotar y no hay corte silencioso que declarar.
//
// `lt` es el inicio del día SIGUIENTE a `hasta` (no el inicio de `hasta`), para que el
// rango incluya TODO el último día —un pago a las 23:59 del `hasta` cuenta—. El anclaje
// a Bogotá es el mismo del resto del panel (§ dayKeyStart / la trampa TZ de lib/day-key).
export function rangoFechasPagos(
  { desde, hasta, ahora }: { desde?: string | null; hasta?: string | null; ahora: Date },
  tz: string,
): { gte: Date; lt: Date } {
  const gte = desde ? dayKeyStart(desde, tz)                            : startOfZonedMonth(ahora, tz, 0);
  const lt  = hasta ? startOfZonedDay(dayKeyStart(hasta, tz), tz, 1)    : startOfZonedDay(ahora, tz, 1);
  return { gte, lt };
}
