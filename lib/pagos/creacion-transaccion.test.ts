import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clasificarCreacionTransaccion, construirDatosCreacionTransaccion, construirDatosCreacionTransaccionTarjeta,
} from './creacion-transaccion';
import { DESCRIPTOR_NEQUI } from './metodos-pasarela';
import type { DatosNavegador3ds } from './tres-ds';

// Datos de navegador de PRUEBA (§ API-DIRECTA-3DS-SIN-CHALLENGE-1) — `construirDatosCreacionTransaccionTarjeta`
// los exige SIEMPRE (parámetro requerido, no opcional): no hay forma de armar los datos de una
// transacción de tarjeta sin pedir 3DS.
const NAVEGADOR_DE_PRUEBA: DatosNavegador3ds = {
  colorDepth: 24,
  javaEnabled: false,
  language: 'es-CO',
  screenHeight: 900,
  screenWidth: 1440,
  timezoneOffsetMin: 300,
  userAgent: 'Mozilla/5.0 (test)',
};

// Las cuatro ramas, con la forma real de respuesta transcrita del libro
// (§ API-DIRECTA-SPIKES-ASIENTO-1, DECISIONS.md — medido contra el sandbox real, NO
// re-medido por este slice, que no tiene acceso a red).

test('correcta (201, estado PENDING) → creada, con la transacción completa', () => {
  const r = clasificarCreacionTransaccion({
    status: 201,
    body:   { data: { id: 'trx-1', status: 'PENDING', amount_in_cents: 5_000_00 } },
  });
  assert.deepEqual(r, {
    tipo:        'creada',
    transaccion: { id: 'trx-1', status: 'PENDING', amount_in_cents: 5_000_00 },
  });
});

test('200 con la misma forma también cuenta como creada (por si el proveedor no usa 201)', () => {
  const r = clasificarCreacionTransaccion({
    status: 200,
    body:   { data: { id: 'trx-2', status: 'PENDING', amount_in_cents: 1_000_00 } },
  });
  assert.equal(r.tipo, 'creada');
});

test('firma AUSENTE (422 INPUT_VALIDATION_ERROR) → firma_invalida, con el texto transcrito del libro', () => {
  const r = clasificarCreacionTransaccion({
    status: 422,
    body: {
      error: {
        type:     'INPUT_VALIDATION_ERROR',
        messages: { signature: ['Firma de integridad requerida no enviada'] },
      },
    },
  });
  assert.deepEqual(r, { tipo: 'firma_invalida', motivo: 'Firma de integridad requerida no enviada' });
});

test('firma ALTERADA (422 INPUT_VALIDATION_ERROR) → firma_invalida, con un mensaje DISTINTO al de ausencia', () => {
  const r = clasificarCreacionTransaccion({
    status: 422,
    body: {
      error: {
        type:     'INPUT_VALIDATION_ERROR',
        messages: { signature: ['La firma es inválida'] },
      },
    },
  });
  assert.deepEqual(r, { tipo: 'firma_invalida', motivo: 'La firma es inválida' });
});

test('método NO HABILITADO (404 NOT_FOUND_ERROR) → metodo_no_habilitado, con el motivo que nombra el tipo exacto', () => {
  const r = clasificarCreacionTransaccion({
    status: 404,
    body: {
      error: {
        type:   'NOT_FOUND_ERROR',
        reason: 'No hay una identidad de pago para BRE_B configurada para este comercio',
      },
    },
  });
  assert.deepEqual(r, {
    tipo:   'metodo_no_habilitado',
    motivo: 'No hay una identidad de pago para BRE_B configurada para este comercio',
  });
});

test('SIN CREDENCIAL (401 INVALID_ACCESS_TOKEN) → otro_fallo, no se descarta el caso aunque no debería ocurrir', () => {
  const r = clasificarCreacionTransaccion({
    status: 401,
    body: {
      error: {
        type:   'INVALID_ACCESS_TOKEN',
        reason: 'Se esperaba una llave pública o privada pero no se recibió ninguna',
      },
    },
  });
  assert.deepEqual(r, {
    tipo:   'otro_fallo',
    status: 401,
    motivo: 'Se esperaba una llave pública o privada pero no se recibió ninguna',
  });
});

test('422 INPUT_VALIDATION_ERROR sin mensaje de `signature` → otro_fallo (validación de OTRO campo, no la firma)', () => {
  const r = clasificarCreacionTransaccion({
    status: 422,
    body: {
      error: {
        type:     'INPUT_VALIDATION_ERROR',
        messages: { amount_in_cents: ['El monto es requerido'] },
      },
    },
  });
  assert.equal(r.tipo, 'otro_fallo');
  assert.equal((r as { status: number }).status, 422);
});

test('201 con éxito pero sin la forma esperada (sin `data`, o `data` incompleto) → otro_fallo, nunca "creada" a medias', () => {
  const sinData = clasificarCreacionTransaccion({ status: 201, body: {} });
  assert.equal(sinData.tipo, 'otro_fallo');

  const dataIncompleta = clasificarCreacionTransaccion({
    status: 201,
    body:   { data: { id: 'trx-3' } }, // falta status y amount_in_cents
  });
  assert.equal(dataIncompleta.tipo, 'otro_fallo');
});

test('un cuerpo irreconocible (network 500 sin sobre `error`, o `null`) → otro_fallo, con el status', () => {
  const r1 = clasificarCreacionTransaccion({ status: 500, body: null });
  assert.deepEqual(r1, { tipo: 'otro_fallo', status: 500, motivo: 'Wompi respondió 500 al crear la transacción.' });

  const r2 = clasificarCreacionTransaccion({ status: 503, body: 'Service Unavailable' });
  assert.equal(r2.tipo, 'otro_fallo');
  assert.equal((r2 as { status: number }).status, 503);
});

// ── LA CLASIFICACIÓN NO CAMBIA PARA UN MÉTODO QUE NO ES TARJETA (§ API-DIRECTA-OTROS-
// METODOS-1, §2 del reporte del slice: "el rechazo por método no habilitado y el de firma
// siguen reconociéndose igual") — el clasificador nunca mira QUÉ tipo se intentó, sólo la
// respuesta, así que un rechazo de NEQUI se reconoce con la MISMA forma que el de BRE_B
// (arriba, con la tarjeta) o de cualquier otro tipo. ──────────────────────────────────────────

test('método NO HABILITADO para NEQUI (404 NOT_FOUND_ERROR) → metodo_no_habilitado, MISMA forma que para tarjeta', () => {
  const r = clasificarCreacionTransaccion({
    status: 404,
    body: {
      error: {
        type:   'NOT_FOUND_ERROR',
        reason: 'No hay una identidad de pago para NEQUI configurada para este comercio',
      },
    },
  });
  assert.deepEqual(r, {
    tipo:   'metodo_no_habilitado',
    motivo: 'No hay una identidad de pago para NEQUI configurada para este comercio',
  });
});

test('firma inválida al crear una transacción de NEQUI → firma_invalida, MISMA forma que para tarjeta', () => {
  const r = clasificarCreacionTransaccion({
    status: 422,
    body: {
      error: {
        type:     'INPUT_VALIDATION_ERROR',
        messages: { signature: ['La firma es inválida'] },
      },
    },
  });
  assert.deepEqual(r, { tipo: 'firma_invalida', motivo: 'La firma es inválida' });
});

// ── `construirDatosCreacionTransaccion` — LA CREACIÓN, ARMADA CON LA FORMA PROPIA DEL
// DESCRIPTOR (§ API-DIRECTA-OTROS-METODOS-1, §1: "agregar el tipo siguiente es agregar un
// descriptor, no tocar... la creación") ──────────────────────────────────────────────────────

test('construirDatosCreacionTransaccion: arma los datos completos con el payment_method del descriptor', () => {
  const datos = construirDatosCreacionTransaccion(
    {
      reference:               'CN-100001:abc123',
      amountInCents:            5_000_00,
      currency:                 'COP',
      signature:                'firma-de-prueba',
      acceptanceToken:          'token-terminos',
      acceptPersonalAuthToken:  'token-datos',
    },
    DESCRIPTOR_NEQUI,
    '300 123 4567',
  );
  assert.deepEqual(datos, {
    reference:               'CN-100001:abc123',
    amountInCents:            5_000_00,
    currency:                 'COP',
    signature:                'firma-de-prueba',
    acceptanceToken:          'token-terminos',
    acceptPersonalAuthToken:  'token-datos',
    paymentMethod:            { type: 'NEQUI', phone_number: '3001234567' },
  });
});

test('construirDatosCreacionTransaccion: el paymentMethod viene EXCLUSIVAMENTE del descriptor, nunca de un caso por tipo acá', () => {
  // Un descriptor "de mentira" con una forma de payment_method arbitraria — si esta función
  // tuviera un `if` por tipo, este descriptor NO pasaría por él y el paymentMethod saldría
  // distinto de lo que su propio `construirPaymentMethod` devuelve.
  const descriptorDeMentira = {
    tipo: 'INVENTADO',
    nombreVisible: 'Inventado',
    campo: { rotulo: '', placeholder: '', validar: () => null },
    construirPaymentMethod: (dato: string) => ({ type: 'INVENTADO', algo_raro: dato.toUpperCase() }),
  };
  const datos = construirDatosCreacionTransaccion(
    {
      reference: 'r', amountInCents: 1, currency: 'COP', signature: 's',
      acceptanceToken: 'a', acceptPersonalAuthToken: 'b',
    },
    descriptorDeMentira,
    'hola',
  );
  assert.deepEqual(datos.paymentMethod, { type: 'INVENTADO', algo_raro: 'HOLA' });
});

// ── `construirDatosCreacionTransaccionTarjeta` — LA MISMA FORMA, PARA EL MÉTODO QUE NO VIVE
// EN EL REGISTRO (§ API-DIRECTA-ENVIO-GENERICO-1), MÁS 3DS SIEMPRE (§ API-DIRECTA-3DS-SIN-
// CHALLENGE-1) ─────────────────────────────────────────────────────────────────────────────

test('construirDatosCreacionTransaccionTarjeta: arma el mismo payment_method que crearTransaccionTarjeta armaba antes de generalizarse', () => {
  const datos = construirDatosCreacionTransaccionTarjeta(
    {
      reference:               'CN-100003:xyz789',
      amountInCents:            8_000_00,
      currency:                 'COP',
      signature:                'firma-tarjeta',
      acceptanceToken:          'token-terminos',
      acceptPersonalAuthToken:  'token-datos',
    },
    'tok_test_card_abc123',
    NAVEGADOR_DE_PRUEBA,
  );
  assert.deepEqual(datos, {
    reference:               'CN-100003:xyz789',
    amountInCents:            8_000_00,
    currency:                 'COP',
    signature:                'firma-tarjeta',
    acceptanceToken:          'token-terminos',
    acceptPersonalAuthToken:  'token-datos',
    paymentMethod:            { type: 'CARD', installments: 1, token: 'tok_test_card_abc123' },
    threeDsAuth: {
      browser_color_depth:   '24',
      browser_java_enabled:  false,
      browser_language:      'es-CO',
      browser_screen_height: 900,
      browser_screen_width:  1440,
      browser_tz:            300,
      browser_user_agent:    'Mozilla/5.0 (test)',
    },
  });
});

test('construirDatosCreacionTransaccionTarjeta: SIEMPRE incluye threeDsAuth — no hay forma de omitirlo (§0, "no hay interruptor")', () => {
  const comunes = {
    reference: 'r', amountInCents: 1, currency: 'COP', signature: 's',
    acceptanceToken: 'a', acceptPersonalAuthToken: 'b',
  };
  const datos = construirDatosCreacionTransaccionTarjeta(comunes, 'tok_x', NAVEGADOR_DE_PRUEBA);
  assert.ok(datos.threeDsAuth, 'threeDsAuth debe estar presente en TODA transacción de tarjeta');
  assert.ok(Object.keys(datos.threeDsAuth).length > 0);
});

test('construirDatosCreacionTransaccionTarjeta: threeDsAuth NUNCA lleva un campo de la tarjeta — sólo los del navegador', () => {
  const comunes = {
    reference: 'r', amountInCents: 1, currency: 'COP', signature: 's',
    acceptanceToken: 'a', acceptPersonalAuthToken: 'b',
  };
  const datos = construirDatosCreacionTransaccionTarjeta(comunes, 'tok_secreto_de_la_tarjeta', NAVEGADOR_DE_PRUEBA);
  const claves = Object.keys(datos.threeDsAuth ?? {});
  for (const clave of claves) {
    assert.doesNotMatch(clave, /card|token|numero|cvv|cvc|exp_/i);
  }
  assert.deepEqual(JSON.stringify(datos.threeDsAuth).includes('tok_secreto_de_la_tarjeta'), false);
});

test('construirDatosCreacionTransaccionTarjeta y construirDatosCreacionTransaccion producen la MISMA forma de datos salvo paymentMethod y threeDsAuth (que sólo tarjeta lleva)', () => {
  const comunes = {
    reference: 'r', amountInCents: 1, currency: 'COP', signature: 's',
    acceptanceToken: 'a', acceptPersonalAuthToken: 'b',
  };
  const tarjeta = construirDatosCreacionTransaccionTarjeta(comunes, 'tok_1', NAVEGADOR_DE_PRUEBA);
  const nequi = construirDatosCreacionTransaccion(comunes, DESCRIPTOR_NEQUI, '3001234567');
  const { paymentMethod: pmTarjeta, threeDsAuth, ...restoTarjeta } = tarjeta;
  const { paymentMethod: pmNequi, ...restoNequi } = nequi;
  assert.deepEqual(restoTarjeta, restoNequi);
  assert.notDeepEqual(pmTarjeta, pmNequi);
  assert.ok(threeDsAuth);
  assert.equal((nequi as { threeDsAuth?: unknown }).threeDsAuth, undefined);
});
