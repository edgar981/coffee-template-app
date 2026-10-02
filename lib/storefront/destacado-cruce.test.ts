import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  cruceInicial,
  cruceConNuevoObjetivo,
  cruceConEntrandoListo,
  cruceConFundidoCompleto,
  capasDeCruceDestacado,
} from './destacado-cruce';

// ── EL ESTADO INICIAL ────────────────────────────────────────────────────────────────────────

test('cruceInicial: una sola foto, opaca, sin cruce en curso', () => {
  assert.deepEqual(cruceInicial('a.jpg'), { visible: 'a.jpg', entrando: null, entrandoListo: false });
});

test('capasDeCruceDestacado del estado inicial: UNA sola capa, fija, opacidad 1', () => {
  const capas = capasDeCruceDestacado(cruceInicial('a.jpg'));
  assert.equal(capas.length, 1);
  assert.deepEqual(capas[0], { src: 'a.jpg', rol: 'fija', opacidadObjetivo: 1 });
});

// ── CAMBIAR DE OBJETIVO ──────────────────────────────────────────────────────────────────────

test('cruceConNuevoObjetivo: un objetivo nuevo arranca el fundido, SIN marcarlo listo', () => {
  const e = cruceConNuevoObjetivo(cruceInicial('a.jpg'), 'b.jpg');
  assert.deepEqual(e, { visible: 'a.jpg', entrando: 'b.jpg', entrandoListo: false });
});

test('cruceConNuevoObjetivo: el mismo objetivo que ya está "entrando" es no-op (no reinicia entrandoListo)', () => {
  const entrando = cruceConNuevoObjetivo(cruceInicial('a.jpg'), 'b.jpg');
  const listo = cruceConEntrandoListo(entrando, 'b.jpg');
  const otraVez = cruceConNuevoObjetivo(listo, 'b.jpg');
  assert.deepEqual(otraVez, listo);
});

test('cruceConNuevoObjetivo: volver a la foto YA visible cancela un fundido a medio camino hacia otra', () => {
  const entrando = cruceConNuevoObjetivo(cruceInicial('a.jpg'), 'b.jpg');
  const vueltaAtras = cruceConNuevoObjetivo(entrando, 'a.jpg');
  assert.deepEqual(vueltaAtras, { visible: 'a.jpg', entrando: null, entrandoListo: false });
});

test('cruceConNuevoObjetivo: volver a la foto visible SIN nada entrando es un no-op de verdad (misma referencia)', () => {
  const inicial = cruceInicial('a.jpg');
  assert.equal(cruceConNuevoObjetivo(inicial, 'a.jpg'), inicial);
});

test('cruceConNuevoObjetivo: un TERCER objetivo reemplaza al que estaba entrando — la primera elección nunca se promueve', () => {
  const entrandoB = cruceConNuevoObjetivo(cruceInicial('a.jpg'), 'b.jpg');
  const entrandoC = cruceConNuevoObjetivo(entrandoB, 'c.jpg');
  assert.deepEqual(entrandoC, { visible: 'a.jpg', entrando: 'c.jpg', entrandoListo: false });
});

test('cruceConNuevoObjetivo: reemplazar descarta también un entrando que YA estaba listo', () => {
  const entrandoB = cruceConNuevoObjetivo(cruceInicial('a.jpg'), 'b.jpg');
  const bListo = cruceConEntrandoListo(entrandoB, 'b.jpg');
  const entrandoC = cruceConNuevoObjetivo(bListo, 'c.jpg');
  assert.deepEqual(entrandoC, { visible: 'a.jpg', entrando: 'c.jpg', entrandoListo: false });
});

// ── LA FOTO ENTRANTE CONFIRMA CARGA ──────────────────────────────────────────────────────────

test('cruceConEntrandoListo: marca lista la foto que SÍ está entrando', () => {
  const entrando = cruceConNuevoObjetivo(cruceInicial('a.jpg'), 'b.jpg');
  const listo = cruceConEntrandoListo(entrando, 'b.jpg');
  assert.deepEqual(listo, { visible: 'a.jpg', entrando: 'b.jpg', entrandoListo: true });
});

test('cruceConEntrandoListo: una confirmación RANCIA (de un objetivo que ya no es el vigente) se ignora', () => {
  const entrandoB = cruceConNuevoObjetivo(cruceInicial('a.jpg'), 'b.jpg');
  const entrandoC = cruceConNuevoObjetivo(entrandoB, 'c.jpg'); // el visitante ya cambió de elección
  const tardeLlegaB = cruceConEntrandoListo(entrandoC, 'b.jpg');
  assert.deepEqual(tardeLlegaB, entrandoC); // b.jpg no es el objetivo vigente — se descarta
});

test('cruceConEntrandoListo: sin ningún cruce en curso, confirmar cualquier src es no-op', () => {
  const inicial = cruceInicial('a.jpg');
  assert.equal(cruceConEntrandoListo(inicial, 'a.jpg'), inicial);
  assert.equal(cruceConEntrandoListo(inicial, 'b.jpg'), inicial);
});

test('cruceConEntrandoListo: idempotente — confirmar dos veces la misma foto no cambia nada', () => {
  const entrando = cruceConNuevoObjetivo(cruceInicial('a.jpg'), 'b.jpg');
  const listo = cruceConEntrandoListo(entrando, 'b.jpg');
  assert.equal(cruceConEntrandoListo(listo, 'b.jpg'), listo);
});

// ── EL FUNDIDO TERMINA ───────────────────────────────────────────────────────────────────────

test('cruceConFundidoCompleto: promueve la foto lista a "visible" y cierra el cruce', () => {
  const entrando = cruceConNuevoObjetivo(cruceInicial('a.jpg'), 'b.jpg');
  const listo = cruceConEntrandoListo(entrando, 'b.jpg');
  const completo = cruceConFundidoCompleto(listo, 'b.jpg');
  assert.deepEqual(completo, { visible: 'b.jpg', entrando: null, entrandoListo: false });
});

test('cruceConFundidoCompleto: una finalización RANCIA (el objetivo cambió mientras fundía) se ignora', () => {
  const entrandoB = cruceConNuevoObjetivo(cruceInicial('a.jpg'), 'b.jpg');
  const bListo = cruceConEntrandoListo(entrandoB, 'b.jpg');
  const entrandoC = cruceConNuevoObjetivo(bListo, 'c.jpg'); // el visitante cambió de elección
  const tardeCompletaB = cruceConFundidoCompleto(entrandoC, 'b.jpg');
  assert.deepEqual(tardeCompletaB, entrandoC); // b.jpg ya no es el objetivo — no se promueve
});

test('cruceConFundidoCompleto: no promueve una foto que nunca se marcó lista (defensivo)', () => {
  const entrando = cruceConNuevoObjetivo(cruceInicial('a.jpg'), 'b.jpg'); // entrandoListo: false
  const intento = cruceConFundidoCompleto(entrando, 'b.jpg');
  assert.deepEqual(intento, entrando);
});

test('cruceConFundidoCompleto: sin ningún cruce en curso, completar cualquier src es no-op', () => {
  const inicial = cruceInicial('a.jpg');
  assert.equal(cruceConFundidoCompleto(inicial, 'a.jpg'), inicial);
});

// ── EL ORDEN DE PINTADO — el invariante central de este slice ──────────────────────────────────

test('capasDeCruceDestacado: con un cruce en curso pero SIN cargar, hay DOS capas — fija (opacidad 1) PRIMERO, entrando (opacidad 0) SEGUNDO', () => {
  const entrando = cruceConNuevoObjetivo(cruceInicial('a.jpg'), 'b.jpg');
  const capas = capasDeCruceDestacado(entrando);
  assert.equal(capas.length, 2);
  assert.deepEqual(capas[0], { src: 'a.jpg', rol: 'fija', opacidadObjetivo: 1 });
  assert.deepEqual(capas[1], { src: 'b.jpg', rol: 'entrando', opacidadObjetivo: 0 });
});

test('capasDeCruceDestacado: una vez lista, "entrando" sube a opacidad objetivo 1 — "fija" NUNCA deja de ser 1', () => {
  const entrando = cruceConNuevoObjetivo(cruceInicial('a.jpg'), 'b.jpg');
  const listo = cruceConEntrandoListo(entrando, 'b.jpg');
  const capas = capasDeCruceDestacado(listo);
  assert.deepEqual(capas[0], { src: 'a.jpg', rol: 'fija', opacidadObjetivo: 1 });
  assert.deepEqual(capas[1], { src: 'b.jpg', rol: 'entrando', opacidadObjetivo: 1 });
});

test('capasDeCruceDestacado: terminado el fundido, vuelve a UNA sola capa — la nueva foto, opaca', () => {
  const entrando = cruceConNuevoObjetivo(cruceInicial('a.jpg'), 'b.jpg');
  const listo = cruceConEntrandoListo(entrando, 'b.jpg');
  const completo = cruceConFundidoCompleto(listo, 'b.jpg');
  const capas = capasDeCruceDestacado(completo);
  assert.equal(capas.length, 1);
  assert.deepEqual(capas[0], { src: 'b.jpg', rol: 'fija', opacidadObjetivo: 1 });
});

// EL INVARIANTE CENTRAL: recorriendo el ciclo de vida COMPLETO de un cruce (elegir → cargar →
// terminar de fundir), la capa 'fija' NUNCA aparece con una opacidad objetivo distinta de 1 — es
// justo lo que garantiza que el fondo nunca pueda asomar (§ el docstring de cabecera: el píxel
// compuesto es SIEMPRE una combinación convexa de las dos fotos reales, nunca del fondo).
test('INVARIANTE: en NINGÚN paso del ciclo de vida la capa "fija" tiene opacidad objetivo distinta de 1', () => {
  let estado = cruceInicial('a.jpg');
  const pasos = [
    () => (estado = cruceConNuevoObjetivo(estado, 'b.jpg')),
    () => (estado = cruceConEntrandoListo(estado, 'b.jpg')),
    () => (estado = cruceConFundidoCompleto(estado, 'b.jpg')),
    () => (estado = cruceConNuevoObjetivo(estado, 'c.jpg')),
    () => (estado = cruceConNuevoObjetivo(estado, 'd.jpg')), // reemplaza antes de cargar
    () => (estado = cruceConEntrandoListo(estado, 'd.jpg')),
    () => (estado = cruceConFundidoCompleto(estado, 'd.jpg')),
  ];
  for (const paso of pasos) {
    paso();
    const capas = capasDeCruceDestacado(estado);
    const fija = capas.find((c) => c.rol === 'fija');
    assert.ok(fija, 'siempre debe existir una capa fija');
    assert.equal(fija!.opacidadObjetivo, 1);
    // Y nunca hay DOS capas con opacidad objetivo 1 Y rol distinto a la vez además de la fija
    // siendo la ÚNICA que puede valer 1 junto con, como mucho, una "entrando" YA lista — nunca
    // dos capas "a medio camino" simultáneamente, porque sólo existen los roles fija/entrando.
    assert.ok(capas.length <= 2);
  }
});

// ── EL ORDEN ES POSICIONAL, NO SÓLO DE ROL ──────────────────────────────────────────────────

test('EL ORDEN: "entrando" siempre va en el índice 1 cuando existe — nunca antes que "fija"', () => {
  const entrando = cruceConNuevoObjetivo(cruceInicial('a.jpg'), 'b.jpg');
  const capas = capasDeCruceDestacado(entrando);
  const indiceFija = capas.findIndex((c) => c.rol === 'fija');
  const indiceEntrando = capas.findIndex((c) => c.rol === 'entrando');
  assert.equal(indiceFija, 0);
  assert.equal(indiceEntrando, 1);
  assert.ok(indiceFija < indiceEntrando);
});
