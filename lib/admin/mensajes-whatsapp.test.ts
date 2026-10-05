import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  momentoDePedido,
  primerNombre,
  mensajeWhatsappPedido,
  mensajeWhatsappCliente,
  rastreoUrl,
} from './mensajes-whatsapp';

// ── momentoDePedido ──────────────────────────────────────────────────────────

test('pendiente sin envío: pago pendiente', () => {
  assert.equal(momentoDePedido({ estado: 'pendiente', shippingEstado: null }), 'pago_pendiente');
});

test('pendiente sin NINGÚN dato de envío (campo ausente): pago pendiente', () => {
  assert.equal(momentoDePedido({ estado: 'pendiente' }), 'pago_pendiente');
});

test('pagado sin envío: pago confirmado', () => {
  assert.equal(momentoDePedido({ estado: 'pagado', shippingEstado: null }), 'pago_confirmado');
});

test('pagado con envío preparando: pago confirmado', () => {
  assert.equal(momentoDePedido({ estado: 'pagado', shippingEstado: 'preparando' }), 'pago_confirmado');
});

test('contraentrega pendiente con envío preparando (sin pago todavía): pago confirmado — ya se está preparando', () => {
  assert.equal(momentoDePedido({ estado: 'pendiente', shippingEstado: 'preparando' }), 'pago_confirmado');
});

test('envío en_ruta manda sobre el pago, aunque la orden siga pendiente (contraentrega despachada)', () => {
  assert.equal(momentoDePedido({ estado: 'pendiente', shippingEstado: 'en_ruta' }), 'en_camino');
});

test('envío entregado manda sobre el pago', () => {
  assert.equal(momentoDePedido({ estado: 'pendiente', shippingEstado: 'entregado' }), 'entregado');
});

test('envío fallido: otro (sin momento propio)', () => {
  assert.equal(momentoDePedido({ estado: 'pagado', shippingEstado: 'fallido' }), 'otro');
});

test('envío cancelado: otro', () => {
  assert.equal(momentoDePedido({ estado: 'pagado', shippingEstado: 'cancelado' }), 'otro');
});

test('orden cancelada gana sobre cualquier estado de envío', () => {
  assert.equal(momentoDePedido({ estado: 'cancelado', shippingEstado: 'en_ruta' }), 'otro');
});

test('sólo con shippingEstado (sin `estado`, como en ScheduleDeliveryModal): preparando → pago confirmado', () => {
  assert.equal(momentoDePedido({ shippingEstado: 'preparando' }), 'pago_confirmado');
});

test('sin ningún dato: pago pendiente (el default más conservador)', () => {
  assert.equal(momentoDePedido({}), 'pago_pendiente');
});

// ── primerNombre ─────────────────────────────────────────────────────────────

test('primerNombre: nombre y apellido → sólo el primero', () => {
  assert.equal(primerNombre('Camilo Moya'), 'Camilo');
});

test('primerNombre: todo en mayúsculas → inicial mayúscula, resto minúscula', () => {
  assert.equal(primerNombre('CAMILO moya'), 'Camilo');
});

test('primerNombre: dos nombres de pila → el primero', () => {
  assert.equal(primerNombre('ana maría gómez'), 'Ana');
});

test('primerNombre: espacios de sobra no rompen el corte', () => {
  assert.equal(primerNombre('  camilo   moya  '), 'Camilo');
});

test('primerNombre: sin nombre (vacío) → string vacío', () => {
  assert.equal(primerNombre(''), '');
});

test('primerNombre: null → string vacío', () => {
  assert.equal(primerNombre(null), '');
});

test('primerNombre: undefined → string vacío', () => {
  assert.equal(primerNombre(undefined), '');
});

// ── mensajeWhatsappPedido ────────────────────────────────────────────────────

test('mensaje de pago pendiente', () => {
  const msg = mensajeWhatsappPedido(
    { estado: 'pendiente' },
    { nombreCompleto: 'Camilo Moya', tienda: 'Café Nayoli', numeroOrden: 'CN-123456' },
  );
  assert.equal(
    msg,
    'Hola Camilo, te escribimos de Café Nayoli por tu pedido CN-123456. Quedó pendiente el pago; si necesitas ayuda para completarlo, respóndenos por aquí.',
  );
});

test('mensaje de pago confirmado', () => {
  const msg = mensajeWhatsappPedido(
    { estado: 'pagado', shippingEstado: 'preparando' },
    { nombreCompleto: 'Camilo Moya', tienda: 'Café Nayoli', numeroOrden: 'CN-123456' },
  );
  assert.equal(msg, 'Hola Camilo, confirmamos el pago de tu pedido CN-123456 en Café Nayoli. Ya lo estamos preparando.');
});

test('mensaje en camino incluye el enlace de rastreo', () => {
  const msg = mensajeWhatsappPedido(
    { shippingEstado: 'en_ruta' },
    {
      nombreCompleto: 'Camilo Moya', tienda: 'Café Nayoli', numeroOrden: 'CN-123456',
      rastreo: 'https://nayoli.com/rastrear-pedido?orden=CN-123456',
    },
  );
  assert.equal(
    msg,
    'Hola Camilo, tu pedido CN-123456 de Café Nayoli va en camino. Puedes seguirlo aquí: https://nayoli.com/rastrear-pedido?orden=CN-123456',
  );
});

test('mensaje en camino sin rastreo (hueco vacío) no deja basura visible', () => {
  const msg = mensajeWhatsappPedido(
    { shippingEstado: 'en_ruta' },
    { nombreCompleto: 'Camilo', tienda: 'Café Nayoli', numeroOrden: 'CN-1' },
  );
  assert.equal(msg, 'Hola Camilo, tu pedido CN-1 de Café Nayoli va en camino. Puedes seguirlo aquí:');
});

test('mensaje de entregado', () => {
  const msg = mensajeWhatsappPedido(
    { shippingEstado: 'entregado' },
    { nombreCompleto: 'Camilo Moya', tienda: 'Café Nayoli', numeroOrden: 'CN-123456' },
  );
  assert.equal(msg, 'Hola Camilo, ¿cómo te llegó tu pedido CN-123456? Gracias por comprar en Café Nayoli.');
});

test('mensaje genérico (cancelado) conserva el texto de hoy, con primer nombre', () => {
  const msg = mensajeWhatsappPedido(
    { estado: 'cancelado' },
    { nombreCompleto: 'Camilo Moya', tienda: 'Café Nayoli', numeroOrden: 'CN-123456' },
  );
  assert.equal(msg, 'Hola Camilo, te escribimos de Café Nayoli por tu pedido CN-123456.');
});

test('sin nombre de cliente: el saludo no deja un hueco huérfano', () => {
  const msg = mensajeWhatsappPedido(
    { estado: 'pendiente' },
    { nombreCompleto: null, tienda: 'Café Nayoli', numeroOrden: 'CN-1' },
  );
  assert.equal(
    msg,
    'Hola, te escribimos de Café Nayoli por tu pedido CN-1. Quedó pendiente el pago; si necesitas ayuda para completarlo, respóndenos por aquí.',
  );
});

// ── mensajeWhatsappCliente (ficha del cliente, sin pedido) ───────────────────

test('mensaje de ficha de cliente con nombre', () => {
  assert.equal(mensajeWhatsappCliente('Camilo Moya', 'Café Nayoli'), 'Hola Camilo, te escribimos de Café Nayoli.');
});

test('mensaje de ficha de cliente sin nombre', () => {
  assert.equal(mensajeWhatsappCliente(null, 'Café Nayoli'), 'Hola, te escribimos de Café Nayoli.');
});

// ── rastreoUrl ────────────────────────────────────────────────────────────────

test('rastreoUrl con email: los dos query params', () => {
  assert.equal(
    rastreoUrl('https://nayoli.com', 'CN-123456', 'cliente@example.com'),
    'https://nayoli.com/rastrear-pedido?orden=CN-123456&email=cliente%40example.com',
  );
});

test('rastreoUrl sin email: sólo el número de orden', () => {
  assert.equal(rastreoUrl('https://nayoli.com', 'CN-123456'), 'https://nayoli.com/rastrear-pedido?orden=CN-123456');
});

test('rastreoUrl con email null: igual que sin email', () => {
  assert.equal(rastreoUrl('https://nayoli.com', 'CN-123456', null), 'https://nayoli.com/rastrear-pedido?orden=CN-123456');
});
