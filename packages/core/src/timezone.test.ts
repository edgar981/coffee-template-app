import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayKeyStart, zonedDayKey, BUSINESS_TZ } from './timezone';

// `dayKeyStart` es el inverso de `zonedDayKey`, y existe para no repetir el bug que
// documenta `lib/day-key`: `new Date('2026-08-17')` es medianoche UTC = el 16 a las
// 19:00 en Bogotá, así que un pago fechado "17" bucketearía al 16.

test('dayKeyStart ancla al INICIO del día en Bogotá, no a medianoche UTC', () => {
  const d = dayKeyStart('2026-08-17', BUSINESS_TZ);
  // Bogotá es UTC-5 (sin DST): el inicio del 17 es las 05:00Z del 17.
  assert.equal(d.toISOString(), '2026-08-17T05:00:00.000Z');
  // El bug que evita: NO es medianoche UTC (que sería el día anterior en Bogotá).
  assert.notEqual(d.toISOString(), '2026-08-17T00:00:00.000Z');
});

test('round-trip: zonedDayKey(dayKeyStart(k)) === k, para cualquier día', () => {
  for (const k of ['2026-01-01', '2026-08-17', '2026-12-31', '2027-02-28']) {
    assert.equal(zonedDayKey(dayKeyStart(k, BUSINESS_TZ), BUSINESS_TZ), k,
      `el día ${k} tiene que sobrevivir el ida y vuelta`);
  }
});

test('el inicio del día de HOY nunca es futuro — no dispara la guarda de fecha futura', () => {
  // Para cualquier instante de hoy, el INICIO de hoy en Bogotá ya pasó. Es lo que
  // permite que "default hoy" no choque con el veto a fecha futura del pago.
  const hoy = zonedDayKey(new Date(), BUSINESS_TZ);
  assert.ok(dayKeyStart(hoy, BUSINESS_TZ).getTime() <= Date.now());
});
