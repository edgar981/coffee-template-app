import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsear, detectarSep, motivoInvalida } from './import-parse';

// El parseo del pegado — la parte riesgosa del import. Se afirma que TSV, comas y una
// lista SIN separador (copiar de un chat) se parsean como el operador espera. La grilla
// muestra el resultado, así que ninguno de estos casos se importa mal EN SILENCIO.

test('TSV (pegar de una hoja): corta por tab en columnas', () => {
  const filas = parsear('Café Huila 500 g\t28000\tcafe_grano', 'tab');
  assert.equal(filas.length, 1);
  assert.deepEqual(filas[0], { nombre: 'Café Huila 500 g', precio: '28000', categoria: 'cafe_grano', sku: '', stock: '' });
});

test('detectarSep: tab / coma / punto y coma / sin separador', () => {
  assert.equal(detectarSep('a\tb\tc'), 'tab');
  assert.equal(detectarSep('a,b,c'), 'coma');
  assert.equal(detectarSep('a;b;c'), 'puntoycoma');
  assert.equal(detectarSep('Café Huila 500 g'), 'tab'); // sin separador → tab (fila de sólo-nombre)
});

test('comas: se cortan cuando el separador es coma', () => {
  const filas = parsear('Chocolate,15000,caja_regalo', 'coma');
  assert.deepEqual(filas[0], { nombre: 'Chocolate', precio: '15000', categoria: 'caja_regalo', sku: '', stock: '' });
});

test('lista de un chat (una línea = un nombre): cada línea es una fila de sólo-nombre', () => {
  const filas = parsear('Café Huila 500 g\nCombo Desayuno\nChocolate artesanal', 'tab');
  assert.equal(filas.length, 3);
  assert.deepEqual(filas.map(f => f.nombre), ['Café Huila 500 g', 'Combo Desayuno', 'Chocolate artesanal']);
  assert.ok(filas.every(f => f.precio === '' && f.categoria === ''));
});

test('encabezado: se salta una 1ª fila "Nombre/Producto/Name"', () => {
  const filas = parsear('Nombre\tPrecio\tCategoría\nCafé\t100\tcafe_grano', 'tab');
  assert.equal(filas.length, 1);
  assert.equal(filas[0].nombre, 'Café');
});

test('líneas en blanco se ignoran; los valores se recortan', () => {
  const filas = parsear('  Café  \t 100 \n\n  \n Combo \t 200 ', 'tab');
  assert.equal(filas.length, 2);
  assert.equal(filas[0].nombre, 'Café');
  assert.equal(filas[0].precio, '100');
});

test('motivoInvalida: nombre y categoría son obligatorios; precio vacío es válido', () => {
  assert.equal(motivoInvalida({ nombre: '', precio: '1', categoria: 'x', sku: '', stock: '' }), 'Falta el nombre');
  assert.equal(motivoInvalida({ nombre: 'X', precio: '1', categoria: '', sku: '', stock: '' }), 'Falta la categoría');
  assert.equal(motivoInvalida({ nombre: 'X', precio: '', categoria: 'x', sku: '', stock: '' }), null);
});
