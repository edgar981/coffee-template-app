import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { logsDeInventario, aplicarAjusteInventario } from '@duna/core/inventory';
import { dispatchStockDecrement, restockShippingStock } from '@duna/core/fulfillment';
import { crearProducto, crearOrden, crearEnvio, prisma, limpiar } from './fixtures';

// EL MOVIMIENTO DE ORDEN ENLAZA A SU ORDEN — POR EL DATO, no parseando el motivo.
//
// Los movimientos que nacen de una orden (despacho → 'venta', reintegro por
// fallido/cancelación → 'devolucion') los genera el sistema DESDE una orden, con
// el id en la mano. `orden_id` lo captura en la escritura; la lectura lo resuelve
// a `numero_orden` (lo que `?pedido=` de Pedidos matchea) para el enlace.
//
// Va en el carril porque lo que se afirma es qué quedó ESCRITO y qué RESUELVE la
// consulta contra la tabla Order — un mock no vería ni la captura ni la resolución.
// La condición crítica (owner): las DOS puertas order-driven capturan, o unos
// movimientos navegan y otros no sin razón visible. Se afirman las dos, y que el
// ajuste MANUAL no captura (null honesto).

before(() => limpiar());
beforeEach(() => limpiar());
after(async () => { await limpiar(); await prisma.$disconnect(); });

async function ordenConItem(numero: string, productoId: string, cantidad: number) {
  const orden = await crearOrden({ numero });
  await prisma.orderItem.create({
    data: { orden_id: orden.id, producto_id: productoId, producto_nombre: 'X', cantidad, subtotal: 1000 },
  });
  return orden;
}

test('DESPACHO captura orden_id, y la lectura lo resuelve a numero_orden', async () => {
  const p = await crearProducto({ slug: 'a', stock: 10, stock_minimo: 5 });
  const orden = await ordenConItem('CN-111111', p.id, 3);
  const envio = await crearEnvio({ ordenId: orden.id, estado: 'en_ruta' });

  await prisma.$transaction(tx =>
    dispatchStockDecrement(tx, { id: envio.id, orden_id: orden.id, stock_descontado_at: null }));

  const [mov] = await logsDeInventario({ productoId: p.id });
  assert.equal(mov.tipo, 'venta');
  assert.equal(mov.orden_id, orden.id);
  assert.equal(mov.orden_numero, 'CN-111111');   // resuelto en la lectura, para el enlace
});

test('REINTEGRO (fallido/cancelación) también captura orden_id', async () => {
  const p = await crearProducto({ slug: 'b', stock: 10, stock_minimo: 5 });
  const orden = await ordenConItem('CN-222222', p.id, 4);
  const envio = await crearEnvio({ ordenId: orden.id, estado: 'fallido' });
  // El reintegro exige el marcador de que ya se descontó.
  await prisma.shipping.update({ where: { id: envio.id }, data: { stock_descontado_at: new Date() } });

  await prisma.$transaction(tx =>
    restockShippingStock(tx, { id: envio.id, orden_id: orden.id, stock_descontado_at: new Date() }, 'Entrega fallida'));

  const mov = (await logsDeInventario({ productoId: p.id })).find(m => m.tipo === 'devolucion');
  assert.ok(mov, 'no se escribió el asiento de devolución');
  assert.equal(mov.orden_id, orden.id);
  assert.equal(mov.orden_numero, 'CN-222222');
});

test('un ajuste MANUAL no viene de una orden — orden_id y orden_numero null', async () => {
  const p = await crearProducto({ slug: 'c', stock: 10, stock_minimo: 5 });
  await aplicarAjusteInventario({ producto_id: p.id, tipo: 'entrada', cantidad: 5 });

  const [mov] = await logsDeInventario({ productoId: p.id });
  assert.equal(mov.orden_id ?? null, null);
  assert.equal(mov.orden_numero, null);
});

test('orden BORRADA → orden_numero null (texto plano), aunque el orden_id quede', async () => {
  // La resolución es un lookup, no una FK: un orden_id colgado no rompe, sólo no
  // resuelve — y una orden borrada no debe dejar un enlace muerto.
  await prisma.inventoryLog.create({
    data: {
      producto_id: 'p', producto_nombre: 'X', tipo: 'venta',
      cantidad: 1, stock_anterior: 1, stock_nuevo: 0, orden_id: 'orden-fantasma',
    },
  });
  const [mov] = await logsDeInventario({});
  assert.equal(mov.orden_id, 'orden-fantasma');
  assert.equal(mov.orden_numero, null);
});
