import { test } from 'node:test';
import assert from 'node:assert/strict';

import { siguienteIndiceGaleria } from './galeria';

test('avanza al índice siguiente dentro de rango', () => {
  assert.equal(siguienteIndiceGaleria(0, 3, 1), 1);
  assert.equal(siguienteIndiceGaleria(1, 3, 1), 2);
});

test('retrocede al índice anterior dentro de rango', () => {
  assert.equal(siguienteIndiceGaleria(2, 3, -1), 1);
  assert.equal(siguienteIndiceGaleria(1, 3, -1), 0);
});

test('BUCLE: avanzar desde la última foto vuelve a la primera', () => {
  assert.equal(siguienteIndiceGaleria(2, 3, 1), 0);
});

test('BUCLE: retroceder desde la primera foto vuelve a la última', () => {
  assert.equal(siguienteIndiceGaleria(0, 3, -1), 2);
});

test('con una sola foto el índice no se mueve, en ninguna dirección', () => {
  assert.equal(siguienteIndiceGaleria(0, 1, 1), 0);
  assert.equal(siguienteIndiceGaleria(0, 1, -1), 0);
});

test('sin fotos (total 0) el índice no se mueve — no revienta con división por cero', () => {
  assert.equal(siguienteIndiceGaleria(0, 0, 1), 0);
  assert.equal(siguienteIndiceGaleria(0, 0, -1), 0);
});

test('con dos fotos, avanzar y retroceder alternan entre 0 y 1', () => {
  assert.equal(siguienteIndiceGaleria(0, 2, 1), 1);
  assert.equal(siguienteIndiceGaleria(1, 2, 1), 0);
  assert.equal(siguienteIndiceGaleria(1, 2, -1), 0);
  assert.equal(siguienteIndiceGaleria(0, 2, -1), 1);
});
