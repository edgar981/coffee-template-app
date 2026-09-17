import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  construirPayloadNavegador3ds, clasificarAutenticacion3ds, esperaSondeoSiguienteMs,
  BACKOFF_SONDEO_SEGUNDOS, TECHO_SONDEO_MS,
} from './tres-ds';

// ── `construirPayloadNavegador3ds` — el mapeo a los nombres del WIRE (§ la cabecera del
// archivo: NO MEDIDOS CONTRA EL SANDBOX, LEÍDOS) ──────────────────────────────────────────────

test('construirPayloadNavegador3ds: mapea los siete campos a snake_case, sin perder ni inventar ninguno', () => {
  const payload = construirPayloadNavegador3ds({
    colorDepth: 24,
    javaEnabled: false,
    language: 'es-CO',
    screenHeight: 900,
    screenWidth: 1440,
    timezoneOffsetMin: 300,
    userAgent: 'Mozilla/5.0 (test)',
  });
  assert.deepEqual(payload, {
    browser_color_depth: '24',
    browser_java_enabled: false,
    browser_language: 'es-CO',
    browser_screen_height: 900,
    browser_screen_width: 1440,
    browser_tz: 300,
    browser_user_agent: 'Mozilla/5.0 (test)',
  });
});

test('construirPayloadNavegador3ds: NUNCA incluye un campo de tarjeta — la lista de claves es exactamente la del navegador', () => {
  const payload = construirPayloadNavegador3ds({
    colorDepth: 24, javaEnabled: true, language: 'es-CO', screenHeight: 800, screenWidth: 600,
    timezoneOffsetMin: 300, userAgent: 'ua',
  });
  const claves = Object.keys(payload).sort();
  assert.deepEqual(claves, [
    'browser_color_depth', 'browser_java_enabled', 'browser_language', 'browser_screen_height',
    'browser_screen_width', 'browser_tz', 'browser_user_agent',
  ]);
});

// ── `clasificarAutenticacion3ds` — el resultado SIN FRICCIÓN se reconoce, y el caso de
// DESAFÍO se distingue del sin fricción (§ el reporte del slice, la verificación pedida) ────────

test('sin sub-objeto `three_ds_auth` → desconocido, nunca se inventa un veredicto', () => {
  assert.equal(clasificarAutenticacion3ds({}), 'desconocido');
  assert.equal(clasificarAutenticacion3ds({ payment_method: {} }), 'desconocido');
  assert.equal(clasificarAutenticacion3ds({ payment_method: { extra: {} } }), 'desconocido');
});

test('current_step_status "APPROVED" → sin_friccion (el emisor autenticó sin pedirle nada al comprador)', () => {
  const r = clasificarAutenticacion3ds({
    payment_method: { extra: { three_ds_auth: { current_step: 'AUTHENTICATION', current_step_status: 'APPROVED' } } },
  });
  assert.equal(r, 'sin_friccion');
});

test('current_step_status "PENDING" → desafio, DISTINTO de sin_friccion — el caso que este slice NO resuelve', () => {
  const r = clasificarAutenticacion3ds({
    payment_method: { extra: { three_ds_auth: { current_step: 'AUTHENTICATION', current_step_status: 'PENDING' } } },
  });
  assert.equal(r, 'desafio');
  assert.notEqual(r, 'sin_friccion');
});

test('un current_step_status irreconocible → desconocido, no se fuerza a uno de los dos casos conocidos', () => {
  const r = clasificarAutenticacion3ds({
    payment_method: { extra: { three_ds_auth: { current_step: 'AUTHENTICATION', current_step_status: 'ERROR' } } },
  });
  assert.equal(r, 'desconocido');
});

// ── El sondeo — MISMA política que `RetornoCliente.tsx` (§ la cabecera del archivo) ─────────

test('BACKOFF_SONDEO_SEGUNDOS y TECHO_SONDEO_MS son los MISMOS valores que RetornoCliente.tsx (2,4,8,16,30s; techo 5 min)', () => {
  assert.deepEqual(BACKOFF_SONDEO_SEGUNDOS, [2, 4, 8, 16, 30]);
  assert.equal(TECHO_SONDEO_MS, 5 * 60 * 1000);
});

test('esperaSondeoSiguienteMs: recorre el backoff en orden, en milisegundos', () => {
  assert.equal(esperaSondeoSiguienteMs(0), 2000);
  assert.equal(esperaSondeoSiguienteMs(1), 4000);
  assert.equal(esperaSondeoSiguienteMs(2), 8000);
  assert.equal(esperaSondeoSiguienteMs(3), 16000);
  assert.equal(esperaSondeoSiguienteMs(4), 30000);
});

test('esperaSondeoSiguienteMs: más allá del último tramo, se queda en el último valor (30s de ahí en más)', () => {
  assert.equal(esperaSondeoSiguienteMs(5), 30000);
  assert.equal(esperaSondeoSiguienteMs(50), 30000);
});
