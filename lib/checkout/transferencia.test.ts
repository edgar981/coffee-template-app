import { test } from 'node:test';
import assert from 'node:assert/strict';
import { opcionTransferencia } from './transferencia';

const COMPLETA = {
  bancoNombre: 'Bancolombia',
  bancoTipoCuenta: 'Ahorros',
  bancoNumeroCuenta: '123-456789-00',
  bancoTitular: 'Nayoli SAS',
};

test('cuenta VACÍA → null (el método no se muestra)', () => {
  assert.equal(opcionTransferencia({ bancoNombre: null, bancoTipoCuenta: null, bancoNumeroCuenta: null, bancoTitular: null }), null);
  assert.equal(opcionTransferencia({ bancoNombre: '', bancoTipoCuenta: '', bancoNumeroCuenta: '', bancoTitular: '' }), null);
});

test('falta UN esencial → null (no a medias)', () => {
  assert.equal(opcionTransferencia({ ...COMPLETA, bancoNombre: '' }), null);
  assert.equal(opcionTransferencia({ ...COMPLETA, bancoTipoCuenta: '   ' }), null); // sólo espacios
  assert.equal(opcionTransferencia({ ...COMPLETA, bancoNumeroCuenta: null }), null);
});

test('los tres esenciales presentes → se muestra, con su línea', () => {
  const o = opcionTransferencia(COMPLETA);
  assert.ok(o);
  assert.equal(o!.desc, 'Bancolombia · Ahorros · 123-456789-00 · Nayoli SAS');
});

test('titular OPCIONAL: sin titular igual se muestra, sin esa línea', () => {
  const o = opcionTransferencia({ ...COMPLETA, bancoTitular: '' });
  assert.ok(o);
  assert.equal(o!.titular, null);
  assert.equal(o!.desc, 'Bancolombia · Ahorros · 123-456789-00'); // sin el titular
});
