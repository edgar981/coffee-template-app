import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { waOperativo } from './whatsapp-operativo';

// El predicado ÚNICO del canal WhatsApp. Se afirma que exige LAS DOS credenciales:
// media configuración es tan "no operativo" como ninguna —un sender que intenta
// enviar con la mitad de las llaves falla— y el render tiene que tratarlo igual.

const PHONE = 'WHATSAPP_PHONE_NUMBER_ID';
const TOKEN = 'WHATSAPP_ACCESS_TOKEN';
const previo = { phone: process.env[PHONE], token: process.env[TOKEN] };

afterEach(() => {
  // Restaurar SIEMPRE: otros tests del proceso comparten process.env.
  previo.phone === undefined ? delete process.env[PHONE] : (process.env[PHONE] = previo.phone);
  previo.token === undefined ? delete process.env[TOKEN] : (process.env[TOKEN] = previo.token);
});

test('sin ninguna credencial: no operativo', () => {
  delete process.env[PHONE]; delete process.env[TOKEN];
  assert.equal(waOperativo(), false);
});

test('con sólo una credencial: NO operativo — media llave no abre', () => {
  process.env[PHONE] = '123456'; delete process.env[TOKEN];
  assert.equal(waOperativo(), false);
  delete process.env[PHONE]; process.env[TOKEN] = 'tok';
  assert.equal(waOperativo(), false);
});

test('con las dos: operativo', () => {
  process.env[PHONE] = '123456'; process.env[TOKEN] = 'tok';
  assert.equal(waOperativo(), true);
});

test('una credencial en blanco no cuenta como puesta', () => {
  process.env[PHONE] = '   '; process.env[TOKEN] = 'tok';
  assert.equal(waOperativo(), false);
});
