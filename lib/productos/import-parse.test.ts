import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsear, sepDeArchivo, motivoInvalida } from './import-parse';

// El parseo del import — la parte riesgosa. Se afirma que TSV, comas, una lista SIN
// separador (copiar de un chat) y —lo que ya rompía en silencio— un campo ENTRECOMILLADO
// con comas adentro se parsean como el operador espera. La grilla muestra el resultado,
// así que ninguno de estos casos se importa mal EN SILENCIO. No borrar este archivo.

test('TSV (pegar de una hoja): corta por tab en columnas', () => {
  const filas = parsear('Café Huila 500 g\t28000\tcafe_grano', 'tab');
  assert.equal(filas.length, 1);
  assert.deepEqual(filas[0], { nombre: 'Café Huila 500 g', precio: '28000', categoria: 'cafe_grano', sku: '', stock: '' });
});

test('comas: se cortan cuando el separador es coma', () => {
  const filas = parsear('Chocolate,15000,caja_regalo', 'coma');
  assert.deepEqual(filas[0], { nombre: 'Chocolate', precio: '15000', categoria: 'caja_regalo', sku: '', stock: '' });
});

test('QUOTE-AWARE: un campo entrecomillado con coma adentro es UN campo (el bug que arregla)', () => {
  const filas = parsear('"Café, tueste medio",28000,cafe_grano', 'coma');
  assert.equal(filas.length, 1);
  assert.equal(filas[0].nombre, 'Café, tueste medio'); // NO se parte en "Café" | " tueste medio"
  assert.equal(filas[0].precio, '28000');
  assert.equal(filas[0].categoria, 'cafe_grano');
});

test('QUOTE-AWARE: comilla escapada ("") queda como una comilla literal', () => {
  const filas = parsear('"Café ""especial""",100', 'coma');
  assert.equal(filas[0].nombre, 'Café "especial"');
  assert.equal(filas[0].precio, '100');
});

test('QUOTE-AWARE: una comilla que NO abre campo es literal (Café 12" sobrevive)', () => {
  const filas = parsear('Café 12",100', 'coma');
  assert.equal(filas[0].nombre, 'Café 12"');
  assert.equal(filas[0].precio, '100');
});

test('QUOTE-AWARE: un salto de línea DENTRO de comillas no parte la fila', () => {
  const filas = parsear('"Café\nHuila",100\nOtro,200', 'coma');
  assert.equal(filas.length, 2);
  assert.equal(filas[0].nombre, 'Café\nHuila');
  assert.equal(filas[1].nombre, 'Otro');
});

test('lista de un chat (una línea = un nombre): cada línea es una fila de sólo-nombre', () => {
  const filas = parsear('Café Huila 500 g\nCombo Desayuno\nChocolate artesanal', 'tab');
  assert.equal(filas.length, 3);
  assert.deepEqual(filas.map(f => f.nombre), ['Café Huila 500 g', 'Combo Desayuno', 'Chocolate artesanal']);
  assert.ok(filas.every(f => f.precio === '' && f.categoria === ''));
});

test('sepDeArchivo: .csv → coma, .tsv → tab, otro → tab (lee la extensión, no el contenido)', () => {
  assert.equal(sepDeArchivo('catalogo.csv'), 'coma');
  assert.equal(sepDeArchivo('Catalogo.CSV'), 'coma');
  assert.equal(sepDeArchivo('export.tsv'), 'tab');
  assert.equal(sepDeArchivo('lista.txt'), 'tab');
});

test('encabezado: se salta una 1ª fila "Nombre/Producto/Name" (match exacto)', () => {
  const filas = parsear('Nombre\tPrecio\tCategoría\nCafé\t100\tcafe_grano', 'tab');
  assert.equal(filas.length, 1);
  assert.equal(filas[0].nombre, 'Café');
});

test('encabezado: un match NO exacto ("Nombre del producto") NO se salta — cae como fila', () => {
  const filas = parsear('Nombre del producto\tPrecio\nCafé\t100', 'tab');
  assert.equal(filas.length, 2); // no se traga un producto real por adivinar de más
  assert.equal(filas[0].nombre, 'Nombre del producto');
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
