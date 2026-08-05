import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  concentracionIngresos, MIN_CLIENTES_CONCENTRACION, TOP_CONCENTRACION,
  type ClienteIngreso,
} from './concentracion';

// La guarda de muestra es lo que separa este número de una alarma inventada: con
// cinco clientes el top-5 es el 100% por aritmética, no por concentración.

const cliente = (id: string, total: number): ClienteIngreso =>
  ({ id, nombre: `Cliente ${id}`, total, ordenes: 1 });

const nClientes = (n: number, total = 10_000) =>
  Array.from({ length: n }, (_, i) => cliente(`c${i}`, total));

test('reparte el % del top sobre el total', () => {
  const r = concentracionIngresos([
    ...nClientes(5, 100_000),  // top 5 = 500.000
    ...nClientes(5, 100_000).map((c, i) => cliente(`x${i}`, 100_000)),
  ]);
  assert.equal(r.total, 1_000_000);
  assert.equal(r.totalTop, 500_000);
  assert.equal(r.pct, 50);
});

test('devuelve los N primeros, ordenados por dinero pagado desc', () => {
  const r = concentracionIngresos([
    cliente('a', 10_000), cliente('b', 90_000), cliente('c', 50_000),
    cliente('d', 20_000), cliente('e', 30_000), cliente('f', 40_000),
  ]);
  assert.equal(r.top.length, TOP_CONCENTRACION);
  assert.deepEqual(r.top.map(c => c.id), ['b', 'c', 'f', 'e', 'd']);
});

test('con muestra insuficiente el % es null — la lista se muestra igual', () => {
  // EL caso que motiva la guarda: 5 clientes dan 100% por construcción, y ese
  // 100% se lee como "todo depende de cinco personas" cuando solo dice que el
  // negocio tiene cinco clientes.
  const r = concentracionIngresos(nClientes(TOP_CONCENTRACION, 100_000));
  assert.equal(r.pct, null);
  assert.equal(r.top.length, TOP_CONCENTRACION);   // la lista SÍ se muestra
  assert.equal(r.totalTop, 500_000);
});

test('justo en el piso de muestra el % ya se emite', () => {
  const r = concentracionIngresos(nClientes(MIN_CLIENTES_CONCENTRACION, 100_000));
  assert.notEqual(r.pct, null);
});

test('los clientes SIN pagos no cuentan para la muestra ni diluyen el %', () => {
  // Importar una lista de contactos no puede "mejorar" la concentración sin que
  // entre un solo peso.
  const conCeros = [...nClientes(TOP_CONCENTRACION, 100_000), ...nClientes(50, 0)];
  const r = concentracionIngresos(conCeros);
  assert.equal(r.clientes, TOP_CONCENTRACION);
  assert.equal(r.pct, null);           // sigue sin base pese a los 55 registros
  assert.equal(r.total, 500_000);
});

test('sin clientes: cero, null y lista vacía', () => {
  const r = concentracionIngresos([]);
  assert.deepEqual(r.top, []);
  assert.equal(r.total, 0);
  assert.equal(r.pct, null);
  assert.equal(r.clientes, 0);
});

test('empate en dinero: orden estable por nombre', () => {
  const r = concentracionIngresos([
    { id: 'z', nombre: 'Zulma', total: 10_000, ordenes: 1 },
    { id: 'a', nombre: 'Ana',   total: 10_000, ordenes: 1 },
  ]);
  assert.deepEqual(r.top.map(c => c.nombre), ['Ana', 'Zulma']);
});

test('un solo cliente con toda la plata: 100% pero sin base → null', () => {
  const r = concentracionIngresos([cliente('a', 999_000)]);
  assert.equal(r.pct, null);
  assert.equal(r.totalTop, 999_000);
});
