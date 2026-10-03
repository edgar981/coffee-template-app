import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aceptaComprobanteCliente, emitirCodigoComprobante, verificarCodigoComprobante,
  admiteComprobanteCliente, mensajeRechazoComprobanteCliente, METODOS_CON_COMPROBANTE_CLIENTE,
  TOPE_COMPROBANTES_CLIENTE, VENCIMIENTO_CODIGO_COMPROBANTE_MS,
} from './comprobante-cliente';

const SECRETO = 'un-secreto-de-prueba-cualquiera-0123456789';
const AHORA = 1_700_000_000_000;

// ─── aceptaComprobanteCliente ────────────────────────────────────────────────

test('acepta sólo los cuatro métodos que dejan evidencia — nunca efectivo ni la pasarela', () => {
  for (const m of METODOS_CON_COMPROBANTE_CLIENTE) assert.equal(aceptaComprobanteCliente(m), true);
  assert.equal(aceptaComprobanteCliente('efectivo'), false);
  assert.equal(aceptaComprobanteCliente('wompi'), false);
  assert.equal(aceptaComprobanteCliente(null), false);
  assert.equal(aceptaComprobanteCliente(''), false);
});

// ─── emitirCodigoComprobante / verificarCodigoComprobante ───────────────────

test('un código recién emitido verifica para SU orden', () => {
  const codigo = emitirCodigoComprobante('CN-100001', SECRETO, AHORA);
  assert.notEqual(codigo, null);
  assert.equal(verificarCodigoComprobante(codigo as string, 'CN-100001', SECRETO, AHORA), true);
});

test('sin secreto en la emisión → null, FALLA CERRADA (nunca una clave por defecto)', () => {
  assert.equal(emitirCodigoComprobante('CN-100001', undefined, AHORA), null);
});

test('sin secreto en la verificación → false, aunque el código sea válido en todo lo demás', () => {
  const codigo = emitirCodigoComprobante('CN-100001', SECRETO, AHORA) as string;
  assert.equal(verificarCodigoComprobante(codigo, 'CN-100001', undefined, AHORA), false);
});

test('el código de la orden A no verifica para la orden B — otra orden, mismo secreto', () => {
  const codigo = emitirCodigoComprobante('CN-100001', SECRETO, AHORA) as string;
  assert.equal(verificarCodigoComprobante(codigo, 'CN-999999', SECRETO, AHORA), false);
});

test('vencido: justo antes del vencimiento verifica, justo después no', () => {
  const codigo = emitirCodigoComprobante('CN-100001', SECRETO, AHORA) as string;
  const vence = AHORA + VENCIMIENTO_CODIGO_COMPROBANTE_MS;
  assert.equal(verificarCodigoComprobante(codigo, 'CN-100001', SECRETO, vence), true);
  assert.equal(verificarCodigoComprobante(codigo, 'CN-100001', SECRETO, vence + 1), false);
});

test('alterado: cambiar el numero_orden del payload invalida la firma, no sólo el match', () => {
  const codigo = emitirCodigoComprobante('CN-100001', SECRETO, AHORA) as string;
  const [, venceTexto, firma] = codigo.split('.');
  const falsificado = `CN-999999.${venceTexto}.${firma}`;
  // Ni siquiera contra la orden "nueva" que el atacante escribió en el payload — la firma
  // ya no corresponde a esa cadena.
  assert.equal(verificarCodigoComprobante(falsificado, 'CN-999999', SECRETO, AHORA), false);
});

test('alterado: cambiar el vencimiento del payload invalida la firma', () => {
  const codigo = emitirCodigoComprobante('CN-100001', SECRETO, AHORA) as string;
  const [orden, venceTexto, firma] = codigo.split('.');
  const vencimientoEstirado = `${orden}.${Number(venceTexto) + 1_000_000_000}.${firma}`;
  assert.equal(verificarCodigoComprobante(vencimientoEstirado, 'CN-100001', SECRETO, AHORA), false);
});

test('alterado: la firma misma, byte a byte, no verifica', () => {
  const codigo = emitirCodigoComprobante('CN-100001', SECRETO, AHORA) as string;
  const [orden, venceTexto, firma] = codigo.split('.');
  const firmaMutada = firma.slice(0, -1) + (firma.at(-1) === '0' ? '1' : '0');
  assert.equal(verificarCodigoComprobante(`${orden}.${venceTexto}.${firmaMutada}`, 'CN-100001', SECRETO, AHORA), false);
});

test('inventado: una cadena cualquiera, con o sin la forma de tres partes, nunca verifica', () => {
  assert.equal(verificarCodigoComprobante('no-es-un-codigo', 'CN-100001', SECRETO, AHORA), false);
  assert.equal(verificarCodigoComprobante('a.b.c', 'CN-100001', SECRETO, AHORA), false);
  assert.equal(verificarCodigoComprobante('', 'CN-100001', SECRETO, AHORA), false);
});

test('un secreto DISTINTO no puede verificar un código emitido con otro — sin separación de dominio accidental', () => {
  const codigo = emitirCodigoComprobante('CN-100001', SECRETO, AHORA) as string;
  assert.equal(verificarCodigoComprobante(codigo, 'CN-100001', 'otro-secreto-cualquiera', AHORA), false);
});

// ─── admiteComprobanteCliente — el ORDEN de evaluación es la decisión ───────

const ORDEN_OK = { estado: 'pendiente', metodo_pago: 'nequi' };

test('código válido + las tres condiciones restantes → admite', () => {
  assert.deepEqual(admiteComprobanteCliente(ORDEN_OK, true, 0), { ok: true });
});

test('código inválido → codigo_invalido, SIN IMPORTAR el resto del estado', () => {
  // Incluso con la orden en un estado que de otro modo rechazaría por otra razón,
  // el motivo reportado es el de identidad — es el primero que se evalúa.
  const r = admiteComprobanteCliente({ ...ORDEN_OK, estado: 'pagado' }, false, 0);
  assert.deepEqual(r, { ok: false, motivo: 'codigo_invalido' });
});

test('orden pagada (con código válido) → no_pendiente', () => {
  const r = admiteComprobanteCliente({ ...ORDEN_OK, estado: 'pagado' }, true, 0);
  assert.deepEqual(r, { ok: false, motivo: 'no_pendiente' });
});

test('orden cancelada (con código válido) → no_pendiente', () => {
  const r = admiteComprobanteCliente({ ...ORDEN_OK, estado: 'cancelado' }, true, 0);
  assert.deepEqual(r, { ok: false, motivo: 'no_pendiente' });
});

test('método efectivo → metodo_no_admite', () => {
  const r = admiteComprobanteCliente({ ...ORDEN_OK, metodo_pago: 'efectivo' }, true, 0);
  assert.deepEqual(r, { ok: false, motivo: 'metodo_no_admite' });
});

test('método pasarela (\'wompi\') → metodo_no_admite', () => {
  const r = admiteComprobanteCliente({ ...ORDEN_OK, metodo_pago: 'wompi' }, true, 0);
  assert.deepEqual(r, { ok: false, motivo: 'metodo_no_admite' });
});

test('método ausente (null) → metodo_no_admite', () => {
  const r = admiteComprobanteCliente({ ...ORDEN_OK, metodo_pago: null }, true, 0);
  assert.deepEqual(r, { ok: false, motivo: 'metodo_no_admite' });
});

test('al tope exacto → tope_alcanzado; un comprobante menos → admite', () => {
  assert.deepEqual(
    admiteComprobanteCliente(ORDEN_OK, true, TOPE_COMPROBANTES_CLIENTE),
    { ok: false, motivo: 'tope_alcanzado' },
  );
  assert.deepEqual(
    admiteComprobanteCliente(ORDEN_OK, true, TOPE_COMPROBANTES_CLIENTE - 1),
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
