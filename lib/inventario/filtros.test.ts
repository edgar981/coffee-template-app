import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  porReponer, agotados, CARRILES_INVENTARIO, aplicarCarril,
  carrilPorKey, conteosInventario, CARRIL_INVENTARIO_DEFAULT,
} from './filtros';

// Capa 1 — puro, sin base. Afirma que la cola de reposición consume `isLowStock`
// (la fuente única) y que la contención Agotados ⊂ Por reponer es del código.

const P = (stock: number, extra: Partial<{ stock_minimo: number; activo: boolean }> = {}) => ({
  stock, stock_minimo: extra.stock_minimo ?? 5, activo: extra.activo ?? true,
});

test('Por reponer = at/below mínimo, y excluye inactivos (isLowStock)', () => {
  assert.equal(porReponer(P(3)), true);          // 3 <= 5
  assert.equal(porReponer(P(5)), true);          // en el mínimo
  assert.equal(porReponer(P(6)), false);         // por encima
  assert.equal(porReponer(P(0, { activo: false })), false); // inactivo no es reposición
});

test('Agotados ⊂ Por reponer, por construcción', () => {
  assert.equal(agotados(P(0)), true);
  assert.equal(agotados(P(3)), false);           // bajo pero no en cero
  // La contención: todo agotado es también por-reponer.
  for (const p of [P(0), P(0, { stock_minimo: 1 })]) {
    if (agotados(p)) assert.equal(porReponer(p), true, 'un agotado que no es por-reponer rompe la contención');
  }
});

test('un inactivo en CERO no es agotado — el trato de activo no diverge', () => {
  // Si `agotados` usara `p.stock === 0` suelto, esto sería true y la contención
  // se rompería (no estaría en Por reponer). Al derivarse de isLowStock, no.
  assert.equal(agotados(P(0, { activo: false })), false);
  assert.equal(porReponer(P(0, { activo: false })), false);
});

test('los dos carriles son COLA — los dos llevan número', () => {
  assert.ok(CARRILES_INVENTARIO.every(c => c.tipo === 'cola'));
  const lista = [P(0), P(3), P(6), P(10)];   // 1 agotado, 2 por-reponer, 4 total
  const cuentas = conteosInventario(lista);
  assert.equal(cuentas.reponer, 2);          // stock 0 y 3
  assert.equal(cuentas.agotados, 1);         // sólo el 0
});

test('aplicarCarril filtra; una key basura no se cae al default en silencio', () => {
  const lista = [P(0), P(3), P(6)];
  assert.equal(aplicarCarril(lista, 'reponer').length, 2);
  assert.equal(aplicarCarril(lista, 'agotados').length, 1);
  assert.equal(carrilPorKey('inventado'), null);
  assert.equal(carrilPorKey(CARRIL_INVENTARIO_DEFAULT)?.key, 'reponer');
});
