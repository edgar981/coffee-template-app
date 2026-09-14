import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isUniqueViolation } from './orders';

// isUniqueViolation gobierna la idempotencia de las automatizaciones
// (lib/automations/idempotency.ts, vía @duna/core/orders) y el reintento de
// numero_orden en createOrderWithCustomer — la ruta del dinero — sin tener
// hasta ahora un test propio. Se escribe ahora porque la función deja de tener
// una sola copia: idempotency.ts reimplementaba el mismo chequeo inline
// (ISUNIQUEVIOLATION-UNIFICAR-1). El caso NO reconocido cubre justo lo que esa
// copia chequeaba a mano.

test('isUniqueViolation reconoce un error con code P2002', () => {
  assert.equal(isUniqueViolation({ code: 'P2002' }), true);
});

test('isUniqueViolation NO reconoce otro código', () => {
  assert.equal(isUniqueViolation({ code: 'P2025' }), false);
});

test('isUniqueViolation NO reconoce null', () => {
  assert.equal(isUniqueViolation(null), false);
});

test('isUniqueViolation NO reconoce undefined', () => {
  assert.equal(isUniqueViolation(undefined), false);
});

test('isUniqueViolation NO reconoce una cadena', () => {
  assert.equal(isUniqueViolation('P2002'), false);
});

test('isUniqueViolation NO reconoce un objeto sin code', () => {
  assert.equal(isUniqueViolation({ message: 'boom' }), false);
});
