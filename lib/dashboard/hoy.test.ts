import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bucketsPorHora, curvaDibuja, HORAS_DIA } from './hoy';

test('bucketsPorHora rellena las 24 horas: un hueco es un 0 real, no un undefined', () => {
  const b = bucketsPorHora([{ hora: 9, n: 3 }, { hora: 14, n: 1 }]);
  assert.equal(b.length, HORAS_DIA);
  assert.equal(b[9], 3);
  assert.equal(b[14], 1);
  assert.equal(b[0], 0, 'la medianoche sin pedidos es 0');
  assert.equal(b[23], 0);
  assert.ok(b.every(n => typeof n === 'number'), 'ningún hueco queda undefined');
});

test('el orden de las filas no importa: cada conteo cae en SU hora', () => {
  const b = bucketsPorHora([{ hora: 23, n: 5 }, { hora: 0, n: 2 }, { hora: 12, n: 4 }]);
  assert.equal(b[0], 2);
  assert.equal(b[12], 4);
  assert.equal(b[23], 5);
});

test('una hora fuera de rango no desborda ni desplaza el resto', () => {
  const b = bucketsPorHora([{ hora: 10, n: 7 }, { hora: 24, n: 99 }, { hora: -1, n: 99 }]);
  assert.equal(b.length, HORAS_DIA);
  assert.equal(b[10], 7);
  assert.equal(b.reduce((s, n) => s + n, 0), 7, 'las horas inválidas se ignoran');
});

test('curvaDibuja: con al menos un pedido, dibuja', () => {
  assert.equal(curvaDibuja(bucketsPorHora([{ hora: 8, n: 1 }])), true);
});

test('curvaDibuja: DÍA SIN PEDIDOS declara, no dibuja — buckets todos en 0', () => {
  assert.equal(curvaDibuja(bucketsPorHora([])), false);
  assert.equal(curvaDibuja(new Array(HORAS_DIA).fill(0)), false);
});
