import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insertarEnCursor } from './panel-controles';

test('inserta en el cursor (selección colapsada) sin tocar el resto del texto', () => {
  const r = insertarEnCursor('Hola , bienvenido', 5, 5, '{nombre}');
  assert.equal(r.valor, 'Hola {nombre}, bienvenido');
  assert.equal(r.cursor, 5 + '{nombre}'.length);
});

test('reemplaza una selección NO colapsada', () => {
  // "Hola [AMIGO], bienvenido" con "AMIGO" seleccionado (índices 5..10) → se reemplaza.
  const r = insertarEnCursor('Hola AMIGO, bienvenido', 5, 10, '{nombre}');
  assert.equal(r.valor, 'Hola {nombre}, bienvenido');
});

test('inserta al INICIO del texto (cursor en 0)', () => {
  const r = insertarEnCursor('te escribimos', 0, 0, '{nombre}, ');
  assert.equal(r.valor, '{nombre}, te escribimos');
  assert.equal(r.cursor, '{nombre}, '.length);
});

test('inserta al FINAL del texto (cursor en el largo)', () => {
  const base = 'Hola {nombre}';
  const r = insertarEnCursor(base, base.length, base.length, ', bienvenido');
  assert.equal(r.valor, 'Hola {nombre}, bienvenido');
  assert.equal(r.cursor, base.length + ', bienvenido'.length);
});

test('el texto vacío inserta igual, cursor en 0', () => {
  const r = insertarEnCursor('', 0, 0, '{nombre}');
  assert.equal(r.valor, '{nombre}');
  assert.equal(r.cursor, '{nombre}'.length);
});

test('selectionStart/selectionEnd fuera de rango (negativo o mayor al largo) se ACOTAN', () => {
  const base = 'abc';
  const r1 = insertarEnCursor(base, -5, -5, 'X');
  assert.equal(r1.valor, 'Xabc');
  const r2 = insertarEnCursor(base, 50, 50, 'X');
  assert.equal(r2.valor, 'abcX');
});

test('selectionEnd menor que selectionStart no invierte el reemplazo (fin se acota al inicio)', () => {
  const r = insertarEnCursor('abcdef', 4, 1, 'X');
  // `fin` se acota a `max(inicio, min(selectionEnd, largo))` = max(4, 1) = 4, así que no
  // reemplaza nada hacia atrás: inserta en la posición 4.
  assert.equal(r.valor, 'abcdXef');
});
