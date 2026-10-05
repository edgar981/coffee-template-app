import { test } from 'node:test';
import assert from 'node:assert/strict';

import { siguienteIndiceEleccion, indiceDeValor, esTeclaDeEleccion } from './eleccion-visual';

// ─── siguienteIndiceEleccion — el roving-tabindex del grupo de radios ──────────────────────────────

test('ArrowRight avanza una posición', () => {
  assert.equal(siguienteIndiceEleccion(0, 3, 'ArrowRight'), 1);
});

test('ArrowDown avanza igual que ArrowRight (una fila puede envolver)', () => {
  assert.equal(siguienteIndiceEleccion(0, 3, 'ArrowDown'), 1);
});

test('ArrowRight en la ÚLTIMA opción envuelve a la primera', () => {
  assert.equal(siguienteIndiceEleccion(2, 3, 'ArrowRight'), 0);
});

test('ArrowLeft retrocede una posición', () => {
  assert.equal(siguienteIndiceEleccion(2, 3, 'ArrowLeft'), 1);
});

test('ArrowUp retrocede igual que ArrowLeft', () => {
  assert.equal(siguienteIndiceEleccion(2, 3, 'ArrowUp'), 1);
});

test('ArrowLeft en la PRIMERA opción envuelve a la última', () => {
  assert.equal(siguienteIndiceEleccion(0, 3, 'ArrowLeft'), 2);
});

test('Home salta a la primera sin importar el índice actual', () => {
  assert.equal(siguienteIndiceEleccion(2, 3, 'Home'), 0);
});

test('End salta a la última sin importar el índice actual', () => {
  assert.equal(siguienteIndiceEleccion(0, 3, 'End'), 2);
});

test('con DOS opciones (el caso más común: ON/OFF), ArrowRight alterna', () => {
  assert.equal(siguienteIndiceEleccion(0, 2, 'ArrowRight'), 1);
  assert.equal(siguienteIndiceEleccion(1, 2, 'ArrowRight'), 0);
});

test('un grupo VACÍO (total 0) no tiene siguiente — null, nunca un índice fuera de rango', () => {
  assert.equal(siguienteIndiceEleccion(0, 0, 'ArrowRight'), null);
  assert.equal(siguienteIndiceEleccion(0, 0, 'Home'), null);
});

test('una sola opción: ArrowRight/ArrowLeft devuelven el mismo índice (envuelve sobre sí misma)', () => {
  assert.equal(siguienteIndiceEleccion(0, 1, 'ArrowRight'), 0);
  assert.equal(siguienteIndiceEleccion(0, 1, 'ArrowLeft'), 0);
});

// ─── indiceDeValor ──────────────────────────────────────────────────────────────────────────────────

test('indiceDeValor encuentra la opción cuyo value coincide', () => {
  const opciones = [{ value: 'a' }, { value: 'b' }, { value: 'c' }];
  assert.equal(indiceDeValor(opciones, 'b'), 1);
});

test('indiceDeValor cae a 0 si NINGUNA opción coincide (valor legado) — nunca -1', () => {
  const opciones = [{ value: 'a' }, { value: 'b' }];
  assert.equal(indiceDeValor(opciones, 'z-ya-no-existe'), 0);
});

test('indiceDeValor sobre una lista vacía también cae a 0', () => {
  assert.equal(indiceDeValor([], 'cualquiera'), 0);
});

// ─── esTeclaDeEleccion — el guard que decide si el componente llama a `preventDefault` ─────────────

test('esTeclaDeEleccion reconoce las seis teclas del grupo', () => {
  for (const t of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']) {
    assert.ok(esTeclaDeEleccion(t), `${t} debería ser una tecla de elección`);
  }
});

test('esTeclaDeEleccion rechaza cualquier otra tecla (Tab, Enter, Espacio, una letra)', () => {
  for (const t of ['Tab', 'Enter', ' ', 'a', 'Escape']) {
    assert.ok(!esTeclaDeEleccion(t), `${t} NO debería ser una tecla de elección`);
  }
});
