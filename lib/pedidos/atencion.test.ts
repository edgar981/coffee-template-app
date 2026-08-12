import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  motivosDeAtencion, necesitaAtencion, hayPedidosPorAtender,
  type OrdenParaAtencion,
} from './atencion';

const orden = (o: Partial<OrdenParaAtencion> = {}): OrdenParaAtencion => ({
  estado: 'pendiente', condicion_pago: 'ANTICIPADO', ...o,
});

// Los cuatro casos que SÍ piden acción, cada uno aislado.
const PorCobrar   = orden({ condicion_pago: 'CONTRAENTREGA', shipping: { estado: 'en_ruta' } });
const AMedias     = orden({ shipping: { estado: 'preparando', mensajero: 'Luis', fecha_programada: null } });
const Fallida     = orden({ shipping: { estado: 'fallido' } });
const SinVerificar = orden({ comprobantes: [{ estado: 'RECIBIDO' }] });

test('los CUATRO motivos, uno por uno', () => {
  assert.deepEqual(motivosDeAtencion(PorCobrar),    ['por_cobrar']);
  assert.deepEqual(motivosDeAtencion(AMedias),      ['programacion_a_medias']);
  assert.deepEqual(motivosDeAtencion(Fallida),      ['entrega_fallida']);
  assert.deepEqual(motivosDeAtencion(SinVerificar), ['comprobante_sin_verificar']);
});

test('un pedido puede pedir acción por VARIOS motivos a la vez', () => {
  const both = orden({
    condicion_pago: 'CONTRAENTREGA',
    shipping:       { estado: 'en_ruta' },
    comprobantes:   [{ estado: 'RECIBIDO' }],
  });
  assert.deepEqual(motivosDeAtencion(both), ['por_cobrar', 'comprobante_sin_verificar']);
});

test('lo NORMAL no pide nada — el sol no puede ser el default', () => {
  // Si estos encendieran, el pill marcaría casi toda la lista y el punto del nav
  // estaría siempre prendido: un aviso que siempre está es un aviso que no se ve.
  const tranquilos: [string, OrdenParaAtencion][] = [
    ['recién creada, sin envío',        orden()],
    ['envío creado y vacío',            orden({ shipping: { estado: 'preparando' } })],
    ['lista para despachar',            orden({ shipping: { estado: 'preparando', mensajero: 'Luis', fecha_programada: '2026-05-14' } })],
    ['anticipada ya pagada, en ruta',   orden({ estado: 'pagado', shipping: { estado: 'en_ruta' } })],
    ['entregada y cobrada',             orden({ estado: 'pagado', shipping: { estado: 'entregado' } })],
    ['contraentrega aún no despachada', orden({ condicion_pago: 'CONTRAENTREGA', shipping: { estado: 'preparando' } })],
    ['soporte ya verificado',           orden({ comprobantes: [{ estado: 'VERIFICADO' }] })],
    ['soporte rechazado (ya se miró)',  orden({ comprobantes: [{ estado: 'RECHAZADO' }] })],
  ];
  for (const [caso, o] of tranquilos) {
    assert.deepEqual(motivosDeAtencion(o), [], `"${caso}" no debería pedir acción`);
  }
});

test('programación A MEDIAS: falta UNA de las dos, no ninguna y no las dos', () => {
  const conMensajero = orden({ shipping: { estado: 'preparando', mensajero: 'Luis', fecha_programada: null } });
  const conFecha     = orden({ shipping: { estado: 'preparando', mensajero: null, fecha_programada: '2026-05-14' } });
  const vacío        = orden({ shipping: { estado: 'preparando' } });
  const completa     = orden({ shipping: { estado: 'preparando', mensajero: 'Luis', fecha_programada: '2026-05-14' } });

  assert.ok(necesitaAtencion(conMensajero), 'con mensajero y sin fecha: brecha');
  assert.ok(necesitaAtencion(conFecha),     'con fecha y sin mensajero: brecha');
  assert.ok(!necesitaAtencion(vacío),       'nadie la tocó todavía: es el estado normal, no una brecha');
  assert.ok(!necesitaAtencion(completa),    'lista para despachar: no falta nada');

  // Un espacio en blanco no es un dato — se apoya en `hasScheduleData`, que hace
  // `.trim()`. Si esta pantalla comparara `!== null` por su cuenta, marcaría como
  // "a medias" algo que el board de Entregas considera vacío.
  assert.ok(!necesitaAtencion(orden({ shipping: { estado: 'preparando', mensajero: '   ' } })));
});

test('CANCELADO no pide nada, aunque arrastre motivos', () => {
  // Es terminal: no hay acción que tomar. Y el sol tiene que significar siempre lo
  // mismo — un punto que se enciende por un pedido muerto lo vuelve ruido.
  const cancelada = orden({
    estado:         'cancelado',
    condicion_pago: 'CONTRAENTREGA',
    shipping:       { estado: 'preparando', mensajero: 'Luis', fecha_programada: null },
    comprobantes:   [{ estado: 'RECIBIDO' }],
  });
  assert.deepEqual(motivosDeAtencion(cancelada), []);
});

test('el punto del nav y el pill salen de la MISMA definición', () => {
  const lista = [orden(), orden({ estado: 'pagado' }), Fallida];
  assert.equal(hayPedidosPorAtender(lista), true);
  // La equivalencia es el invariante: si divergieran, el operador vería el punto
  // en el rail y al entrar no encontraría qué lo causó.
  assert.equal(hayPedidosPorAtender(lista), lista.some(necesitaAtencion));
  assert.equal(hayPedidosPorAtender(lista.filter(o => o !== Fallida)), false);
  assert.equal(hayPedidosPorAtender([]), false, 'sin pedidos no hay punto');
});
