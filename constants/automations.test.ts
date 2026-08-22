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

// ── La frase de disparo LEE EL CONFIG, no un default literal ──────────────────
//
// En dev todos los valores están en su default, así que una frase que ignora el
// config se ve idéntica a una que lo lee. Este test pasa un valor DISTINTO del
// default y exige que aparezca (y que el default NO): si alguien reescribe una
// frase con el número quemado, se cae. Es lo que el gate no puede ver.

import { AUTOMATIONS } from './automations';
const frase = (key: string, config: Record<string, unknown>) => {
  const d = AUTOMATIONS.find(a => a.key === key);
  if (!d?.frase) throw new Error(`${key} no tiene frase`);
  return d.frase(config);
};

test('la frase inyecta el valor del config, no el default', () => {
  assert.match(frase('contraentrega_sin_cobrar', { diasDespachada: 5 }), /5 días/);
  assert.doesNotMatch(frase('contraentrega_sin_cobrar', { diasDespachada: 5 }), /3 días/);
  assert.match(frase('entrega_sin_cobro', { horasEntrega: 10 }), /10 horas/);
  assert.match(frase('envio_estancado', { diasEnRuta: 9 }), /9 días/);
  assert.match(frase('resumen_diario', { hora: 15 }), /15:00/);
  assert.match(frase('reporte_semanal', { hora: 20 }), /20:00/);
});

test('el plural de la frase concuerda con el valor', () => {
  assert.match(frase('contraentrega_sin_cobrar', { diasDespachada: 1 }), /1 día\b/);
  assert.doesNotMatch(frase('contraentrega_sin_cobrar', { diasDespachada: 1 }), /1 días/);
  assert.match(frase('entrega_sin_cobro', { horasEntrega: 1 }), /1 hora\b/);
});

test('las frases estáticas ignoran el config (no tienen umbral que leer)', () => {
  const est = frase('stock_bajo', { loQueSea: 999 });
  assert.equal(est, 'Avisa cuando un producto cruza su mínimo.');
});
