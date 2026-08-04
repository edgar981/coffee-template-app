import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarAjusteInventario } from '@/lib/inventory';
import { prisma, limpiar, crearProducto } from './fixtures';

// CONCURRENCIA del ajuste de inventario — item 1 del backlog.
//
// Es el primer test del repo que necesita paralelismo DELIBERADO, y va dentro
// del test (`Promise.all`) y no entre archivos: el carril corre con
// `--test-concurrency=1` justamente porque todos comparten una base.
//
// EL INVARIANTE QUE SE AFIRMA: el kardex tiene que ENCADENAR. Ordenados por el
// momento en que ocurrieron, el `stock_nuevo` de un asiento es el
// `stock_anterior` del siguiente. Un kardex que no encadena no es un log
// impreciso: es un libro que afirma dos veces el mismo movimiento, y con tipos
// delta además esconde que se aplicaron los dos.
//
// Este archivo se escribió ANTES del fix y se lo vio fallar contra el código
// con la lectura fuera de la transacción. Si algún día vuelve a fallar, el
// defecto volvió.

before(() => limpiar());
beforeEach(() => limpiar());
after(async () => { await limpiar(); await prisma.$disconnect(); });

/** Los asientos del producto, en el orden real en que ocurrieron. */
async function kardexDe(productoId: string) {
  return prisma.inventoryLog.findMany({
    where:   { producto_id: productoId },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * El invariante: partiendo del stock inicial, los asientos deben poder RECORRERSE
 * en cadena — cada uno arranca donde terminó el anterior — hasta consumirlos
 * todos.
 *
 * Es un recorrido y no un `sort`: ordenar por `stock_nuevo` asume que el stock
 * sube, y una salida lo baja. `createdAt` tampoco sirve de desempate, porque dos
 * asientos concurrentes pueden compartir el milisegundo. Lo que se afirma es que
 * EXISTA un orden en el que la cadena cierre, no cuál sea.
 */
function cadenaContinua(
  asientos: { stock_anterior: number; stock_nuevo: number }[],
  stockInicial: number,
): boolean {
  const pendientes = [...asientos];
  let esperado = stockInicial;
  while (pendientes.length > 0) {
    const i = pendientes.findIndex(a => a.stock_anterior === esperado);
    if (i === -1) return false;          // nadie continúa desde acá: la cadena se rompió
    esperado = pendientes[i].stock_nuevo;
    pendientes.splice(i, 1);
  }
  return true;
}

test('dos ENTRADAS concurrentes: el kardex encadena y no repite el mismo origen', async () => {
  const prod = await crearProducto({ slug: 'p-conc-entrada', stock: 10, stock_minimo: 3 });

  await Promise.all([
    aplicarAjusteInventario({ producto_id: prod.id, tipo: 'entrada', cantidad: 5 }),
    aplicarAjusteInventario({ producto_id: prod.id, tipo: 'entrada', cantidad: 5 }),
  ]);

  const post = await prisma.product.findUniqueOrThrow({ where: { id: prod.id } });
  assert.equal(post.stock, 20, 'los dos incrementos se aplican — eso ya funcionaba');

  const asientos = await kardexDe(prod.id);
  assert.equal(asientos.length, 2);

  const origenes = asientos.map(a => a.stock_anterior).sort((a, b) => a - b);
  assert.deepEqual(origenes, [10, 15],
    'el segundo asiento partió de 15, no de 10: si los dos dicen 10, la lectura salió de fuera de la transacción');

  assert.ok(cadenaContinua(asientos, 10),
    `el kardex no encadena: ${asientos.map(a => `${a.stock_anterior}→${a.stock_nuevo}`).join(', ')}`);
});

test('dos AJUSTES concurrentes al mismo valor: no puede haber dos asientos idénticos', async () => {
  // El caso REAL del 2026-08-04: dos filas `7→28` a 749 ms, el mismo movimiento
  // contado dos veces. `ajuste` fija valor absoluto, así que el stock final es
  // correcto — lo que miente es el libro.
  const prod = await crearProducto({ slug: 'p-conc-ajuste', stock: 7, stock_minimo: 3 });

  await Promise.all([
    aplicarAjusteInventario({ producto_id: prod.id, tipo: 'ajuste', cantidad: 28 }),
    aplicarAjusteInventario({ producto_id: prod.id, tipo: 'ajuste', cantidad: 28 }),
  ]);

  const post = await prisma.product.findUniqueOrThrow({ where: { id: prod.id } });
  assert.equal(post.stock, 28, 'valor absoluto: aplicarlo dos veces es idempotente');

  const asientos = await kardexDe(prod.id);
  const firmas = asientos.map(a => `${a.stock_anterior}→${a.stock_nuevo}`);
  assert.notDeepEqual(firmas[0], firmas[1],
    `dos asientos idénticos afirman el mismo movimiento dos veces: ${firmas.join(', ')}`);

  assert.ok(cadenaContinua(asientos, 7),
    `el kardex no encadena: ${firmas.join(', ')}`);
});

test('dos SALIDAS concurrentes: encadenan y ninguna sobrevende', async () => {
  const prod = await crearProducto({ slug: 'p-conc-salida', stock: 10, stock_minimo: 2 });

  await Promise.all([
    aplicarAjusteInventario({ producto_id: prod.id, tipo: 'salida', cantidad: 3 }),
    aplicarAjusteInventario({ producto_id: prod.id, tipo: 'salida', cantidad: 3 }),
  ]);

  const post = await prisma.product.findUniqueOrThrow({ where: { id: prod.id } });
  assert.equal(post.stock, 4);
  assert.ok(cadenaContinua(await kardexDe(prod.id), 10));
});

test('salida concurrente que excede: la segunda se rechaza, no sobrevende', async () => {
  const prod = await crearProducto({ slug: 'p-conc-sobreventa', stock: 5, stock_minimo: 1 });

  const res = await Promise.allSettled([
    aplicarAjusteInventario({ producto_id: prod.id, tipo: 'salida', cantidad: 4 }),
    aplicarAjusteInventario({ producto_id: prod.id, tipo: 'salida', cantidad: 4 }),
  ]);

  const ok = res.filter(r => r.status === 'fulfilled').length;
  assert.equal(ok, 1, 'solo una puede salir: 4+4 no cabe en 5');

  const post = await prisma.product.findUniqueOrThrow({ where: { id: prod.id } });
  assert.equal(post.stock, 1, 'el stock nunca queda negativo');
  assert.equal((await kardexDe(prod.id)).length, 1, 'la rechazada no deja asiento');
});

test('el CRUCE del mínimo lo reclama un solo movimiento, no los dos', async () => {
  // Con la lectura fuera de la transacción, dos salidas concurrentes pueden
  // creerse ambas "la que cruzó" —las dos vieron el stock alto de antes— y la
  // campana avisaría dos veces del mismo cruce.
  const prod = await crearProducto({ slug: 'p-conc-cruce', stock: 10, stock_minimo: 6 });

  const res = await Promise.all([
    aplicarAjusteInventario({ producto_id: prod.id, tipo: 'salida', cantidad: 2 }),
    aplicarAjusteInventario({ producto_id: prod.id, tipo: 'salida', cantidad: 2 }),
  ]);

  // 10 → 8 (sigue por encima de 6) → 6 (cruza). Exactamente uno cruza.
  assert.equal(res.filter(r => r.cruzoElMinimo).length, 1,
    'el cruce es un hecho único; dos movimientos no pueden reclamarlo los dos');
});
