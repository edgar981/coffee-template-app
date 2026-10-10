import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tiendaInterludioVisible, tiendaCierreVisible, botonCierre } from './tienda-cierre';

test('Interludio sin imagen → no se muestra', () => {
  assert.equal(tiendaInterludioVisible(''), false);
  assert.equal(tiendaInterludioVisible('   '), false);
});

test('Interludio con imagen → se muestra', () => {
  assert.equal(tiendaInterludioVisible('https://blob.example/retrato.jpg'), true);
});

test('sin frase → la sección no se muestra', () => {
  assert.equal(tiendaCierreVisible(''), false);
  assert.equal(tiendaCierreVisible('   '), false);
});

test('con frase → la sección se muestra', () => {
  assert.equal(tiendaCierreVisible('¿Café cada mes?'), true);
});

test('botonCierre: con WhatsApp, usa el texto del dueño y el link de WhatsApp', () => {
  const r = botonCierre({
    whatsapp: '573001234567', boton: 'Escríbenos', mensajeWhatsapp: 'Hola',
    suscripcionesVisible: true,
  });
  assert.equal(r?.label, 'Escríbenos');
  assert.ok(r?.href.startsWith('https://wa.me/573001234567'));
});

test('con frase y sin WhatsApp → botón a /suscripciones', () => {
  const r = botonCierre({
    whatsapp: undefined, boton: 'Escríbenos', mensajeWhatsapp: 'Hola',
    suscripcionesVisible: true,
  });
  assert.deepEqual(r, { label: 'Ver suscripciones', href: '/suscripciones' });
});

test('con suscripciones apagada → sin botón', () => {
  const r = botonCierre({
    whatsapp: undefined, boton: 'Escríbenos', mensajeWhatsapp: 'Hola',
    suscripcionesVisible: false,
  });
  assert.equal(r, null);
});
