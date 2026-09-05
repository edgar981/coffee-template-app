import { test } from 'node:test';
import assert from 'node:assert/strict';
import { empacar, quitar, ultimoLleno } from './lista-plana';

// La DECISIÓN de compactar (diagnóstico b): quitar la fila del medio SUBE las de abajo — nunca deja un
// hueco interior. Así el editor coincide con el storefront (que filtra los vacíos) en el DATO.

test('empacar: los no-vacíos primero, en su orden, rellenando hasta n', () => {
  assert.deepEqual(empacar(['A', '', 'B', ''], 4), ['A', 'B', '', '']);
  assert.deepEqual(empacar(['', '', '', ''], 4), ['', '', '', '']);
  assert.deepEqual(empacar(['A', 'B', 'C', 'D'], 4), ['A', 'B', 'C', 'D']);
  assert.deepEqual(empacar(['  ', 'B'], 2), ['B', '']); // sólo-espacios cuenta como vacío
});

test('quitar el del MEDIO compacta (los de abajo suben)', () => {
  assert.deepEqual(quitar(['A', 'B', 'C', ''], 1), ['A', 'C', '', '']);
  assert.deepEqual(quitar(['A', 'B', 'C', 'D'], 0), ['B', 'C', 'D', '']); // el primero
  assert.deepEqual(quitar(['A', 'B', 'C', 'D'], 3), ['A', 'B', 'C', '']); // el último
});

test('quitar sobre un dato con hueco legado DEVUELVE empacado (no acumula huecos)', () => {
  assert.deepEqual(quitar(['A', '', 'C', ''], 0), ['C', '', '', '']);
});

test('ultimoLleno: índice del último no-vacío (o -1)', () => {
  assert.equal(ultimoLleno(['A', 'B', '', '']), 1);
  assert.equal(ultimoLleno(['A', '', 'C', '']), 2); // el hueco interior se muestra hasta el último lleno
  assert.equal(ultimoLleno(['', '', '', '']), -1);
});
