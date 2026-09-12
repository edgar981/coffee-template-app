import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hrefOrden, hrefOrdenOLista, renderWhatsappTemplate } from './automations';

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

// ── WHATSAPP-PLANTILLAS-MARCA-1 — el nombre del negocio es {{n}}, no texto fijo ──
//
// El cuerpo de las tres plantillas al cliente horneaba «Café Nayoli» como texto FIJO.
// Pasó a variable posicional, el mecanismo que Meta ya exige para todo dato que varíe
// (`{{n}}`, sustituido por `renderWhatsappTemplate`). Mientras ninguna plantilla esté
// registrada ante Meta el cambio es gratis; el contrato que hay que sostener es que,
// con el nombre de Nayoli, el mensaje RENDERIZADO siga siendo byte-idéntico al de antes.

const plantillaDe = (key: string) => {
  const def = AUTOMATIONS.find(a => a.key === key);
  const tpl = def?.plantilla;
  if (!tpl) throw new Error(`${key} no tiene plantilla`);
  return tpl;
};

test('nueva_orden: con el nombre de Nayoli, el mensaje es byte-idéntico al de antes', () => {
  const mensaje = renderWhatsappTemplate(
    plantillaDe('nueva_orden'),
    ['Juan Pérez', 'CN-132453', '$ 45.000', 'Café Nayoli'],
  );
  assert.equal(
    mensaje,
    'Hola Juan Pérez, confirmamos tu orden CN-132453 por un total de $ 45.000. ' +
      'Ya estamos preparándola y te avisamos apenas salga a ruta. ' +
      'Gracias por comprar en Café Nayoli.',
  );
});

test('cliente_inactivo: con el nombre de Nayoli, el mensaje es byte-idéntico al de antes', () => {
  const mensaje = renderWhatsappTemplate(
    plantillaDe('cliente_inactivo'),
    ['María', 'Café Nayoli', 'un 10% de descuento en tu próximo pedido'],
  );
  assert.equal(
    mensaje,
    'Hola María, hace un tiempo no pasas por Café Nayoli y queremos verte de vuelta. ' +
      'Tenemos para ti un 10% de descuento en tu próximo pedido en tu próxima compra. ' +
      'Respóndenos por aquí y te ayudamos con el pedido.',
  );
});

test('orden_entregada: con el nombre de Nayoli, el mensaje es byte-idéntico al de antes', () => {
  const mensaje = renderWhatsappTemplate(
    plantillaDe('orden_entregada'),
    ['Juan Pérez', 'CN-132453', 'Café Nayoli'],
  );
  assert.equal(
    mensaje,
    'Hola Juan Pérez, tu orden CN-132453 fue entregada. ' +
      'Gracias por elegir Café Nayoli, esperamos que la disfrutes. ' +
      'Si algo no salió bien, respóndenos por aquí y lo resolvemos.',
  );
});

test('con OTRO nombre de negocio, el mensaje cambia SOLO en esa palabra', () => {
  const conNayoli = renderWhatsappTemplate(plantillaDe('orden_entregada'), ['Ana', 'CN-1', 'Café Nayoli']);
  const conOtro    = renderWhatsappTemplate(plantillaDe('orden_entregada'), ['Ana', 'CN-1', 'Tienda Otro Negocio']);
  assert.notEqual(conNayoli, conOtro);
  assert.equal(conNayoli.replace('Café Nayoli', '¤'), conOtro.replace('Tienda Otro Negocio', '¤'));
});

test('ninguna de las tres plantillas hornea ya el nombre de un negocio', () => {
  for (const key of ['nueva_orden', 'cliente_inactivo', 'orden_entregada']) {
    assert.doesNotMatch(plantillaDe(key).cuerpo, /Nayoli/);
  }
});
