import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toWhatsappNumber, normalizeCustomerPhone, customerWhatsappHref } from './whatsapp-link';

// Este módulo no tenía test propio — el gap se cerró al tocarlo para el mensaje
// según el momento (PEDIDOS-WHATSAPP-MENSAJES-1). Sin cambio de comportamiento:
// afirma lo que el código YA hacía.

// ── toWhatsappNumber ─────────────────────────────────────────────────────────

test('toWhatsappNumber: móvil de 10 dígitos sin indicativo', () => {
  assert.equal(toWhatsappNumber('3001234567'), '573001234567');
});

test('toWhatsappNumber: con espacios y guiones', () => {
  assert.equal(toWhatsappNumber('300 123-4567'), '573001234567');
});

test('toWhatsappNumber: ya con indicativo 57 y "+"', () => {
  assert.equal(toWhatsappNumber('+573001234567'), '573001234567');
});

test('toWhatsappNumber: ya con indicativo 57 sin "+"', () => {
  assert.equal(toWhatsappNumber('573001234567'), '573001234567');
});

test('toWhatsappNumber: fijo (no empieza por 3) → null', () => {
  assert.equal(toWhatsappNumber('6012345678'), null);
});

test('toWhatsappNumber: muy corto → null', () => {
  assert.equal(toWhatsappNumber('300123'), null);
});

test('toWhatsappNumber: vacío → null', () => {
  assert.equal(toWhatsappNumber(''), null);
});

test('toWhatsappNumber: null/undefined → null', () => {
  assert.equal(toWhatsappNumber(null), null);
  assert.equal(toWhatsappNumber(undefined), null);
});

// ── normalizeCustomerPhone ───────────────────────────────────────────────────

test('normalizeCustomerPhone: forma canónica +57 + 10 dígitos', () => {
  assert.equal(normalizeCustomerPhone('300 123 4567'), '+573001234567');
});

test('normalizeCustomerPhone: dos escrituras del MISMO número dan la MISMA clave', () => {
  assert.equal(normalizeCustomerPhone('+57 310 234 5678'), normalizeCustomerPhone('3102345678'));
});

test('normalizeCustomerPhone: inválido → null', () => {
  assert.equal(normalizeCustomerPhone('123'), null);
});

// ── customerWhatsappHref ─────────────────────────────────────────────────────

test('customerWhatsappHref: arma el link wa.me con el mensaje codificado', () => {
  const href = customerWhatsappHref('3001234567', 'Hola Camilo, te escribimos de Café Nayoli.');
  assert.equal(href, 'https://wa.me/573001234567?text=Hola%20Camilo%2C%20te%20escribimos%20de%20Caf%C3%A9%20Nayoli.');
});

test('customerWhatsappHref: teléfono inválido → null (ningún botón que ofrecer)', () => {
  assert.equal(customerWhatsappHref('123', 'Hola'), null);
});

test('customerWhatsappHref: sin teléfono → null', () => {
  assert.equal(customerWhatsappHref(null, 'Hola'), null);
  assert.equal(customerWhatsappHref(undefined, 'Hola'), null);
});
