import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarTransicionEnvio } from '@duna/core/shipping-transition';
import { prisma, limpiar, crearProducto, crearOrden, crearEnvio } from './fixtures';

// CONCURRENCIA del DESPACHO — el `FOR UPDATE` que faltaba en la puerta que descuenta
// stock al marcar "En ruta". Hermano de `ajuste-concurrente`: el estado se leía FUERA
// de la transacción, sin lock, así que dos PATCH concurrentes del MISMO shipping pasaban
// ambos el gate `justDispatched` (los dos veían `preparando` + `stock_descontado_at`
// null) y descontaban stock DOS veces + escribían DOS asientos 'venta'. Corrupción
// silenciosa en el libro que la auditoría de Inventario existe para creer.
//
// EL INVARIANTE: dos despachos concurrentes del mismo shipping producen EXACTAMENTE un
// descuento y un asiento. Se afirma sobre `aplicarTransicionEnvio` —el núcleo REAL que
// el route llama—, no sobre una réplica.
//
// SE ESCRIBIÓ CONTRA EL CÓDIGO SIN EL LOCK y se lo vio producir DOS (stock 4 en vez de 7,
// dos 'venta'). Si algún día vuelve a fallar, el lock de la orden se fue. NO BORRAR.

before(() => limpiar());
beforeEach(() => limpiar());
after(async () => { await limpiar(); await prisma.$disconnect(); });

/** Un despacho LISTO: orden pagada (para no arrastrar el markContraentrega), su línea
 *  con producto, y un envío en `preparando` con el marcador de stock en null. */
async function armarDespacho(slug: string, stock: number, cantidad: number) {
  const prod  = await crearProducto({ slug, stock, stock_minimo: 1 });
  const orden = await crearOrden({ numero: `CN-${slug}`, estado: 'pagado' });
  await prisma.orderItem.create({
    data: {
      orden_id: orden.id, producto_id: prod.id, producto_nombre: prod.nombre,
      cantidad, subtotal: 20000 * cantidad,
    },
  });
  const envio = await crearEnvio({
    ordenId: orden.id, estado: 'preparando', mensajero: 'Luis', fecha_entrega: '2026-08-25',
  });
  return { prod, orden, envio };
}

const despachar = (shippingId: string, ordenId: string) =>
  aplicarTransicionEnvio({
    shippingId, ordenId, estadoDeseado: 'en_ruta', isScheduling: false,
    campos: {}, actor: { id: 'op-1', nombre: 'Operador' },
  });

test('dos "Marcar en ruta" concurrentes: EXACTAMENTE un descuento y un asiento', async () => {
  const { prod, orden, envio } = await armarDespacho('desp-conc', 10, 3);

  // El doble-submit que la ventana visual del detalle habilita — dos PATCH del mismo
  // shipping, en paralelo deliberado (dentro del test, porque el carril corre con
  // --test-concurrency=1: todos comparten la base).
  await Promise.all([despachar(envio.id, orden.id), despachar(envio.id, orden.id)]);

  // UN descuento: 10 − 3 = 7. Sin el lock serían 10 − 6 = 4.
  const post = await prisma.product.findUniqueOrThrow({ where: { id: prod.id } });
  assert.equal(post.stock, 7, 'un solo descuento — sin el lock de la orden serían 4');

  // UN asiento 'venta'. Sin el lock, dos — el kardex afirmaría dos ventas donde hubo una.
  const ventas = await prisma.inventoryLog.count({ where: { producto_id: prod.id, tipo: 'venta' } });
  assert.equal(ventas, 1, 'un solo asiento de venta — sin el lock serían dos');

  // UN asiento de transición fulfillment → en_ruta (el otro es un no-op: en_ruta→en_ruta).
  const transiciones = await prisma.orderStatusTransition.count({
    where: { orden_id: orden.id, eje: 'fulfillment', estado_nuevo: 'en_ruta' },
  });
  assert.equal(transiciones, 1, 'una sola transición en_ruta');

  // El envío quedó despachado, con el marcador de stock puesto una vez.
  const sh = await prisma.shipping.findUniqueOrThrow({ where: { id: envio.id } });
  assert.equal(sh.estado, 'en_ruta');
  assert.ok(sh.stock_descontado_at, 'el marcador de despacho quedó puesto');
});

test('el segundo despacho, ya despachado, es un no-op — ni toca stock ni asienta', async () => {
  // La otra mitad del mismo invariante, secuencial: una vez en_ruta, un PATCH repetido
  // (el que la ventana visual invita a hacer) no vuelve a descontar ni a asentar.
  const { prod, orden, envio } = await armarDespacho('desp-repetido', 10, 4);

  await despachar(envio.id, orden.id);           // primero: descuenta
  await despachar(envio.id, orden.id);           // segundo: no-op (ya en_ruta)

  const post = await prisma.product.findUniqueOrThrow({ where: { id: prod.id } });
  assert.equal(post.stock, 6, 'un solo descuento pese al PATCH repetido');
  const ventas = await prisma.inventoryLog.count({ where: { producto_id: prod.id, tipo: 'venta' } });
  assert.equal(ventas, 1);
});
