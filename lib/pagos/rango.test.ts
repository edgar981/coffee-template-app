import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rangoFechasPagos } from './rango';
import { BUSINESS_TZ, zonedDayKey } from '@duna/core/timezone';

// El rango del libro de pagos se filtra en SQL (antes eran las últimas 500 recortadas
// client-side → un mes viejo salía incompleto sin avisar). Estos casos fijan los
// límites: anclaje a Bogotá, `hasta` inclusivo, y el default de mes en curso.

test('rango explícito: ancla a Bogotá e INCLUYE todo el día `hasta`', () => {
  const { gte, lt } = rangoFechasPagos(
    { desde: '2026-08-01', hasta: '2026-08-31', ahora: new Date('2026-09-15T12:00:00.000Z') },
    BUSINESS_TZ,
  );
  // Inicio del 1 de agosto en Bogotá (UTC-5) = 05:00Z.
  assert.equal(gte.toISOString(), '2026-08-01T05:00:00.000Z');
  // `lt` = inicio del 1 de SEPTIEMBRE (exclusivo), no del 31 → el 31 entero cuenta.
  assert.equal(lt.toISOString(), '2026-09-01T05:00:00.000Z');
  // Un pago a las 23:00 de Bogotá del 31 (04:00Z del 1) cae DENTRO; a `dayKeyStart`
  // del 31 le habría quedado fuera.
  const casiMedianocheDel31 = new Date('2026-09-01T04:00:00.000Z');
  assert.ok(casiMedianocheDel31 >= gte && casiMedianocheDel31 < lt, 'el último instante del 31 está dentro');
});

test('sin rango: default = MES EN CURSO, y HOY queda incluido (nunca sin acotar)', () => {
  // 18:00Z del 17 = 13:00 de Bogotá del 17.
  const ahora = new Date('2026-08-17T18:00:00.000Z');
  const { gte, lt } = rangoFechasPagos({ ahora }, BUSINESS_TZ);
  assert.equal(zonedDayKey(gte, BUSINESS_TZ), '2026-08-01', 'gte = primer día del mes');
  // `lt` = inicio de mañana (18) → hoy (17) queda dentro.
  assert.equal(lt.toISOString(), '2026-08-18T05:00:00.000Z');
  assert.ok(ahora >= gte && ahora < lt, 'ahora (hoy) cae dentro del rango default');
});

test('la madrugada UTC de `hasta` no lo saca del rango (mismo huso que el resto)', () => {
  // Un solo día: desde = hasta = 17. Debe contener el 17 entero en Bogotá.
  const { gte, lt } = rangoFechasPagos({ desde: '2026-08-17', hasta: '2026-08-17', ahora: new Date('2026-08-20T12:00:00.000Z') }, BUSINESS_TZ);
  assert.equal(gte.toISOString(), '2026-08-17T05:00:00.000Z');
  assert.equal(lt.toISOString(),  '2026-08-18T05:00:00.000Z');
});
