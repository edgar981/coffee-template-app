import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contenidoEstadoPedido, verboBotonPago } from './estado-pedido';

test('aprobado: título fijo, frase saluda por nombre si lo hay', () => {
  const sinNombre = contenidoEstadoPedido('aprobado', 'wompi');
  assert.equal(sinNombre.titulo, 'Pago aprobado');
  assert.ok(!sinNombre.frase.includes('Gracias'));

  const conNombre = contenidoEstadoPedido('aprobado', 'wompi', 'Valentina');
  assert.ok(conNombre.frase.startsWith('Gracias, Valentina.'));
  assert.ok(conNombre.queSigue);
});

test('pendiente: dice que no hay que volver a pagar y que se actualiza sola', () => {
  const c = contenidoEstadoPedido('pendiente', 'wompi');
  assert.equal(c.titulo, 'Pago pendiente');
  assert.match(c.queSigue!, /no cierres esta página/i);
  assert.match(c.queSigue!, /no vuelvas a pagar/i);
});

test('rechazado: aclara que NO hubo cobro y que el pedido sigue guardado', () => {
  const c = contenidoEstadoPedido('rechazado', 'wompi');
  assert.equal(c.titulo, 'Pago rechazado');
  assert.match(c.queSigue!, /no se realizó ningún cobro/i);
  assert.match(c.queSigue!, /sigue guardado/i);
});

test('manual: el «qué sigue» varía por método', () => {
  const nequi = contenidoEstadoPedido('manual', 'nequi');
  assert.match(nequi.queSigue!, /equipo confirmará tu pago/i);

  const efectivo = contenidoEstadoPedido('manual', 'efectivo');
  assert.match(efectivo.queSigue!, /pagas al recibir/i);

  const transferencia = contenidoEstadoPedido('manual', 'transferencia');
  assert.match(transferencia.queSigue!, /comprobante/i);

  const whatsapp = contenidoEstadoPedido('manual', 'whatsapp');
  assert.match(whatsapp.queSigue!, /whatsapp/i);

  const sinMetodo = contenidoEstadoPedido('manual', null);
  assert.match(sinMetodo.queSigue!, /equipo confirmará tu pago/i);
});

test('manual: saluda por nombre, igual que "¡Pedido recibido!" de hoy', () => {
  const c = contenidoEstadoPedido('manual', 'efectivo', 'Carlos');
  assert.ok(c.frase.startsWith('Gracias, Carlos.'));
});

test('sin_referencia: nunca "carrito vacío", y sin "qué sigue" (no hay pedido que describir)', () => {
  const c = contenidoEstadoPedido('sin_referencia', null);
  assert.equal(c.titulo, 'No encontramos este pago');
  assert.ok(!/carrito/i.test(c.titulo) && !/carrito/i.test(c.frase));
  assert.equal(c.queSigue, null);
});

test('verboBotonPago: wompi, whatsapp y el resto de métodos manuales', () => {
  assert.equal(verboBotonPago('wompi'), 'Pagar con Wompi');
  assert.equal(verboBotonPago('whatsapp'), 'Enviar por WhatsApp');
  assert.equal(verboBotonPago('nequi'), 'Confirmar pedido');
  assert.equal(verboBotonPago('efectivo'), 'Confirmar pedido');
  assert.equal(verboBotonPago(null), 'Confirmar pedido');
});
