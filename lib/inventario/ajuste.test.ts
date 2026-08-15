import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esAbsoluto, cantidadInicial, limitesDeCantidad, errorDeCantidad } from './ajuste';
import type { InventoryMovementType } from '@/types/inventory';

const DELTAS: InventoryMovementType[] = ['entrada', 'salida', 'devolucion'];

// ─── EL PRE-LLENADO · la asimetría ES la decisión ────────────────────────────
//
// Lo que estos tests protegen no es que el campo se llene: es que se llene SÓLO
// donde el número reemplaza al stock. Sembrar el stock actual en un delta
// significaría "sumar 27" o "restar 27" de un solo Enter — el mismo gesto que en
// `ajuste` es correcto, en los otros tres es un movimiento de inventario falso.

test('`ajuste` arranca con el stock actual — se corrige DESDE el valor real', () => {
  assert.equal(cantidadInicial('ajuste', 27), '27');
  // El cero es un valor legítimo y se siembra igual: "no queda ninguno".
  assert.equal(cantidadInicial('ajuste', 0), '0');
});

test('los DELTA arrancan VACÍOS — y esto es lo que evita el error grave', () => {
  for (const tipo of DELTAS) {
    assert.equal(cantidadInicial(tipo, 27), '', `${tipo} no debe pre-llenarse`);
  }
});

test('sin producto elegido no hay stock que sembrar, ni siquiera en `ajuste`', () => {
  assert.equal(cantidadInicial('ajuste', undefined), '');
  assert.equal(cantidadInicial('ajuste', null), '');
});

test('sólo `ajuste` es absoluto', () => {
  assert.equal(esAbsoluto('ajuste'), true);
  for (const tipo of DELTAS) assert.equal(esAbsoluto(tipo), false);
});

// ─── LOS LÍMITES ─────────────────────────────────────────────────────────────

test('una SALIDA no puede dejar el stock negativo — su tope es el stock', () => {
  assert.deepEqual(limitesDeCantidad('salida', 27), { min: 1, max: 27 });
  // Anticipa el 409 del servidor; NO lo reemplaza (§ el docstring): entre abrir
  // el modal y aplicar, otro movimiento pudo cambiar el stock.
  assert.equal(errorDeCantidad('salida', '28', 27), 'Sólo hay 27 unidades disponibles.');
  assert.equal(errorDeCantidad('salida', '27', 27), null);
});

test('las ENTRADAS no tienen tope: reponer no está acotado por lo que hay', () => {
  assert.equal(limitesDeCantidad('entrada', 27).max, undefined);
  assert.equal(limitesDeCantidad('devolucion', 27).max, undefined);
  assert.equal(errorDeCantidad('entrada', '9999', 27), null);
});

test('sin stock conocido, la salida no inventa un tope', () => {
  assert.deepEqual(limitesDeCantidad('salida', undefined), { min: 1 });
  assert.equal(errorDeCantidad('salida', '9999', undefined), null);
});

test('un movimiento de CERO no es un movimiento — salvo en `ajuste`', () => {
  for (const tipo of DELTAS) {
    assert.equal(errorDeCantidad(tipo, '0', 27), 'Un movimiento de cero no mueve nada.');
  }
  // En `ajuste`, cero SÍ significa algo: dejar el stock en cero.
  assert.equal(errorDeCantidad('ajuste', '0', 27), null);
});

test('el `ajuste` rechaza negativos, que es su único borde', () => {
  assert.equal(errorDeCantidad('ajuste', '-1', 27), 'La cantidad no puede ser negativa.');
});

test('el stock se mueve en unidades ENTERAS', () => {
  assert.equal(errorDeCantidad('entrada', '2.5', 27), 'El stock se mueve en unidades enteras.');
  assert.equal(errorDeCantidad('ajuste', '1.5', 27), 'El stock se mueve en unidades enteras.');
});

test('lo que no es número se dice como tal', () => {
  assert.equal(errorDeCantidad('entrada', 'abc', 27), 'Escribe un número.');
});

test('VACÍO no es un error — de eso se encarga el botón deshabilitado', () => {
  // Marcar en rojo lo que todavía no se escribió es regañar por estar escribiendo.
  for (const tipo of [...DELTAS, 'ajuste' as const]) {
    assert.equal(errorDeCantidad(tipo, '', 27), null);
    assert.equal(errorDeCantidad(tipo, '   ', 27), null);
  }
});

test('el mensaje del tope CONCUERDA en singular — lo destapó escribir este test', () => {
  // La primera versión decía "1 unidad disponibles": el plural estaba puesto sólo
  // en el sustantivo. Un mensaje mal escrito no rompe nada y por eso sobrevive.
  assert.equal(errorDeCantidad('salida', '2', 1), 'Sólo hay 1 unidad disponible.');
  assert.equal(errorDeCantidad('salida', '3', 2), 'Sólo hay 2 unidades disponibles.');
});
