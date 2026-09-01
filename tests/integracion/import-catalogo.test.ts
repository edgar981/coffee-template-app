import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { procesarFilasImport } from '@duna/core/product-import';
import { slugDeNombre } from '@duna/core/product-update';
import { prisma, limpiar } from './fixtures';

// El import de catálogo, afirmado contra una base real (el carril no monta HTTP). Se
// prueba lo que un test con mocks NO vería: el ÉXITO PARCIAL (una fila mala no aborta
// las demás), el DEDUP por slug (reimportar omite, no duplica ni revienta), y que el
// slug es EL MISMO que el alta manual (`slugDeNombre`) — no una segunda implementación.
// No borrar este archivo.

beforeEach(limpiar);
after(async () => { await prisma.$disconnect(); });

test('ÉXITO PARCIAL: la fila inválida no aborta a las demás, y vuelve marcada', async () => {
  const filas = [
    { nombre: 'Producto A', categoria: 'general', precio: 1000 },
    { nombre: '',           categoria: 'general', precio: 2000 }, // inválida: sin nombre
    { nombre: 'Producto C', categoria: 'general', precio: 3000 },
  ];
  const { resultados, resumen } = await procesarFilasImport(filas);

  assert.equal(resumen.creadas, 2);
  assert.equal(resumen.errores, 1);
  // La forma que la grilla pinta: la fila 1 (0-based, el mismo orden enviado) es la mala.
  assert.equal(resultados[1].fila, 1);
  assert.equal(resultados[1].estado, 'error');
  assert.equal(resultados[1].motivo, 'Falta el nombre');
  assert.equal(resultados[0].estado, 'creada');
  assert.equal(resultados[2].estado, 'creada');
  // Las válidas quedaron en la base.
  assert.ok(await prisma.product.findUnique({ where: { slug: 'producto-a' } }));
  assert.ok(await prisma.product.findUnique({ where: { slug: 'producto-c' } }));
});

test('sin categoría también es error de fila (categoria es obligatoria en el modelo)', async () => {
  const { resultados, resumen } = await procesarFilasImport([
    { nombre: 'Sin Cat', categoria: '', precio: 10 },
  ]);
  assert.equal(resumen.errores, 1);
  assert.equal(resultados[0].estado, 'error');
  assert.equal(resultados[0].motivo, 'Falta la categoría');
  assert.equal(await prisma.product.count(), 0);
});

test('DEDUP por slug: reimportar OMITE, no duplica ni revienta', async () => {
  const filas = [{ nombre: 'Cafe Especial', categoria: 'general', precio: 5000 }];

  const primero = await procesarFilasImport(filas);
  assert.equal(primero.resumen.creadas, 1);

  const segundo = await procesarFilasImport(filas);
  assert.equal(segundo.resumen.creadas, 0);
  assert.equal(segundo.resumen.omitidas, 1);
  assert.equal(segundo.resultados[0].estado, 'omitida');
  assert.equal(segundo.resultados[0].motivo, 'Ya existe un producto con ese nombre');

  assert.equal(await prisma.product.count({ where: { nombre: 'Cafe Especial' } }), 1);
});

test('DEDUP intra-lote: dos filas del mismo nombre → la 2ª se omite (bucle secuencial)', async () => {
  const { resumen } = await procesarFilasImport([
    { nombre: 'Repetido', categoria: 'general', precio: 1 },
    { nombre: 'Repetido', categoria: 'general', precio: 2 },
  ]);
  assert.equal(resumen.creadas, 1);
  assert.equal(resumen.omitidas, 1);
  assert.equal(await prisma.product.count({ where: { nombre: 'Repetido' } }), 1);
});

test('el slug es EL MISMO que el alta manual, y cada producto nace con su asiento inaugural', async () => {
  const { resultados } = await procesarFilasImport([{ nombre: 'Producto XY', categoria: 'general', precio: 100 }]);
  const id = resultados[0].productoId;
  assert.ok(id);

  const p = await prisma.product.findUniqueOrThrow({ where: { id } });
  assert.equal(p.slug, slugDeNombre('Producto XY')); // 'producto-xy' — no una segunda derivación
  assert.equal(p.imagen, '');                          // sin foto → placeholder en el render (commit 1)

  const asiento = await prisma.inventoryLog.findFirst({ where: { producto_id: id } });
  assert.ok(asiento, 'el producto importado debe tener su asiento inaugural del kardex');
});
