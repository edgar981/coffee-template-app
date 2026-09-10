import { test } from 'node:test';
import assert from 'node:assert/strict';
import { derivarCondicionPago } from '@duna/core/orders';
import {
  parseMetodosPago, metodosDisponibles, metodoIncompleto,
  type MetodoPagoGuardado,
} from './metodos-pago';

const nequi = (numero: string): MetodoPagoGuardado => ({ tipo: 'nequi', datos: { numero } });
const daviplata = (numero: string): MetodoPagoGuardado => ({ tipo: 'daviplata', datos: { numero } });
const breb = (llave: string): MetodoPagoGuardado => ({ tipo: 'breb', datos: { llave } });
const transferencia = (over: Partial<Record<'banco' | 'tipoCuenta' | 'numeroCuenta' | 'titular', string>> = {}): MetodoPagoGuardado => ({
  tipo: 'transferencia',
  datos: { banco: 'Bancolombia', tipoCuenta: 'Ahorros', numeroCuenta: '123', titular: 'Nayoli', ...over },
});
const efectivo: MetodoPagoGuardado = { tipo: 'efectivo', datos: {} };

// Nayoli tras el backfill: los 4 de siempre, número móvil puesto, sin cuenta bancaria.
const NAYOLI: MetodoPagoGuardado[] = [
  nequi('+573155766064'), daviplata('+573155766064'), transferencia({ banco: '', tipoCuenta: '', numeroCuenta: '', titular: '' }), efectivo,
];

// ── parseMetodosPago — SOFT, nunca lanza ──────────────────────────────────────────────────────

test('parseMetodosPago: no-array (basura, null, objeto) → lista vacía, nunca lanza', () => {
  assert.deepEqual(parseMetodosPago(null), []);
  assert.deepEqual(parseMetodosPago(undefined), []);
  assert.deepEqual(parseMetodosPago('no soy un array'), []);
  assert.deepEqual(parseMetodosPago({ tipo: 'nequi' }), []);
  assert.deepEqual(parseMetodosPago(42), []);
});

test('parseMetodosPago: descarta ítems basura dentro del array (no objeto, sin tipo, tipo desconocido)', () => {
  const out = parseMetodosPago([null, 'x', 42, { sinTipo: true }, { tipo: 'wompi', datos: {} }, nequi('123')]);
  assert.deepEqual(out.map(m => m.tipo), ['nequi']);
});

test('parseMetodosPago: un tipo REPETIDO se queda con el PRIMERO', () => {
  const out = parseMetodosPago([nequi('111'), nequi('222')]);
  assert.equal(out.length, 1);
  assert.equal(out[0].datos.numero, '111');
});

test('parseMetodosPago: siempre devuelve el ORDEN CANÓNICO, sin importar el orden de guardado', () => {
  const revuelto = [efectivo, transferencia(), nequi('1'), breb('llave@x'), daviplata('2')];
  const out = parseMetodosPago(revuelto);
  assert.deepEqual(out.map(m => m.tipo), ['nequi', 'daviplata', 'breb', 'transferencia', 'efectivo']);
});

test('parseMetodosPago: normaliza valores no-string de `datos` a cadena', () => {
  const out = parseMetodosPago([{ tipo: 'nequi', datos: { numero: 573155766064 } }]);
  assert.equal(out[0].datos.numero, '573155766064');
});

// ── metodosDisponibles ────────────────────────────────────────────────────────────────────────

test('Nayoli en Bogotá: nequi + daviplata + efectivo (transferencia oculta sin cuenta)', () => {
  const m = metodosDisponibles(NAYOLI, { isBogota: true });
  assert.deepEqual(m.map(x => x.id), ['nequi', 'daviplata', 'efectivo']);
  assert.match(m[0].desc, /Enviar a /);
});

test('fuera de Bogotá: efectivo desaparece', () => {
  const m = metodosDisponibles(NAYOLI, { isBogota: false });
  assert.deepEqual(m.map(x => x.id), ['nequi', 'daviplata']);
});

test('quitar un método de la lista lo saca del checkout', () => {
  const sinNequi = NAYOLI.filter(m => m.tipo !== 'nequi');
  const m = metodosDisponibles(sinNequi, { isBogota: true });
  assert.deepEqual(m.map(x => x.id), ['daviplata', 'efectivo']);
});

test('un método en la lista SIN sus datos no aparece', () => {
  const m = metodosDisponibles([nequi('')], { isBogota: true });
  assert.deepEqual(m, []);
});

test('Nequi y Daviplata con números DISTINTOS aparecen con instrucciones distintas', () => {
  const metodos = [nequi('+573100000001'), daviplata('+573200000002')];
  const m = metodosDisponibles(metodos, { isBogota: true });
  assert.equal(m.length, 2);
  const [n, d] = m;
  assert.notEqual(n.desc, d.desc);
  assert.match(n.desc, /310 000 0001/);
  assert.match(d.desc, /320 000 0002/);
});

test('transferencia con cuenta completa → se muestra con su línea', () => {
  const m = metodosDisponibles([transferencia()], { isBogota: true });
  assert.equal(m.length, 1);
  assert.equal(m[0].desc, 'Bancolombia · Ahorros · 123 · Nayoli');
});

test('Bre-B con llave → se muestra; sin llave, no', () => {
  const con = metodosDisponibles([breb('correo@negocio.com')], { isBogota: true });
  assert.equal(con.length, 1);
  assert.equal(con[0].label, 'Bre-B');
  assert.match(con[0].desc, /correo@negocio\.com/);

  const sin = metodosDisponibles([breb('')], { isBogota: true });
  assert.deepEqual(sin, []);
});

test('efectivo sólo con isBogota: true', () => {
  assert.deepEqual(metodosDisponibles([efectivo], { isBogota: true }).map(x => x.id), ['efectivo']);
  assert.deepEqual(metodosDisponibles([efectivo], { isBogota: false }), []);
});

test('lista vacía → checkout sin opciones (guarda defensiva del checkout)', () => {
  assert.deepEqual(metodosDisponibles([], { isBogota: true }), []);
});

// ── metodoIncompleto ──────────────────────────────────────────────────────────────────────────

test('metodoIncompleto: null cuando el método tiene sus datos', () => {
  assert.equal(metodoIncompleto(nequi('+573155766064')), null);
  assert.equal(metodoIncompleto(transferencia()), null);
  assert.equal(metodoIncompleto(efectivo), null); // nada que configurar
  assert.equal(metodoIncompleto(breb('llave')), null);
});

test('metodoIncompleto: la frase "Falta …" cuando faltan los datos', () => {
  assert.equal(metodoIncompleto(nequi('')), 'Falta el número');
  assert.equal(metodoIncompleto(daviplata('')), 'Falta el número');
  assert.equal(metodoIncompleto(breb('')), 'Falta la llave');
  assert.equal(metodoIncompleto(transferencia({ banco: '' })), 'Falta la cuenta');
});

// ── El guardián de §1.1: el id de efectivo es la cadena EXACTA 'efectivo' ────────────────────
// `derivarCondicionPago` (packages/core/src/orders.ts) compara contra 'EFECTIVO' en mayúsculas
// para decidir CONTRAENTREGA vs ANTICIPADO. Si el id cambiara, la orden nacería ANTICIPADO y el
// modelo de cobro se rompería EN SILENCIO — sin error, sin test rojo. Éste es ese test: no
// existía ninguno que ejerciera `derivarCondicionPago` antes de esta tanda.

test('§1.1 — el id de efectivo sigue siendo la cadena "efectivo", y deriva CONTRAENTREGA', () => {
  const [op] = metodosDisponibles([efectivo], { isBogota: true });
  assert.equal(op.id, 'efectivo');
  assert.equal(derivarCondicionPago(op.id), 'CONTRAENTREGA');
});

test('§1.1 — cualquier otro método deriva ANTICIPADO', () => {
  assert.equal(derivarCondicionPago('nequi'), 'ANTICIPADO');
  assert.equal(derivarCondicionPago('breb'), 'ANTICIPADO');
});
