import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hayCambios, decidirSalida } from './forms';

const base = { nombre: 'Laura', ciudad: '', activo: true, edad: 30 };

test('un objeto igual a sí mismo no tiene cambios', () => {
  assert.equal(hayCambios(base, { ...base }), false);
});

test('una string distinta es un cambio', () => {
  assert.equal(hayCambios({ ...base, ciudad: 'Cali' }, base), true);
});

test('un booleano distinto es un cambio', () => {
  assert.equal(hayCambios({ ...base, activo: false }, base), true);
});

test('un número distinto es un cambio', () => {
  assert.equal(hayCambios({ ...base, edad: 31 }, base), true);
});

// `Object.is` y no `==`: vaciar un campo ('' donde había texto) es una edición
// legítima que tiene que contar como cambio.
test('vaciar un campo que tenía texto es un cambio', () => {
  assert.equal(hayCambios({ ...base, nombre: '' }, base), true);
});

// El caso que un `JSON.stringify` con las claves reordenadas podría tragarse.
test('el orden de las claves no afecta el resultado', () => {
  const a = { activo: true, nombre: 'Laura', ciudad: '', edad: 30 };
  assert.equal(hayCambios(a, base), false);
});

// Una clave que sólo está en uno de los dos cuenta como diferencia: `undefined`
// (ausente) no es `Object.is`-igual a un valor presente.
test('una clave presente sólo en uno cuenta como cambio', () => {
  assert.equal(hayCambios({ ...base, extra: 'x' } as Record<string, unknown>, base), true);
});

// ── decidirSalida ────────────────────────────────────────────────────────────
//
// El caso que PRUEBA el mecanismo del embudo del enlace de cliente: con el
// formulario sucio, salir NO procede directo, CONFIRMA. Sin el chequeo de
// cambios (el "mecanismo"), esto devolvería 'proceder' y el test falla — que es
// justo lo que debe pasar: un enlace que navega saltando la guarda.
test('con cambios y sin mutación: NO procede, CONFIRMA', () => {
  assert.equal(decidirSalida(false, true), 'confirmar');
});

test('sin cambios y sin mutación: procede directo', () => {
  assert.equal(decidirSalida(false, false), 'proceder');
});

// La mutación en vuelo gana sobre todo: no se sale ni para preguntar.
test('en vuelo: bloquea, aunque haya cambios', () => {
  assert.equal(decidirSalida(true, true), 'bloquear');
  assert.equal(decidirSalida(true, false), 'bloquear');
});
