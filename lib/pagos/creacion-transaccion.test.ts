import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clasificarCreacionTransaccion, construirDatosCreacionTransaccion } from './creacion-transaccion';
import { DESCRIPTOR_NEQUI } from './metodos-pasarela';

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

test('construirDatosCreacionTransaccion: arma el cuerpo completo con el payment_method del descriptor', () => {
  const cuerpo = construirDatosCreacionTransaccion(
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
  assert.deepEqual(cuerpo, {
    acceptance_token:     'token-terminos',
    accept_personal_auth: 'token-datos',
    amount_in_cents:      5_000_00,
    currency:             'COP',
    signature:            'firma-de-prueba',
    reference:            'CN-100001:abc123',
    payment_method:       { type: 'NEQUI', phone_number: '3001234567' },
  });
});

test('construirDatosCreacionTransaccion: el payment_method viene EXCLUSIVAMENTE del descriptor, nunca de un caso por tipo acá', () => {
  // Un descriptor "de mentira" con una forma de payment_method arbitraria — si esta función
  // tuviera un `if` por tipo, este descriptor NO pasaría por él y el payment_method saldría
  // distinto de lo que su propio `construirPaymentMethod` devuelve.
  const descriptorDeMentira = {
    tipo: 'INVENTADO',
    nombreVisible: 'Inventado',
    campo: { rotulo: '', placeholder: '', validar: () => null },
    construirPaymentMethod: (dato: string) => ({ type: 'INVENTADO', algo_raro: dato.toUpperCase() }),
  };
  const cuerpo = construirDatosCreacionTransaccion(
    {
      reference: 'r', amountInCents: 1, currency: 'COP', signature: 's',
      acceptanceToken: 'a', acceptPersonalAuthToken: 'b',
    },
    descriptorDeMentira,
    'hola',
  );
  assert.deepEqual(cuerpo.payment_method, { type: 'INVENTADO', algo_raro: 'HOLA' });
});
