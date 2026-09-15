import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isUniqueViolation, referenciaIntentoPago } from './orders';

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

// ── referenciaIntentoPago (WOMPI-CREADOR-DE-INTENTOS-1) ───────────────────────
//
// Este archivo corre SIN base (`npm test`, capa 1 — ver package.json: sólo
// `lib/**`, `constants/**`, `packages/core/**`, node --test, sin Postgres). El
// creador de intentos vive DENTRO de la transacción de `createOrderWithCustomer`
// (`tx.paymentIntent.create`/`.update`, sobre `Prisma.TransactionClient`), así
// que su escritura real —y la garantía "sin `crearIntentoPago` no se crea
// ninguna fila"— NO es afirmable acá: exige una base real, y una prueba así
// pertenece al carril de integración (`tests/integracion/`), fuera del alcance
// de este slice (`touches:` no incluye ningún archivo de ese directorio). La
// garantía queda, hoy, por CONSTRUCCIÓN — un único `if (input.crearIntentoPago)`
// envuelve la única llamada a `tx.paymentIntent.create` en todo el archivo
// (verificable por lectura/grep) — y documentada como hueco en el reporte del
// slice, no como cubierta por un test que no puede existir sin tocar un archivo
// fuera de `touches:`.
//
// Lo que SÍ es puro y se afirma acá es el FORMATO de la referencia.

test('referenciaIntentoPago: concatena numero_orden y el id de la fila con dos puntos', () => {
  assert.equal(referenciaIntentoPago('CN-123456', 'cljk2x9z10000qzrmn831i7rn'), 'CN-123456:cljk2x9z10000qzrmn831i7rn');
});

test('referenciaIntentoPago: DOS llamadas con el mismo numero_orden pero distinto id de fila difieren', () => {
  // Es justo la propiedad que hace posible "varios PaymentIntent por orden"
  // (schema.prisma: `orden_id` con índice, sin unique) sin que sus referencias
  // choquen contra el @unique de `PaymentIntent.reference`.
  const a = referenciaIntentoPago('CN-123456', 'id-del-primer-intento');
  const b = referenciaIntentoPago('CN-123456', 'id-del-segundo-intento');
  assert.notEqual(a, b);
});
