import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tiempoRelativo } from './format-fecha';

// `tiempoRelativo` se testea porque lo consumen DOS pantallas (la campana y las
// cards de Automatizaciones) y porque sus bordes son justo donde una fecha
// empieza a leerse mal: el minuto, la hora, el día, y un instante futuro.

const AHORA = new Date('2026-08-04T12:00:00.000Z').getTime();
const hace = (ms: number) => new Date(AHORA - ms).toISOString();

const MIN = 60_000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

test('menos de un minuto se lee "recién", no "hace 0 m"', () => {
  assert.equal(tiempoRelativo(hace(0), AHORA), 'recién');
  assert.equal(tiempoRelativo(hace(59_000), AHORA), 'recién');
});

test('minutos, horas y días, cada uno en su tramo', () => {
  assert.equal(tiempoRelativo(hace(MIN), AHORA), 'hace 1 m');
  assert.equal(tiempoRelativo(hace(59 * MIN), AHORA), 'hace 59 m');
  assert.equal(tiempoRelativo(hace(HORA), AHORA), 'hace 1 h');
  assert.equal(tiempoRelativo(hace(23 * HORA), AHORA), 'hace 23 h');
  assert.equal(tiempoRelativo(hace(DIA), AHORA), 'hace 1 d');
  assert.equal(tiempoRelativo(hace(9 * DIA), AHORA), 'hace 9 d');
});

test('trunca hacia abajo: 89 minutos es "hace 1 h", no "hace 2 h"', () => {
  assert.equal(tiempoRelativo(hace(89 * MIN), AHORA), 'hace 1 h');
});

test('un instante FUTURO se lee "recién", no "hace -3 m"', () => {
  // Pasa con un reloj torcido o una fila sembrada hacia adelante. "hace -3 m" no
  // significa nada para quien lo mira.
  assert.equal(tiempoRelativo(new Date(AHORA + 3 * MIN).toISOString(), AHORA), 'recién');
});

test('dato ausente o impareseable devuelve el guion, no NaN', () => {
  for (const v of [null, undefined, '', 'ayer']) {
    assert.equal(tiempoRelativo(v, AHORA), '—');
  }
});

test('acepta Date además de string', () => {
  assert.equal(tiempoRelativo(new Date(AHORA - 2 * HORA), AHORA), 'hace 2 h');
});
