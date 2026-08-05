import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agregarMargenPorSku, type CostoProducto, type LineaVendida } from './margen';

// Lo que estas pruebas defienden no es la aritmética (restar es fácil) sino las
// tres decisiones que hacen honesta la tabla de rentabilidad: el orden por margen
// y no por volumen, que una línea sin costo resoluble NUNCA se cuele como margen
// 100%, y que un nombre ambiguo se comporte como un costo faltante.

const CATALOGO: CostoProducto[] = [
  { id: 'p1', nombre: 'Nayoli Origen 500g', costo: 10_000 },
  { id: 'p2', nombre: 'Nayoli Tolima 250g', costo: 4_000 },
];

const linea = (o: Partial<LineaVendida>): LineaVendida => ({
  productoId: 'p1', productoNombre: 'Nayoli Origen 500g', unidades: 1, ingresos: 20_000, ...o,
});

test('margen = ingresos − costo actual × unidades', () => {
  const r = agregarMargenPorSku([linea({ unidades: 3, ingresos: 60_000 })], CATALOGO);
  assert.equal(r.filas.length, 1);
  assert.equal(r.filas[0].costoTotal, 30_000);
  assert.equal(r.filas[0].margenTotal, 30_000);
  assert.equal(r.filas[0].margenUnitario, 10_000);
  assert.equal(r.filas[0].margenPct, 50);
});

test('ORDENA por margen total, no por unidades ni por ingresos', () => {
  // EL punto del rediseño: el producto que más se vende no es el que más deja.
  // p2 vende 20 unidades y factura más, pero p1 deja más plata.
  const r = agregarMargenPorSku([
    linea({ productoId: 'p2', productoNombre: 'Nayoli Tolima 250g', unidades: 20, ingresos: 100_000 }), // margen 20.000
    linea({ unidades: 5, ingresos: 100_000 }),                                                          // margen 50.000
  ], CATALOGO);
  assert.deepEqual(r.filas.map(f => f.productoId), ['p1', 'p2']);
});

test('dos líneas del mismo producto suman en UNA fila, resuelvan por FK o por nombre', () => {
  const r = agregarMargenPorSku([
    linea({ unidades: 2, ingresos: 40_000 }),
    linea({ productoId: null, unidades: 3, ingresos: 60_000 }), // resuelve por nombre
  ], CATALOGO);
  assert.equal(r.filas.length, 1);
  assert.equal(r.filas[0].unidades, 5);
  assert.equal(r.filas[0].ingresos, 100_000);
});

test('línea sin FK y sin nombre en catálogo va al RESIDUAL, no a una fila con costo 0', () => {
  // La regresión más cara posible: costear en 0 lo que no se pudo costear
  // convierte un dato faltante en "margen 100%" — la mejor noticia del mes,
  // inventada.
  const r = agregarMargenPorSku([
    linea({ productoId: null, productoNombre: 'Producto retirado del catálogo', unidades: 4, ingresos: 80_000 }),
  ], CATALOGO);
  assert.equal(r.filas.length, 0);
  assert.deepEqual(r.residual, { productos: 1, unidades: 4, ingresos: 80_000 });
  assert.equal(r.margenTotal, 0);
  assert.equal(r.margenPct, null);
});

test('el residual NO entra en los totales de la cabecera', () => {
  const r = agregarMargenPorSku([
    linea({ unidades: 1, ingresos: 20_000 }),
    linea({ productoId: null, productoNombre: 'Fantasma', unidades: 9, ingresos: 900_000 }),
  ], CATALOGO);
  assert.equal(r.ingresos, 20_000);     // no 920.000
  assert.equal(r.margenTotal, 10_000);
  assert.equal(r.residual.ingresos, 900_000);
});

test('un nombre AMBIGUO se trata como costo faltante, no se elige uno de los dos', () => {
  // `Product.nombre` no es único (solo slug y sku lo son). Adivinar cuál de los
  // dos costos aplica es una moneda al aire; el residual es la respuesta honesta.
  const ambiguo: CostoProducto[] = [
    { id: 'a', nombre: 'Mezcla', costo: 1_000 },
    { id: 'b', nombre: 'Mezcla', costo: 9_000 },
  ];
  const r = agregarMargenPorSku(
    [linea({ productoId: null, productoNombre: 'Mezcla', unidades: 2, ingresos: 30_000 })],
    ambiguo,
  );
  assert.equal(r.filas.length, 0);
  assert.equal(r.residual.ingresos, 30_000);
});

test('un nombre ambiguo SIGUE ambiguo con un tercer homónimo', () => {
  const tres: CostoProducto[] = [
    { id: 'a', nombre: 'Mezcla', costo: 1_000 },
    { id: 'b', nombre: 'Mezcla', costo: 9_000 },
    { id: 'c', nombre: 'Mezcla', costo: 5_000 },
  ];
  const r = agregarMargenPorSku(
    [linea({ productoId: null, productoNombre: 'Mezcla', unidades: 1, ingresos: 10_000 })],
    tres,
  );
  assert.equal(r.filas.length, 0);
});

test('la FK gana sobre el nombre — un producto renombrado se costea igual', () => {
  const renombrado: CostoProducto[] = [{ id: 'p1', nombre: 'Nayoli Origen 500g (nuevo)', costo: 10_000 }];
  const r = agregarMargenPorSku([linea({ unidades: 1, ingresos: 20_000 })], renombrado);
  assert.equal(r.filas.length, 1);
  assert.equal(r.filas[0].producto, 'Nayoli Origen 500g (nuevo)');
});

test('margen NEGATIVO se reporta como tal, no se recorta a cero', () => {
  // Vender por debajo del costo es exactamente lo que esta página existe para
  // mostrar. Un `Math.max(0, …)` acá borraría el único hallazgo que importa.
  const r = agregarMargenPorSku([linea({ unidades: 1, ingresos: 8_000 })], CATALOGO);
  assert.equal(r.filas[0].margenTotal, -2_000);
  assert.equal(r.margenTotal, -2_000);
});

test('sin líneas: todo en cero y los porcentajes en null, no en 0%', () => {
  const r = agregarMargenPorSku([], CATALOGO);
  assert.deepEqual(r.filas, []);
  assert.equal(r.margenPct, null);
  assert.deepEqual(r.residual, { productos: 0, unidades: 0, ingresos: 0 });
});

test('ingresos en 0 dan margenPct null, no una división por cero', () => {
  const r = agregarMargenPorSku([linea({ unidades: 1, ingresos: 0 })], CATALOGO);
  assert.equal(r.filas[0].margenPct, null);
  assert.equal(r.filas[0].margenTotal, -10_000);
});
