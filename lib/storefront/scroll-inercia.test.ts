import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PASO_INERCIA,
  UMBRAL_ASENTAMIENTO,
  pasoInercia,
  seAsento,
  limiteScroll,
  objetivoTrasRueda,
  debeUsarScrollNativo,
  debeInterceptarRueda,
} from './scroll-inercia';

// Capa 1 del mecanismo de inercia (§ SCROLL-INERCIA-CORTE-1). Puro, sin DOM — lo que se afirma es la
// FÓRMULA (idéntica a `js/app.js:209-244` del prototipo) y las DECISIONES de cuándo interceptar, no
// el envoltorio de `window`/RAF que vive en `ScrollInercia.tsx` (capa 3).

test('PASO_INERCIA y UMBRAL_ASENTAMIENTO son los literales del prototipo (js/app.js:223-224)', () => {
  assert.equal(PASO_INERCIA, 0.12);
  assert.equal(UMBRAL_ASENTAMIENTO, 0.4);
});

test('pasoInercia: la MISMA fórmula que el prototipo — current += (target - current) * 0.12', () => {
  assert.equal(pasoInercia(0, 100), 12);
  assert.equal(pasoInercia(100, 100), 100); // ya en el objetivo: no se mueve
  assert.equal(pasoInercia(50, 0), 44); // 50 + (0 - 50) * 0.12
});

test('pasoInercia acepta un paso custom, sin tocar el default exportado', () => {
  assert.equal(pasoInercia(0, 100, 0.5), 50);
  assert.equal(PASO_INERCIA, 0.12); // el default no se mutó
});

test('pasoInercia: una SERIE de pasos converge hacia el objetivo — la curva del prototipo', () => {
  // Reproduce la secuencia que `ScrollInercia.tsx` dispara frame a frame: la misma fórmula, aplicada
  // repetidamente, tiene que ACERCARSE monótonamente y terminar asentada. Es la mitad Node de "una
  // serie de scrollY por frame… que muestren la misma curva" que el Cierre del slice pide medir
  // también en Chromium (capa 3, sobre DOM real).
  let actual = 0;
  const objetivo = 1000;
  const serie: number[] = [actual];
  // Distancia tras n frames = objetivo·(1-0.12)^n; para llegar bajo el umbral (0.4) hacen falta
  // ~62 frames (1000·0.88^62 ≈ 0.37) — 120 de tope da margen sin volverse una foto del número exacto.
  for (let i = 0; i < 120 && !seAsento(actual, objetivo); i++) {
    actual = pasoInercia(actual, objetivo);
    serie.push(actual);
  }
  // Valores EXACTOS de los primeros 3 frames, a mano contra la fórmula: 0→120→225.6→318.528.
  assert.equal(serie[1], 120);
  assert.equal(serie[2], 225.6);
  assert.equal(Math.round(serie[3] * 1000) / 1000, 318.528);
  // Monótona creciente hacia 1000 (nunca se pasa, nunca retrocede).
  for (let i = 1; i < serie.length; i++) {
    assert.ok(serie[i] > serie[i - 1]);
    assert.ok(serie[i] <= objetivo);
  }
  assert.ok(seAsento(actual, objetivo)); // terminó asentada, no cortada por el tope de 120 frames
});

test('seAsento: estricta (<), no <= — exactamente el umbral NO se considera asentado', () => {
  assert.equal(seAsento(99.6, 100), false); // distancia exacta 0.4
  assert.equal(seAsento(99.61, 100), true); // distancia 0.39, por debajo
  assert.equal(seAsento(100, 100), true); // distancia 0
});

test('seAsento acepta un umbral custom', () => {
  assert.equal(seAsento(95, 100, 5), false); // distancia exacta 5, umbral 5 → no asentado (estricta)
  assert.equal(seAsento(95.1, 100, 5), true);
});

test('limiteScroll: alto del documento menos el viewport', () => {
  assert.equal(limiteScroll(3000, 800), 2200);
});

test('limiteScroll: nunca negativo — un documento más corto que el viewport no tiene scroll', () => {
  assert.equal(limiteScroll(600, 800), 0);
  assert.equal(limiteScroll(800, 800), 0);
});

test('objetivoTrasRueda: acumula el delta sobre el objetivo previo, no sobre la posición actual', () => {
  assert.equal(objetivoTrasRueda(100, 50, 10000), 150);
  assert.equal(objetivoTrasRueda(100, -30, 10000), 70);
});

test('objetivoTrasRueda: acotado a [0, limite] — nunca se sale del documento', () => {
  assert.equal(objetivoTrasRueda(10, -100, 5000), 0); // no baja de 0
  assert.equal(objetivoTrasRueda(4990, 100, 5000), 5000); // no sube del límite
  assert.equal(objetivoTrasRueda(0, -1, 5000), 0);
});

test('debeUsarScrollNativo: movimiento reducido → true, sin importar el puntero', () => {
  assert.equal(debeUsarScrollNativo({ movimientoReducido: true, punteroGrueso: false }), true);
  assert.equal(debeUsarScrollNativo({ movimientoReducido: true, punteroGrueso: true }), true);
});

test('debeUsarScrollNativo: puntero grueso (táctil) → true, aunque no haya movimiento reducido', () => {
  assert.equal(debeUsarScrollNativo({ movimientoReducido: false, punteroGrueso: true }), true);
});

test('debeUsarScrollNativo: ninguna de las dos → false (se monta la inercia)', () => {
  assert.equal(debeUsarScrollNativo({ movimientoReducido: false, punteroGrueso: false }), false);
});

const RUEDA_BASE = { ctrlKey: false, cuerpoBloqueado: false, deltaX: 0, deltaY: 10, dentroDeScrollPropio: false };

test('debeInterceptarRueda: el caso normal (deltaY vertical, nada bloqueado) → true', () => {
  assert.equal(debeInterceptarRueda(RUEDA_BASE), true);
});

test('debeInterceptarRueda: ctrlKey (zoom del navegador) → false', () => {
  assert.equal(debeInterceptarRueda({ ...RUEDA_BASE, ctrlKey: true }), false);
});

test('debeInterceptarRueda: cuerpo bloqueado (modal/drawer con scroll-lock) → false', () => {
  assert.equal(debeInterceptarRueda({ ...RUEDA_BASE, cuerpoBloqueado: true }), false);
});

test('debeInterceptarRueda: dentro de un elemento con scroll propio → false', () => {
  assert.equal(debeInterceptarRueda({ ...RUEDA_BASE, dentroDeScrollPropio: true }), false);
});

test('debeInterceptarRueda: gesto predominantemente HORIZONTAL (trackpad, el track del riel) → false', () => {
  assert.equal(debeInterceptarRueda({ ...RUEDA_BASE, deltaX: 20, deltaY: 5 }), false);
});

test('debeInterceptarRueda: deltaX igual a deltaY → sigue interceptando (no ESTRICTAMENTE mayor)', () => {
  assert.equal(debeInterceptarRueda({ ...RUEDA_BASE, deltaX: 10, deltaY: 10 }), true);
});

test('debeInterceptarRueda: deltaX levemente mayor que deltaY (diagonal, gana el eje vertical) → true', () => {
  // Un trackpad puro-vertical casi nunca da deltaX===0 exacto; sólo un deltaX CLARAMENTE dominante
  // (el caso de arriba) debe ceder el gesto al scroll horizontal.
  assert.equal(debeInterceptarRueda({ ...RUEDA_BASE, deltaX: 2, deltaY: 10 }), true);
});

test('debeInterceptarRueda: las CUATRO salidas son independientes — cualquiera sola basta para no interceptar', () => {
  assert.equal(debeInterceptarRueda({ ctrlKey: true, cuerpoBloqueado: false, deltaX: 0, deltaY: 10, dentroDeScrollPropio: false }), false);
  assert.equal(debeInterceptarRueda({ ctrlKey: false, cuerpoBloqueado: true, deltaX: 0, deltaY: 10, dentroDeScrollPropio: false }), false);
  assert.equal(debeInterceptarRueda({ ctrlKey: false, cuerpoBloqueado: false, deltaX: 30, deltaY: 10, dentroDeScrollPropio: false }), false);
  assert.equal(debeInterceptarRueda({ ctrlKey: false, cuerpoBloqueado: false, deltaX: 0, deltaY: 10, dentroDeScrollPropio: true }), false);
});
