import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creditosVisibles, filasCompletas, MIN_FILAS_CREDITOS, type CreditoItem } from './creditos';

const fila = (etiqueta: string, valor: string): CreditoItem => ({ etiqueta, valor });

test('MIN_FILAS_CREDITOS es 3 (§ el spec: "Se oculta con menos de 3 filas")', () => {
  assert.equal(MIN_FILAS_CREDITOS, 3);
});

test('creditosVisibles: sin filas, no se muestra', () => {
  assert.equal(creditosVisibles([]), false);
});

test('creditosVisibles: con 1 o 2 filas completas, no se muestra', () => {
  assert.equal(creditosVisibles([fila('Origen', 'San Adolfo, Huila')]), false);
  assert.equal(creditosVisibles([fila('Origen', 'San Adolfo, Huila'), fila('Altitud', '1.500–1.800 msnm')]), false);
});

test('creditosVisibles: con 3 filas completas, SÍ se muestra', () => {
  assert.equal(
    creditosVisibles([
      fila('Origen', 'San Adolfo, Huila'),
      fila('Altitud', '1.500–1.800 msnm'),
      fila('Proceso', 'Lavado, secado al sol'),
    ]),
    true,
  );
});

test('creditosVisibles: una fila a medias (sólo etiqueta, o sólo valor) NO cuenta para el piso', () => {
  const items = [
    fila('Origen', 'San Adolfo, Huila'),
    fila('Altitud', '1.500–1.800 msnm'),
    fila('Proceso', ''), // a medias: no cuenta
    fila('', 'Marzo – junio'), // a medias: no cuenta
  ];
  assert.equal(creditosVisibles(items), false); // sólo 2 filas completas
});

test('creditosVisibles: espacios en blanco cuentan como vacío', () => {
  const items = [
    fila('Origen', '   '),
    fila('Altitud', '1.500–1.800 msnm'),
    fila('Proceso', 'Lavado, secado al sol'),
  ];
  assert.equal(creditosVisibles(items), false); // sólo 2 completas (Origen queda fuera por el espacio en blanco)
  assert.equal(filasCompletas(items).length, 2);
});

test('filasCompletas: devuelve sólo las filas con etiqueta y valor no vacíos, en su orden', () => {
  const items = [
    fila('Origen', 'San Adolfo, Huila'),
    fila('', 'sin etiqueta'),
    fila('Altitud', '1.500–1.800 msnm'),
  ];
  assert.deepEqual(filasCompletas(items), [
    fila('Origen', 'San Adolfo, Huila'),
    fila('Altitud', '1.500–1.800 msnm'),
  ]);
});
