import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aceptaComprobanteCliente, coincideEmail, admiteComprobanteCliente,
  mensajeRechazoComprobanteCliente, METODOS_CON_COMPROBANTE_CLIENTE,
  TOPE_COMPROBANTES_CLIENTE,
} from './comprobante-cliente';

// ─── aceptaComprobanteCliente ────────────────────────────────────────────────

test('acepta sólo los cuatro métodos que dejan evidencia — nunca efectivo ni la pasarela', () => {
  for (const m of METODOS_CON_COMPROBANTE_CLIENTE) assert.equal(aceptaComprobanteCliente(m), true);
  assert.equal(aceptaComprobanteCliente('efectivo'), false);
  assert.equal(aceptaComprobanteCliente('wompi'), false);
  assert.equal(aceptaComprobanteCliente(null), false);
  assert.equal(aceptaComprobanteCliente(''), false);
});

// ─── coincideEmail ───────────────────────────────────────────────────────────

test('coincideEmail normaliza espacios y mayúsculas — misma regla que /api/orders/track', () => {
  assert.equal(coincideEmail('Juan@Gmail.com', 'juan@gmail.com'), true);
  assert.equal(coincideEmail('  juan@gmail.com  ', 'juan@gmail.com'), true);
  assert.equal(coincideEmail('juan@gmail.com', 'maria@gmail.com'), false);
});

test('coincideEmail: una orden SIN correo guardado nunca coincide — null no es "cualquiera sirve"', () => {
  assert.equal(coincideEmail('juan@gmail.com', null), false);
  assert.equal(coincideEmail('juan@gmail.com', ''), false);
});

// ─── admiteComprobanteCliente — el ORDEN de evaluación es la decisión ───────

const ORDEN_OK = { estado: 'pendiente', metodo_pago: 'nequi', cliente_email: 'juan@gmail.com' };

test('las cuatro condiciones juntas → admite', () => {
  assert.deepEqual(admiteComprobanteCliente(ORDEN_OK, 'juan@gmail.com', 0), { ok: true });
});

test('correo que no coincide → email_no_coincide, SIN IMPORTAR el resto del estado', () => {
  // Incluso con la orden en un estado que de otro modo rechazaría por otra razón,
  // el motivo reportado es el de identidad — es el primero que se evalúa.
  const r = admiteComprobanteCliente({ ...ORDEN_OK, estado: 'pagado' }, 'otro@gmail.com', 0);
  assert.deepEqual(r, { ok: false, motivo: 'email_no_coincide' });
});

test('orden pagada (con correo correcto) → no_pendiente', () => {
  const r = admiteComprobanteCliente({ ...ORDEN_OK, estado: 'pagado' }, 'juan@gmail.com', 0);
  assert.deepEqual(r, { ok: false, motivo: 'no_pendiente' });
});

test('orden cancelada (con correo correcto) → no_pendiente', () => {
  const r = admiteComprobanteCliente({ ...ORDEN_OK, estado: 'cancelado' }, 'juan@gmail.com', 0);
  assert.deepEqual(r, { ok: false, motivo: 'no_pendiente' });
});

test('método efectivo → metodo_no_admite', () => {
  const r = admiteComprobanteCliente({ ...ORDEN_OK, metodo_pago: 'efectivo' }, 'juan@gmail.com', 0);
  assert.deepEqual(r, { ok: false, motivo: 'metodo_no_admite' });
});

test('método pasarela (\'wompi\') → metodo_no_admite', () => {
  const r = admiteComprobanteCliente({ ...ORDEN_OK, metodo_pago: 'wompi' }, 'juan@gmail.com', 0);
  assert.deepEqual(r, { ok: false, motivo: 'metodo_no_admite' });
});

test('método ausente (null) → metodo_no_admite', () => {
  const r = admiteComprobanteCliente({ ...ORDEN_OK, metodo_pago: null }, 'juan@gmail.com', 0);
  assert.deepEqual(r, { ok: false, motivo: 'metodo_no_admite' });
});

test('al tope exacto → tope_alcanzado; un comprobante menos → admite', () => {
  assert.deepEqual(
    admiteComprobanteCliente(ORDEN_OK, 'juan@gmail.com', TOPE_COMPROBANTES_CLIENTE),
    { ok: false, motivo: 'tope_alcanzado' },
  );
  assert.deepEqual(
    admiteComprobanteCliente(ORDEN_OK, 'juan@gmail.com', TOPE_COMPROBANTES_CLIENTE - 1),
    { ok: true },
  );
});

// ─── mensajeRechazoComprobanteCliente ────────────────────────────────────────

test('cada motivo mostrable tiene una frase propia, no vacía', () => {
  for (const motivo of ['no_pendiente', 'metodo_no_admite', 'tope_alcanzado'] as const) {
    const msg = mensajeRechazoComprobanteCliente(motivo);
    assert.ok(msg.length > 0);
  }
  // Las tres frases son DISTINTAS entre sí — una fallback compartida escondería
  // cuál de las tres pasó.
  const frases = new Set(
    (['no_pendiente', 'metodo_no_admite', 'tope_alcanzado'] as const).map(mensajeRechazoComprobanteCliente),
  );
  assert.equal(frases.size, 3);
});
