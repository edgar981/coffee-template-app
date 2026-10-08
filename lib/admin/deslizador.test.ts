import { test } from 'node:test';
import assert from 'node:assert/strict';

import { clampDeslizador, pasoTeclado, atraerAMarca, etiquetaCercana } from './deslizador';

// ── clampDeslizador ──────────────────────────────────────────────────────────────────────────────

test('clampDeslizador: dentro del rango vuelve sin cambios', () => {
  assert.equal(clampDeslizador(55, 0, 100), 55);
});

test('clampDeslizador: fuera del rango se recorta a cada extremo', () => {
  assert.equal(clampDeslizador(-10, 0, 100), 0);
  assert.equal(clampDeslizador(150, 0, 100), 100);
});

test('clampDeslizador: NaN cae al mínimo — nunca propaga basura', () => {
  assert.equal(clampDeslizador(NaN, 0, 100), 0);
});

// ── pasoTeclado ──────────────────────────────────────────────────────────────────────────────────

test('pasoTeclado: una flecha a la derecha suma el paso', () => {
  assert.equal(pasoTeclado(50, 1, 5, 0, 100), 55);
});

test('pasoTeclado: una flecha a la izquierda resta el paso', () => {
  assert.equal(pasoTeclado(50, -1, 5, 0, 100), 45);
});

test('pasoTeclado: clampa al tope en vez de salir del rango', () => {
  assert.equal(pasoTeclado(98, 1, 5, 0, 100), 100);
  assert.equal(pasoTeclado(2, -1, 5, 0, 100), 0);
});

// ── atraerAMarca ─────────────────────────────────────────────────────────────────────────────────

test('atraerAMarca: dentro del umbral snapea EXACTO a la marca', () => {
  assert.equal(atraerAMarca(57, [0, 55, 65, 100], 3), 55);
});

test('atraerAMarca: fuera del umbral de TODAS las marcas vuelve sin cambios', () => {
  assert.equal(atraerAMarca(60, [0, 55, 65, 100], 3), 60);
});

test('atraerAMarca: en el borde del umbral SÍ snapea (inclusive)', () => {
  assert.equal(atraerAMarca(58, [0, 55, 65, 100], 3), 55);
});

test('atraerAMarca: entre dos marcas dentro del umbral, gana la MÁS CERCANA', () => {
  // 62 está a 3 de 65 (dentro) y a 7 de 55 (fuera) con umbral 3 — sólo 65 califica.
  assert.equal(atraerAMarca(62, [55, 65], 3), 65);
  // Con un umbral más ancho, las dos califican y debe ganar la más cercana (65, distancia 2).
  assert.equal(atraerAMarca(63, [55, 65], 20), 65);
});

test('atraerAMarca: sin marcas, vuelve sin cambios', () => {
  assert.equal(atraerAMarca(42, [], 3), 42);
});

// ── etiquetaCercana ──────────────────────────────────────────────────────────────────────────────

const MARCAS_VELO = [
  { valor: 0, etiqueta: 'Nada' },
  { valor: 55, etiqueta: 'Suave' },
  { valor: 65, etiqueta: 'Medio' },
  { valor: 100, etiqueta: 'Fuerte' },
];

test('etiquetaCercana: sobre una marca exacta devuelve su etiqueta', () => {
  assert.equal(etiquetaCercana(0, MARCAS_VELO), 'Nada');
  assert.equal(etiquetaCercana(55, MARCAS_VELO), 'Suave');
  assert.equal(etiquetaCercana(65, MARCAS_VELO), 'Medio');
  assert.equal(etiquetaCercana(100, MARCAS_VELO), 'Fuerte');
});

test('etiquetaCercana: a mitad de camino entre dos marcas, gana la más cercana (sin interpolar)', () => {
  // 70 está a 5 de 65 (Medio) y a 30 de 100 (Fuerte) — Medio gana.
  assert.equal(etiquetaCercana(70, MARCAS_VELO), 'Medio');
  // 85 está a 20 de 65 y a 15 de 100 — Fuerte gana.
  assert.equal(etiquetaCercana(85, MARCAS_VELO), 'Fuerte');
});

test('etiquetaCercana: en un empate exacto, gana la PRIMERA marca de la lista', () => {
  const empate = [{ valor: 10, etiqueta: 'A' }, { valor: 20, etiqueta: 'B' }];
  assert.equal(etiquetaCercana(15, empate), 'A');
});

test('etiquetaCercana: sin marcas, cadena vacía — nunca lanza', () => {
  assert.equal(etiquetaCercana(50, []), '');
});
