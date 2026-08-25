import { test } from 'node:test';
import assert from 'node:assert/strict';
import { debeLeerBorrador } from './site-content-gate';

// La DECISIÓN del gate del borrador (capa 1). El cableado —que la página lea la sesión real y
// elija el loader— se prueba en vivo; acá se afirma que sin rol de panel NO se sirve el borrador,
// que es donde un leak sería grave.

test('SIN sesión (undefined/null) → NO lee borrador, aun con la señal (el leak que se evita)', () => {
  assert.equal(debeLeerBorrador(undefined, true), false);
  assert.equal(debeLeerBorrador(null, true), false);
});

test('rol SIN panel (STAFF) → NO lee borrador aun con la señal', () => {
  assert.equal(debeLeerBorrador('STAFF', true), false);
});

test('un rol desconocido/basura → NO lee borrador', () => {
  assert.equal(debeLeerBorrador('customer', true), false);
  assert.equal(debeLeerBorrador('', true), false);
});

test('OWNER y MANAGER (con panel) + señal → SÍ leen borrador', () => {
  assert.equal(debeLeerBorrador('OWNER', true), true);
  assert.equal(debeLeerBorrador('MANAGER', true), true);
});

test('SIN señal, ni el admin lee borrador (la tienda pública nunca lo pide)', () => {
  assert.equal(debeLeerBorrador('OWNER', false), false);
  assert.equal(debeLeerBorrador('MANAGER', false), false);
  assert.equal(debeLeerBorrador(undefined, false), false);
});
