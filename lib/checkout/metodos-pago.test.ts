import { test } from 'node:test';
import assert from 'node:assert/strict';
import { metodosDisponibles, estadoMetodoEditor, type SettingsMetodos } from './metodos-pago';

// Nayoli tras el backfill: los 4 ON, número móvil puesto, sin cuenta bancaria.
const NAYOLI: SettingsMetodos = {
  bancoNombre: null, bancoTipoCuenta: null, bancoNumeroCuenta: null, bancoTitular: null,
  pagoNequiActivo: true, pagoDaviplataActivo: true, pagoTransferenciaActivo: true, pagoEfectivoActivo: true,
  pagoMovilNumero: '+573155766064',
};

test('Nayoli en Bogotá: nequi + daviplata + efectivo (transferencia oculta sin cuenta)', () => {
  const m = metodosDisponibles(NAYOLI, { isBogota: true });
  assert.deepEqual(m.map(x => x.id), ['nequi', 'daviplata', 'efectivo']);
  assert.match(m[0].desc, /Enviar a /); // el número, formateado
});

test('fuera de Bogotá: efectivo desaparece', () => {
  const m = metodosDisponibles(NAYOLI, { isBogota: false });
  assert.deepEqual(m.map(x => x.id), ['nequi', 'daviplata']);
});

test('apagar un método lo saca de la lista', () => {
  const m = metodosDisponibles({ ...NAYOLI, pagoNequiActivo: false }, { isBogota: true });
  assert.deepEqual(m.map(x => x.id), ['daviplata', 'efectivo']);
});

test('nequi ON pero sin número móvil → no se muestra', () => {
  const m = metodosDisponibles({ ...NAYOLI, pagoMovilNumero: '' }, { isBogota: true });
  assert.deepEqual(m.map(x => x.id), ['efectivo']); // sin número: ni nequi ni daviplata
});

test('transferencia ON con cuenta completa → se muestra con su línea', () => {
  const con = { ...NAYOLI, bancoNombre: 'Bancolombia', bancoTipoCuenta: 'Ahorros', bancoNumeroCuenta: '123', bancoTitular: 'Nayoli' };
  const m = metodosDisponibles(con, { isBogota: true });
  assert.deepEqual(m.map(x => x.id), ['nequi', 'daviplata', 'transferencia', 'efectivo']);
  assert.equal(m.find(x => x.id === 'transferencia')!.desc, 'Bancolombia · Ahorros · 123 · Nayoli');
});

test('todos apagados → lista vacía (el checkout usa su guarda defensiva)', () => {
  const off = { ...NAYOLI, pagoNequiActivo: false, pagoDaviplataActivo: false, pagoTransferenciaActivo: false, pagoEfectivoActivo: false };
  assert.deepEqual(metodosDisponibles(off, { isBogota: true }), []);
});

test('estadoMetodoEditor: apagado / activo_sin_datos / activo', () => {
  // Apagado
  assert.equal(estadoMetodoEditor({ ...NAYOLI, pagoNequiActivo: false }, 'nequi'), 'apagado');
  // ON con número → activo
  assert.equal(estadoMetodoEditor(NAYOLI, 'nequi'), 'activo');
  // ON sin número → activo_sin_datos (el caso que el editor hace visible)
  assert.equal(estadoMetodoEditor({ ...NAYOLI, pagoMovilNumero: '' }, 'daviplata'), 'activo_sin_datos');
  // Transferencia ON sin cuenta → activo_sin_datos; con cuenta → activo
  assert.equal(estadoMetodoEditor(NAYOLI, 'transferencia'), 'activo_sin_datos');
  assert.equal(estadoMetodoEditor({ ...NAYOLI, bancoNombre: 'B', bancoTipoCuenta: 'A', bancoNumeroCuenta: '1' }, 'transferencia'), 'activo');
  // Efectivo ON → activo (no tiene datos que configurar)
  assert.equal(estadoMetodoEditor(NAYOLI, 'efectivo'), 'activo');
});
