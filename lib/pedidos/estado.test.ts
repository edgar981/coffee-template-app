import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pasosDelPedido, badgeCobro, ETAPAS_PEDIDO, type OrdenParaEstado } from './estado';

const orden = (o: Partial<OrdenParaEstado> = {}): OrdenParaEstado => ({
  estado: 'pendiente', condicion_pago: 'ANTICIPADO', ...o,
});
const envio = (estado: string) => ({ shipping: { estado } });

// ─── STEPS ───────────────────────────────────────────────────────────────────

test('la secuencia es de FULFILLMENT: el pago NO es una etapa', () => {
  // Si el pago fuera una etapa, iría entre "Recibido" y "Preparando" — y en
  // CONTRAENTREGA la plata entra DESPUÉS de la entrega. La línea mentiría para un
  // caso de primera clase del negocio.
  assert.deepEqual([...ETAPAS_PEDIDO], ['Recibido', 'Preparando', 'En camino', 'Entregado']);
  assert.ok(!ETAPAS_PEDIDO.some(e => /pag/i.test(e)), 'ninguna etapa habla de pago');
});

test('la posición sale del ENVÍO, no del cobro', () => {
  const posicion = (o: OrdenParaEstado) => pasosDelPedido(o)?.current;
  assert.equal(posicion(orden()), 0, 'sin envío: la orden existe y nada más');
  assert.equal(posicion(orden(envio('preparando'))), 1);
  assert.equal(posicion(orden(envio('en_ruta'))), 2);
  assert.equal(posicion(orden({ ...envio('entregado') })), ETAPAS_PEDIDO.length - 1);

  // Y el cobro NO la mueve: una contraentrega despachada sin pagar va igual de
  // avanzada que una pagada. Son ejes ortogonales.
  assert.equal(
    posicion(orden({ ...envio('en_ruta'), condicion_pago: 'CONTRAENTREGA' })),
    posicion(orden({ ...envio('en_ruta'), estado: 'pagado' })),
  );
});

test('entregado marca la secuencia COMPLETA, no sólo la última etapa', () => {
  const p = pasosDelPedido(orden({ estado: 'pagado', ...envio('entregado') }))!;
  assert.equal(p.done, true, 'sin `done` la última etapa quedaría en curso para siempre');
});

test('una entrega FALLIDA se queda donde falló, no retrocede', () => {
  assert.equal(pasosDelPedido(orden(envio('fallido')))?.current, 2, 'salió y no llegó: sigue en "En camino"');
  // Retroceder a "Preparando" es lo que hace REPROGRAMAR, que es un acto del
  // operador y mueve el estado de verdad.
  assert.equal(pasosDelPedido(orden(envio('preparando')))?.current, 1);
});

test('un pedido CANCELADO no tiene progreso que mostrar', () => {
  assert.equal(pasosDelPedido(orden({ estado: 'cancelado' })), null);
  assert.equal(pasosDelPedido(orden({ estado: 'cancelado', ...envio('cancelado') })), null);
  assert.equal(
    pasosDelPedido(orden({ estado: 'cancelado', ...envio('en_ruta') })), null,
    'ni siquiera si el envío conserva la etapa: cancelado es un destino, no una etapa',
  );
});

test('un envío en estado desconocido CALLA en vez de inventar posición', () => {
  assert.equal(pasosDelPedido(orden(envio('devuelto'))), null);
});

// ─── BADGE DE COBRO ──────────────────────────────────────────────────────────

test('el badge nunca puede decir "en curso" — sólo estados en reposo', () => {
  // No se puede afirmar por tipos desde un test, pero sí que ningún caso real
  // produce una etiqueta de progreso: eso vive en los steps.
  const casos: OrdenParaEstado[] = [
    orden(), orden({ estado: 'pagado' }), orden({ estado: 'cancelado' }),
    orden({ condicion_pago: 'CONTRAENTREGA', ...envio('en_ruta') }),
    orden(envio('preparando')), orden(envio('fallido')),
  ];
  for (const c of casos) {
    for (const vista of ['lista', 'detalle'] as const) {
      const { label } = badgeCobro(c, vista);
      assert.ok(
        !/camino|preparand|ruta|curso/i.test(label),
        `"${label}" habla de progreso, y el progreso vive en los steps`,
      );
    }
  }
});

test('los tres estados de reposo del cobro', () => {
  assert.deepEqual(badgeCobro(orden({ estado: 'pagado' }), 'detalle'), { label: 'Pagado', tone: 'ok' });
  assert.deepEqual(badgeCobro(orden({ condicion_pago: 'CONTRAENTREGA' }), 'detalle'), { label: 'Contraentrega', tone: 'neutral' });
  assert.deepEqual(badgeCobro(orden(), 'detalle'), { label: 'Sin acreditar', tone: 'neutral' });
});

test('el ÁMBAR es la excepción: sólo la plata que ya está en la calle', () => {
  const enLaCalle = orden({ condicion_pago: 'CONTRAENTREGA', ...envio('en_ruta') });
  assert.deepEqual(badgeCobro(enLaCalle, 'lista'), { label: 'Por cobrar', tone: 'attention' });

  // Y NADA más lo enciende. Un pedido recién creado sin pagar es el estado normal;
  // pintarlo de ámbar teñiría la lista entera, que es lo que Amber Minimal prohíbe.
  for (const c of [
    orden(),
    orden(envio('preparando')),
    orden({ condicion_pago: 'CONTRAENTREGA' }),
    orden({ condicion_pago: 'CONTRAENTREGA', ...envio('preparando') }),
    orden({ estado: 'pagado' }),
  ]) {
    assert.notEqual(badgeCobro(c, 'lista').tone, 'attention', `${JSON.stringify(c)} no debería pedir atención`);
  }
});

test('"Por cobrar" escala SÓLO en la lista; en el detalle el contexto ya lo dice', () => {
  const enLaCalle = orden({ condicion_pago: 'CONTRAENTREGA', ...envio('en_ruta') });
  assert.equal(badgeCobro(enLaCalle, 'lista').label, 'Por cobrar');
  assert.deepEqual(
    badgeCobro(enLaCalle, 'detalle'), { label: 'Contraentrega', tone: 'neutral' },
    'en el detalle, el saldo y la condición ya están dichos: el chip sería una tercera vez',
  );
});

test('cancelado gana sobre todo lo demás: no es "sin acreditar", está muerto', () => {
  const cancelada = orden({ estado: 'cancelado', condicion_pago: 'CONTRAENTREGA', ...envio('en_ruta') });
  assert.deepEqual(badgeCobro(cancelada, 'lista'), { label: 'Cancelado', tone: 'problem' });
});
