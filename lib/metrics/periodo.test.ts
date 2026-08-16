import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rangoDeDiasDelPeriodo } from './periodo';

// Capa 1 — puro. Los presets de Inventario REUSAN la definición de período de
// Analítica (`rangoDelPeriodo`) y la traducen a day keys de Bogotá INCLUSIVOS. Lo
// que se afirma es la traducción: `hasta` es el ÚLTIMO día del período —el día
// anterior al límite superior EXCLUSIVO— y todo con la frontera de Bogotá, no UTC.

const MED_MAYO = new Date('2026-05-15T18:00:00Z'); // 15 may 13:00 Bogotá

test('Este mes → [primero del mes, último del mes]', () => {
  assert.deepEqual(rangoDeDiasDelPeriodo('mes', MED_MAYO), { desde: '2026-05-01', hasta: '2026-05-31' });
});

test('Mes pasado → el mes anterior completo', () => {
  assert.deepEqual(rangoDeDiasDelPeriodo('mes_anterior', MED_MAYO), { desde: '2026-04-01', hasta: '2026-04-30' });
});

test('Últimos 3 meses → ventana MÓVIL que incluye el mes en curso', () => {
  // Mar + Abr + May, no el trimestre calendario. Misma definición que Analítica.
  assert.deepEqual(rangoDeDiasDelPeriodo('ultimos_3_meses', MED_MAYO), { desde: '2026-03-01', hasta: '2026-05-31' });
});

test('la frontera es de BOGOTÁ, no UTC: 1 jun 04:00Z todavía es MAYO', () => {
  // 2026-06-01T04:00Z = 31 may 23:00 en Bogotá (UTC−5). "Este mes" debe ser mayo;
  // con frontera UTC naíf daría junio.
  const casiJunio = new Date('2026-06-01T04:00:00Z');
  assert.deepEqual(rangoDeDiasDelPeriodo('mes', casiJunio), { desde: '2026-05-01', hasta: '2026-05-31' });
});

test('febrero no bisiesto: el último día es el 28', () => {
  // Cordura de que "último día del mes" sale del calendario, no de un 30/31 fijo.
  const feb = new Date('2026-02-10T18:00:00Z');
  assert.deepEqual(rangoDeDiasDelPeriodo('mes', feb), { desde: '2026-02-01', hasta: '2026-02-28' });
});
