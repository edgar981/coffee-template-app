import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  momentoDePedido,
  primerNombre,
  mensajeWhatsappPedido,
  mensajeWhatsappCliente,
  rastreoUrl,
  interpolar,
  parseMensajesWhatsapp,
  plantillaPorDefecto,
  MOMENTOS_EDITABLES,
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

// ── overrides editables (PEDIDOS-WHATSAPP-MENSAJES-EDITABLES-1) ─────────────

test('mensajeWhatsappPedido SIN overrides: el texto de fábrica, igual que antes de este slice', () => {
  const msg = mensajeWhatsappPedido(
    { estado: 'pendiente' },
    { nombreCompleto: 'Camilo Moya', tienda: 'Café Nayoli', numeroOrden: 'CN-1' },
  );
  assert.match(msg, /^Hola Camilo, te escribimos de Café Nayoli por tu pedido CN-1\. Quedó pendiente/);
});

test('mensajeWhatsappPedido con override para el momento activo: usa el texto guardado', () => {
  const msg = mensajeWhatsappPedido(
    { shippingEstado: 'en_ruta' },
    { nombreCompleto: 'Camilo', tienda: 'Café Nayoli', numeroOrden: 'CN-1', rastreo: 'https://x/y' },
    { en_camino: 'Oye {nombre}, tu {pedido} va rumbo a ti: {rastreo}' },
  );
  assert.equal(msg, 'Oye Camilo, tu CN-1 va rumbo a ti: https://x/y');
});

test('mensajeWhatsappPedido con override de OTRO momento: no aplica (cada momento mira su propia clave)', () => {
  const msg = mensajeWhatsappPedido(
    { estado: 'pendiente' },
    { nombreCompleto: 'Camilo', tienda: 'Café Nayoli', numeroOrden: 'CN-1' },
    { en_camino: 'Esto no debería aparecer' },
  );
  assert.ok(!msg.includes('no debería aparecer'));
  assert.match(msg, /Quedó pendiente/);
});

test('mensajeWhatsappPedido: override en BLANCO cae a la fábrica, igual que ausente', () => {
  const msg = mensajeWhatsappPedido(
    { estado: 'pendiente' },
    { nombreCompleto: 'Camilo', tienda: 'Café Nayoli', numeroOrden: 'CN-1' },
    { pago_pendiente: '   ' },
  );
  assert.match(msg, /Quedó pendiente/);
});

test("mensajeWhatsappPedido: el momento 'otro' (orden cancelada) NUNCA mira overrides", () => {
  const msg = mensajeWhatsappPedido(
    { estado: 'cancelado' },
    { nombreCompleto: 'Camilo', tienda: 'Café Nayoli', numeroOrden: 'CN-1' },
    // 'otro' no es una clave de MensajesWhatsappGuardados — no hay cómo pasarle un
    // override a este momento, por diseño.
    {},
  );
  assert.equal(msg, 'Hola Camilo, te escribimos de Café Nayoli por tu pedido CN-1.');
});

test('mensajeWhatsappCliente con override del saludo: usa el texto guardado', () => {
  const msg = mensajeWhatsappCliente('Camilo Moya', 'Café Nayoli', { saludo_cliente: 'Qué tal {nombre}, somos {tienda}.' });
  assert.equal(msg, 'Qué tal Camilo, somos Café Nayoli.');
});

test('mensajeWhatsappCliente sin override del saludo: la fábrica de siempre', () => {
  const msg = mensajeWhatsappCliente('Camilo Moya', 'Café Nayoli', { en_camino: 'Esto es de otro momento' });
  assert.equal(msg, 'Hola Camilo, te escribimos de Café Nayoli.');
});

// ── interpolar: hueco desconocido queda LITERAL ──────────────────────────────

test('interpolar: un hueco conocido pero sin valor sustituye por vacío (y limpia el espacio)', () => {
  assert.equal(interpolar('Hola {nombre}, bienvenido', { nombre: '' }), 'Hola, bienvenido');
});

test('interpolar: un hueco DESCONOCIDO (no está en el mapa) queda literal, no desaparece', () => {
  assert.equal(interpolar('Hola {nombre}, tu código es {foo}', { nombre: 'Camilo' }), 'Hola Camilo, tu código es {foo}');
});

test('interpolar: insertar {pedido} en un texto sin ese hueco declarado lo deja literal', () => {
  // Es el caso real: el saludo de la ficha del cliente sólo declara {nombre}/{tienda}; si el
  // dueño inserta {pedido} ahí, debe VERSE en la vista previa, no desaparecer.
  const msg = mensajeWhatsappCliente('Camilo', 'Café Nayoli', { saludo_cliente: 'Hola {nombre}, tu pedido {pedido} de {tienda}' });
  assert.equal(msg, 'Hola Camilo, tu pedido {pedido} de Café Nayoli');
});

// ── parseMensajesWhatsapp: SOFT, nunca lanza ─────────────────────────────────

test('parseMensajesWhatsapp: objeto con las cinco claves válidas, todas sobreviven', () => {
  const entrada: Record<string, string> = {};
  for (const m of MOMENTOS_EDITABLES) entrada[m] = `texto de ${m}`;
  assert.deepEqual(parseMensajesWhatsapp(entrada), entrada);
});

test('parseMensajesWhatsapp: descarta claves desconocidas y valores no-string', () => {
  assert.deepEqual(
    parseMensajesWhatsapp({ en_camino: 'Custom', clave_inventada: 'x', pago_pendiente: 42 }),
    { en_camino: 'Custom' },
  );
});

test('parseMensajesWhatsapp: descarta strings vacíos/blancos', () => {
  assert.deepEqual(parseMensajesWhatsapp({ en_camino: '   ', entregado: 'Real' }), { entregado: 'Real' });
});

test('parseMensajesWhatsapp: null, array o string crudo → {} (nunca lanza)', () => {
  assert.deepEqual(parseMensajesWhatsapp(null), {});
  assert.deepEqual(parseMensajesWhatsapp(['no', 'es', 'un', 'objeto']), {});
  assert.deepEqual(parseMensajesWhatsapp('texto suelto'), {});
  assert.deepEqual(parseMensajesWhatsapp(undefined), {});
});

// ── plantillaPorDefecto: la MISMA fuente que el renderer ────────────────────

test('plantillaPorDefecto: saludo_cliente es la plantilla sin pedido', () => {
  assert.equal(mensajeWhatsappCliente('Camilo', 'Café Nayoli', { saludo_cliente: plantillaPorDefecto('saludo_cliente') }),
    mensajeWhatsappCliente('Camilo', 'Café Nayoli'));
});

test('plantillaPorDefecto de un momento de pedido: pasarla como override da el MISMO mensaje que no pasar nada', () => {
  const datos = { nombreCompleto: 'Camilo', tienda: 'Café Nayoli', numeroOrden: 'CN-1', rastreo: 'https://x' };
  const sinOverride = mensajeWhatsappPedido({ shippingEstado: 'en_ruta' }, datos);
  const conElMismoTextoComoOverride = mensajeWhatsappPedido({ shippingEstado: 'en_ruta' }, datos, { en_camino: plantillaPorDefecto('en_camino') });
  assert.equal(sinOverride, conElMismoTextoComoOverride);
});
