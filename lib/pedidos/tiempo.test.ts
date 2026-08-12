import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hace } from './tiempo';

// Reloj fijo: un test de tiempo relativo que dependa del reloj real es un test
// que falla según la hora del día (mismo criterio que `soloActiva` en el carril).
const AHORA = new Date('2026-05-20T12:00:00.000Z');
const haceMs = (ms: number) => new Date(AHORA.getTime() - ms).toISOString();
const S = 1000, MIN = 60 * S, HORA = 60 * MIN, DIA = 24 * HORA;

test('los tramos, y sus BORDES', () => {
  assert.equal(hace(haceMs(0), AHORA),            'hace un momento');
  assert.equal(hace(haceMs(59 * S), AHORA),       'hace un momento');
  assert.equal(hace(haceMs(MIN), AHORA),          'hace 1 min', 'el minuto exacto ya cuenta');
  assert.equal(hace(haceMs(59 * MIN), AHORA),     'hace 59 min');
  assert.equal(hace(haceMs(HORA), AHORA),         'hace 1 h');
  assert.equal(hace(haceMs(23 * HORA), AHORA),    'hace 23 h');
  assert.equal(hace(haceMs(DIA), AHORA),          'hace 1 día', 'singular');
  assert.equal(hace(haceMs(2 * DIA), AHORA),      'hace 2 días');
  assert.equal(hace(haceMs(6 * DIA), AHORA),      'hace 6 días');
});

test('pasada una semana manda la FECHA, no la cuenta', () => {
  // "hace 23 d" obliga a una resta mental; a esa distancia lo que se quiere saber
  // es de cuándo habla.
  assert.equal(hace(haceMs(7 * DIA), AHORA), '13 may 2026', 'el corte es a los 7 días exactos');
  assert.equal(hace('2026-01-04T12:00:00.000Z', AHORA), '4 ene 2026');
  // Y sale de `formatFecha`, la única utilidad de fecha visible del panel: el
  // mismo pedido dice lo mismo acá y en cualquier otra vista.
  assert.ok(!/hace/.test(hace(haceMs(30 * DIA), AHORA)!));
});

test('un timestamp FUTURO se muestra como ahora, no como un negativo', () => {
  // Unos segundos de desfase entre el reloj del servidor y el del navegador es un
  // detalle técnico, no un hecho del negocio.
  assert.equal(hace(new Date(AHORA.getTime() + 3 * S).toISOString(), AHORA), 'hace un momento');
  assert.equal(hace(new Date(AHORA.getTime() + 5 * MIN).toISOString(), AHORA), 'hace un momento');
});

test('sin dato o con uno impareseable: null, no un texto de relleno', () => {
  // `null` deja que quien llama decida si es un hueco o una omisión legítima —
  // en la lista, una orden anterior al libro no tiene última transición y su slot
  // se queda vacío a propósito.
  assert.equal(hace(null, AHORA), null);
  assert.equal(hace(undefined, AHORA), null);
  assert.equal(hace('', AHORA), null);
  assert.equal(hace('ayer por la tarde', AHORA), null);
});
