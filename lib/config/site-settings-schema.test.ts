import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siteSettingsEditableSchema } from './site-settings-schema';

// Capa 1 — puro. Afirma el refine de `metodosPago` que cambió con § PAGOS-VARIAS-CUENTAS-1: los
// cuatro tipos singleton siguen prohibiendo repetirse, y `transferencia` es la ÚNICA excepción —
// el negocio puede tener varias cuentas. No repite la cobertura de `metodos-pasarela.test.ts`
// (los refines de `metodosPasarela`) ni la de otros campos de este schema.

function payload(metodosPago: { tipo: string; datos: Record<string, string> }[]) {
  return {
    nombre: 'x', tagline: 'x', descripcionFooter: 'x', whatsapp: '+573000000000', instagram: 'x',
    emailRemitente: 'a@b.com', metodosPago, metodosPasarela: [], redes: [],
  };
}

const nequi = (numero = '1') => ({ tipo: 'nequi', datos: { numero } });
const transferencia = (id: string, over: Partial<Record<'banco' | 'tipoCuenta' | 'numeroCuenta' | 'titular', string>> = {}) => ({
  tipo: 'transferencia',
  datos: { id, banco: 'Bancolombia', tipoCuenta: 'Ahorros', numeroCuenta: '123', titular: 'Nayoli', ...over },
});

test('una lista sana (un medio por tipo) se acepta', () => {
  const parsed = siteSettingsEditableSchema.safeParse(payload([nequi(), transferencia('a')]));
  assert.equal(parsed.success, true);
});

test('lista VACÍA sigue rechazada — regla sin cambio', () => {
  const parsed = siteSettingsEditableSchema.safeParse(payload([]));
  assert.equal(parsed.success, false);
});

test('repetir un tipo SINGLETON (nequi) sigue rechazado', () => {
  const parsed = siteSettingsEditableSchema.safeParse(payload([nequi('1'), nequi('2')]));
  assert.equal(parsed.success, false);
  assert.equal(parsed.error?.issues[0]?.message, 'No puedes repetir un método de pago');
});

test('repetir daviplata/breb/efectivo sigue rechazado — la excepción es SOLO transferencia', () => {
  for (const tipo of ['daviplata', 'breb', 'efectivo']) {
    const parsed = siteSettingsEditableSchema.safeParse(payload([
      { tipo, datos: {} }, { tipo, datos: {} },
    ]));
    assert.equal(parsed.success, false, `${tipo} repetido debería rechazarse`);
  }
});

// ── § PAGOS-VARIAS-CUENTAS-1 ──────────────────────────────────────────────────────────────────

test('DOS cuentas de transferencia se ACEPTAN', () => {
  const parsed = siteSettingsEditableSchema.safeParse(payload([
    transferencia('a', { banco: 'Bancolombia' }),
    transferencia('b', { banco: 'Davivienda' }),
  ]));
  assert.equal(parsed.success, true);
});

test('TRES cuentas de transferencia se ACEPTAN — no hay tope en el schema', () => {
  const parsed = siteSettingsEditableSchema.safeParse(payload([
    transferencia('a'), transferencia('b'), transferencia('c'),
  ]));
  assert.equal(parsed.success, true);
});

test('varias transferencias conviven con UN nequi — sólo transferencia puede repetirse', () => {
  const parsed = siteSettingsEditableSchema.safeParse(payload([
    nequi('1'), transferencia('a'), transferencia('b'),
  ]));
  assert.equal(parsed.success, true);
});

test('varias transferencias NO disfrazan un nequi repetido — el refine sigue viendo el resto', () => {
  const parsed = siteSettingsEditableSchema.safeParse(payload([
    nequi('1'), nequi('2'), transferencia('a'), transferencia('b'),
  ]));
  assert.equal(parsed.success, false);
  assert.equal(parsed.error?.issues[0]?.message, 'No puedes repetir un método de pago');
});
