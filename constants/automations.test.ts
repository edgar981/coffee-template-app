import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hrefOrden, hrefOrdenOLista } from './automations';

// La guarda del retiro de Entregas: las automatizaciones `envio_estancado` y
// `entrega_fallida` reapuntaron a la ORDEN, pero su `numero_orden` puede faltar (su
// mensaje lleva `?? '—'`). Sin la guarda, `hrefOrden(undefined)` daría un href roto
// (`?pedido=undefined`) congelado para siempre en `Notification.href`.

test('hrefOrdenOLista con número: al detalle del pedido, igual que hrefOrden', () => {
  assert.equal(hrefOrdenOLista('CN-132453'), hrefOrden('CN-132453'));
  assert.equal(hrefOrdenOLista('CN-132453'), '/admin/pedidos?pedido=CN-132453');
});

test('hrefOrdenOLista SIN número: al listado pelado, NUNCA un href roto', () => {
  assert.equal(hrefOrdenOLista(null), '/admin/pedidos');
  assert.equal(hrefOrdenOLista(undefined), '/admin/pedidos');
  assert.equal(hrefOrdenOLista(''), '/admin/pedidos');
  // Lo que NO puede pasar: que se cuele el número faltante en la URL.
  assert.ok(!hrefOrdenOLista(undefined).includes('undefined'));
  assert.ok(!hrefOrdenOLista(null).includes('null'));
});
