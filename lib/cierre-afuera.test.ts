// lib/cierre-afuera.test.ts — § NAV-CIERRE-CLICK-AFUERA-1
//
// Afirma la decisión PURA de `esClickAfuera` con nodos FALSOS (implementan sólo `.contains`, sin
// depender de una clase DOM real — el repo no tiene jsdom). El mecanismo real de cierre (el
// listener en `document`, capturado contra un `backdrop-filter` que confina el fondo visual) es
// capa 3 — se verificó por ejecución contra el dev server real, no se re-simula acá.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { esClickAfuera, type NodoDeCierre } from './cierre-afuera';

function nodoFalso(idsDentro: readonly unknown[]): NodoDeCierre {
  return { contains: (otro) => idsDentro.includes(otro) };
}

test('cierra cuando el destino no pertenece a ningún nodo dado', () => {
  const panel = nodoFalso(['panel-hijo']);
  assert.equal(esClickAfuera('afuera', [panel]), true);
});

test('NO cierra cuando el destino pertenece al panel', () => {
  const panel = nodoFalso(['panel-hijo']);
  assert.equal(esClickAfuera('panel-hijo', [panel]), false);
});

test('NO cierra cuando el destino pertenece al disparador — evita cerrar-y-reabrir en el mismo gesto', () => {
  const panel = nodoFalso(['panel-hijo']);
  const disparador = nodoFalso(['boton-trigger']);
  assert.equal(esClickAfuera('boton-trigger', [panel, disparador]), false);
});

test('cierra cuando el destino no pertenece NI al panel NI al disparador', () => {
  const panel = nodoFalso(['panel-hijo']);
  const disparador = nodoFalso(['boton-trigger']);
  assert.equal(esClickAfuera('cualquier-otra-cosa', [panel, disparador]), true);
});

test('sin destino (null) el default es NO cerrar — preferir callar a adivinar', () => {
  const panel = nodoFalso(['panel-hijo']);
  assert.equal(esClickAfuera(null, [panel]), false);
});

test('sin destino (undefined) el default es NO cerrar', () => {
  const panel = nodoFalso(['panel-hijo']);
  assert.equal(esClickAfuera(undefined, [panel]), false);
});

test('ignora nodos ausentes (null/undefined) en la lista, sin lanzar', () => {
  assert.equal(esClickAfuera('afuera', [null, undefined]), true);
});

test('lista de nodos vacía: cualquier destino real cuenta como afuera', () => {
  assert.equal(esClickAfuera('lo-que-sea', []), true);
});
