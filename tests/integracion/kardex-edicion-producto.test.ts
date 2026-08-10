import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  aplicarPatchProducto, crearProductoConAsiento,
  MOTIVO_EDICION_PRODUCTO, MOTIVO_STOCK_INICIAL,
} from '@duna/core/product-update';
import { prisma, limpiar } from './fixtures';

// LA PUERTA DEL MODAL DEJA DE SER SILENCIOSA.
//
// El stock se edita por dos puertas —`/api/inventory/adjust` y el campo Stock del
// modal de producto— y las dos se mantienen (decisión del owner, 2026-08-05). Lo
// que cambia es que la segunda ya no escribe sin dejar firma: el PATCH ponía el
// stock directo y el kardex se desfasaba sin una fila que lo explicara.
//
// Se descubrió reconstruyendo el incidente del PATCH destructivo: el stock fue
// 28 → 0 → 28 y el kardex no registró NADA. La cadena cerró de pura casualidad,
// porque el owner retecleó el mismo número; con 30 habría quedado desfasada para
// siempre y sin nada que lo explicara.
//
// Va en el carril y no en la suite pura por el motivo de siempre: lo que se
// afirma no es la forma de un objeto, es qué filas quedan DESPUÉS de escribir —
// y, en el test de concurrencia, qué pasa cuando dos transacciones se cruzan.
// Eso no se puede simular con mocks.

before(() => limpiar());
beforeEach(() => limpiar());
after(async () => { await limpiar(); await prisma.$disconnect(); });

async function crearProducto(stock: number) {
  return crearProductoConAsiento({
    nombre:       'Café de prueba',
    slug:         `cafe-prueba-${stock}`,
    descripcion:  'Una descripción cualquiera.',
    categoria:    'cafe_grano',
    precio:       20000,
    stock,
    stock_minimo: 5,
  });
}

const kardexDe = (id: string) =>
  prisma.inventoryLog.findMany({ where: { producto_id: id }, orderBy: { createdAt: 'asc' } });

/** Los asientos, ordenados, ¿se recorren en cadena desde 0? */
function cadenaContinua(asientos: { stock_anterior: number; stock_nuevo: number }[]): boolean {
  const pendientes = [...asientos];
  let esperado = 0;
  while (pendientes.length > 0) {
    const i = pendientes.findIndex(a => a.stock_anterior === esperado);
    if (i === -1) return false;
    esperado = pendientes[i].stock_nuevo;
    pendientes.splice(i, 1);
  }
  return true;
}

// ─── El asiento inaugural: toda cadena empieza en su primera fila ────────────

test('crear un producto deja su asiento inaugural, desde CERO', async () => {
  const p = await crearProducto(42);
  const asientos = await kardexDe(p.id);

  assert.equal(asientos.length, 1);
  assert.equal(asientos[0].motivo, MOTIVO_STOCK_INICIAL);
  assert.equal(asientos[0].stock_anterior, 0);
  assert.equal(asientos[0].stock_nuevo, 42);
});

test('el inaugural va INCLUSO con stock 0 — si no, la cadena empieza en el aire', async () => {
  const p = await crearProducto(0);
  const asientos = await kardexDe(p.id);

  assert.equal(asientos.length, 1);
  assert.equal(asientos[0].stock_anterior, 0);
  assert.equal(asientos[0].stock_nuevo, 0);
});

// ─── Las tres condiciones del asiento de edición ─────────────────────────────

test('stock DISTINTO: se escribe el asiento, y encadena', async () => {
  const p = await crearProducto(28);

  await aplicarPatchProducto(p.id, { stock: 40 });

  const asientos = await kardexDe(p.id);
  assert.equal(asientos.length, 2);
  const edicion = asientos[1];
  assert.equal(edicion.motivo, MOTIVO_EDICION_PRODUCTO);
  assert.equal(edicion.tipo, 'ajuste');
  assert.equal(edicion.stock_anterior, 28);   // encadena con el inaugural
  assert.equal(edicion.stock_nuevo, 40);
  assert.equal(cadenaContinua(asientos), true);
});

test('SIN la clave stock: cero asientos nuevos', async () => {
  const p = await crearProducto(28);

  await aplicarPatchProducto(p.id, { activo: false, descripcion: 'Otra cosa' });

  const asientos = await kardexDe(p.id);
  assert.equal(asientos.length, 1);           // sólo el inaugural
  const fila = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
  assert.equal(fila.stock, 28);               // y el stock no se movió
});

test('stock IGUAL: cero asientos — editar la descripción no es un movimiento', async () => {
  // Sin esta condición, CADA guardado del modal dejaría un asiento fantasma de
  // N → N y el kardex se volvería ilegible por exceso, que es otra forma de no
  // ser confiable.
  const p = await crearProducto(28);

  await aplicarPatchProducto(p.id, { stock: 28, descripcion: 'Texto nuevo' });

  const asientos = await kardexDe(p.id);
  assert.equal(asientos.length, 1);
  const fila = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
  assert.equal(fila.descripcion, 'Texto nuevo');   // la edición sí se aplicó
});

test('stock que llega como STRING desde el formulario también cuenta', async () => {
  // El modal manda `Number(form.stock)`, pero el endpoint es público a cualquier
  // cliente: `datosDelPatch` normaliza con `Number(...)`, y la comparación tiene
  // que hacerse contra el valor YA normalizado, no contra lo que vino en el body.
  const p = await crearProducto(28);

  await aplicarPatchProducto(p.id, { stock: '28' });
  assert.equal((await kardexDe(p.id)).length, 1, 'un "28" string no es un movimiento');

  await aplicarPatchProducto(p.id, { stock: '35' });
  assert.equal((await kardexDe(p.id)).length, 2, 'un "35" string sí lo es');
});

// ─── Concurrencia: la razón por la que el lock no es opcional ────────────────

test('dos ediciones concurrentes: la cadena NO se rompe', async () => {
  // Sin el `SELECT … FOR UPDATE`, en READ COMMITTED las dos leen el mismo stock
  // antes de que cualquiera escriba, registran el mismo `stock_anterior`, y el
  // kardex afirma dos movimientos donde hubo uno. Es la firma exacta del
  // incidente que originó `ajuste-concurrente.test.ts`.
  const p = await crearProducto(10);

  await Promise.all([
    aplicarPatchProducto(p.id, { stock: 20 }),
    aplicarPatchProducto(p.id, { stock: 30 }),
  ]);

  const asientos = await kardexDe(p.id);
  assert.equal(asientos.length, 3);            // inaugural + las dos ediciones
  assert.equal(cadenaContinua(asientos), true, 'la cadena se rompió: hay asientos que no continúan');

  // Y el último asiento coincide con el stock que quedó de verdad.
  const fila = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
  const finales = asientos.filter(a => a.stock_nuevo === fila.stock);
  assert.ok(finales.length >= 1, 'ningún asiento termina donde terminó el producto');
});

test('la puerta del modal y Ajustar Stock comparten la cola del mismo lock', async () => {
  // Las dos puertas se mantienen; lo que las hace UNA sola cadena es que el lock
  // es de la misma fila. Si divergieran, el kardex volvería a mentir.
  const { aplicarAjusteInventario } = await import('@duna/core/inventory');
  const p = await crearProducto(10);

  await Promise.all([
    aplicarPatchProducto(p.id, { stock: 25 }),
    aplicarAjusteInventario({ producto_id: p.id, tipo: 'entrada', cantidad: 5 }),
  ]);

  const asientos = await kardexDe(p.id);
  assert.equal(asientos.length, 3);
  assert.equal(cadenaContinua(asientos), true, 'las dos puertas produjeron cadenas incompatibles');
});
