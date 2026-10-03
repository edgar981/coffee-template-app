import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearHistorialEditor, sonIguales } from './historial-editor';

// EL HISTORIAL (§ EDITOR-TIENDA-DESHACER-1) — pila genérica, sin React ni DOM. Cada paso es un par
// de callbacks de prueba que sólo cuentan llamadas y registran orden, para afirmar la MECÁNICA
// (deshacer saca de una pila y mete en la otra; registrar corta el rehacer) sin ningún conocimiento
// de qué hay "detrás" de un paso real.

function pasoDeMentira(etiqueta: string, log: string[]) {
  return {
    deshacer: () => log.push(`deshacer:${etiqueta}`),
    rehacer: () => log.push(`rehacer:${etiqueta}`),
  };
}

test('deshacer/rehacer vacíos son no-ops que devuelven false, nunca lanzan', () => {
  const h = crearHistorialEditor();
  assert.equal(h.deshacer(), false);
  assert.equal(h.rehacer(), false);
  assert.equal(h.puedeDeshacer(), false);
  assert.equal(h.puedeRehacer(), false);
});

test('registrar → deshacer aplica el callback de deshacer y mueve el paso a la pila de rehacer', () => {
  const h = crearHistorialEditor();
  const log: string[] = [];
  h.registrar(pasoDeMentira('A', log));
  assert.equal(h.puedeDeshacer(), true);
  assert.equal(h.puedeRehacer(), false);

  assert.equal(h.deshacer(), true);
  assert.deepEqual(log, ['deshacer:A']);
  assert.equal(h.puedeDeshacer(), false);
  assert.equal(h.puedeRehacer(), true);
});

test('rehacer aplica el callback de rehacer y lo devuelve a la pila de deshacer (round-trip)', () => {
  const h = crearHistorialEditor();
  const log: string[] = [];
  h.registrar(pasoDeMentira('A', log));
  h.deshacer();
  assert.equal(h.rehacer(), true);
  assert.deepEqual(log, ['deshacer:A', 'rehacer:A']);
  assert.equal(h.puedeDeshacer(), true);
  assert.equal(h.puedeRehacer(), false);

  // round-trip completo: deshacer de nuevo vuelve a funcionar
  assert.equal(h.deshacer(), true);
  assert.deepEqual(log, ['deshacer:A', 'rehacer:A', 'deshacer:A']);
});

test('tres pasos, deshacer tres veces vuelve exactamente al orden inverso de registro', () => {
  const h = crearHistorialEditor();
  const log: string[] = [];
  h.registrar(pasoDeMentira('A', log));
  h.registrar(pasoDeMentira('B', log));
  h.registrar(pasoDeMentira('C', log));

  h.deshacer(); h.deshacer(); h.deshacer();
  assert.deepEqual(log, ['deshacer:C', 'deshacer:B', 'deshacer:A']);
  assert.equal(h.deshacer(), false, 'la pila ya está vacía — un cuarto deshacer es no-op');
  assert.equal(h.tamano().deshacer, 0);
  assert.equal(h.tamano().rehacer, 3);
});

test('REGISTRAR UN PASO NUEVO CORTA EL REHACER — editar tras deshacer descarta la rama vieja', () => {
  const h = crearHistorialEditor();
  const log: string[] = [];
  h.registrar(pasoDeMentira('A', log));
  h.registrar(pasoDeMentira('B', log));
  h.deshacer(); // B queda en la pila de rehacer
  assert.equal(h.puedeRehacer(), true);

  h.registrar(pasoDeMentira('C', log)); // un paso NUEVO tras deshacer
  assert.equal(h.puedeRehacer(), false, 'B ya no se puede rehacer — la rama se cortó');
  assert.equal(h.deshacer(), true);
  assert.deepEqual(log.slice(-1), ['deshacer:C'], 'deshacer ahora revierte C, nunca resucita B');
});

test('tamano() refleja el largo de las dos pilas en todo momento', () => {
  const h = crearHistorialEditor();
  const log: string[] = [];
  assert.deepEqual(h.tamano(), { deshacer: 0, rehacer: 0 });
  h.registrar(pasoDeMentira('A', log));
  h.registrar(pasoDeMentira('B', log));
  assert.deepEqual(h.tamano(), { deshacer: 2, rehacer: 0 });
  h.deshacer();
  assert.deepEqual(h.tamano(), { deshacer: 1, rehacer: 1 });
});

test('limpiar() vacía las dos pilas — el siguiente deshacer/rehacer es no-op', () => {
  const h = crearHistorialEditor();
  const log: string[] = [];
  h.registrar(pasoDeMentira('A', log));
  h.deshacer();
  assert.equal(h.puedeRehacer(), true);

  h.limpiar();
  assert.equal(h.puedeDeshacer(), false);
  assert.equal(h.puedeRehacer(), false);
  assert.equal(h.deshacer(), false);
  assert.equal(h.rehacer(), false);
});

// ── sonIguales — la igualdad ESTRUCTURAL que decide si un lote de ediciones es un no-op ──────────

test('sonIguales: primitivos', () => {
  assert.equal(sonIguales('a', 'a'), true);
  assert.equal(sonIguales('a', 'b'), false);
  assert.equal(sonIguales(true, true), true);
  assert.equal(sonIguales(true, false), false);
  assert.equal(sonIguales(1, 1), true);
  assert.equal(sonIguales(null, null), true);
  assert.equal(sonIguales(null, undefined), false, 'null y undefined NO son el mismo valor para este módulo');
});

test('sonIguales: objetos planos, insensible al ORDEN de claves', () => {
  assert.equal(sonIguales({ a: 1, b: 2 }, { b: 2, a: 1 }), true);
  assert.equal(sonIguales({ a: 1, b: 2 }, { a: 1, b: 3 }), false);
  assert.equal(sonIguales({ a: 1 }, { a: 1, b: 2 }), false, 'una clave de más SÍ es una diferencia');
});

test('sonIguales: arrays —orden SÍ importa (son secuencias, no sets)', () => {
  assert.equal(sonIguales(['a', 'b'], ['a', 'b']), true);
  assert.equal(sonIguales(['a', 'b'], ['b', 'a']), false);
  assert.equal(sonIguales(['a', 'b'], ['a', 'b', 'c']), false);
});

test('sonIguales: anidado (el caso real — un repeater de ítems dentro de una sección)', () => {
  const a = { titulo: 'Hola', items: [{ nombre: 'Uno', stars: 5 }, { nombre: 'Dos', stars: 4 }] };
  const b = { titulo: 'Hola', items: [{ nombre: 'Uno', stars: 5 }, { nombre: 'Dos', stars: 4 }] };
  const c = { titulo: 'Hola', items: [{ nombre: 'Uno', stars: 5 }, { nombre: 'Dos', stars: 3 }] };
  assert.equal(sonIguales(a, b), true);
  assert.equal(sonIguales(a, c), false);
});
