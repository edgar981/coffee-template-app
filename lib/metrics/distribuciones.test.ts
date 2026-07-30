import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plegarDistribuciones, formatPeso, aPorcentajes, type DistribucionRow } from './distribuciones';

// Los buckets residuales del pie. Se testean aquí porque la base de desarrollo NO
// los ejercita (hoy: 0 productos sin peso) — sin estos tests, "producto sin peso
// → Otros" y el formato en kg serían afirmaciones sin verificar.
//
// La vista por molienda se retiró (decisión de producto), y con ella su test del
// bucket "Grano entero". El resto de la cobertura es de la vista Peso y de
// Categoría: no se toca.

test('formatPeso: gramos hasta 999, kg desde 1000', () => {
  assert.equal(formatPeso(250), '250 g');
  assert.equal(formatPeso(500), '500 g');
  assert.equal(formatPeso(999), '999 g');
  assert.equal(formatPeso(1000), '1 kg');
  assert.equal(formatPeso(1500), '1.5 kg');
  assert.equal(formatPeso(2000), '2 kg');
});

test('producto sin peso cae en "Otros" (no se descarta del reparto)', () => {
  const rows: DistribucionRow[] = [
    { categoria: 'caja_regalo', peso: null, total: 250 },
    { categoria: 'cafe_grano',  peso: 250,  total: 750 },
  ];
  const { peso } = plegarDistribuciones(rows);
  assert.deepEqual(peso, [
    { name: '250 g', value: 75 },
    { name: 'Otros', value: 25 },
  ]);
});

test('categoría null se DESCARTA de su vista pero no de la de peso', () => {
  const rows: DistribucionRow[] = [
    { categoria: null,         peso: 250, total: 500 },
    { categoria: 'cafe_grano', peso: 500, total: 500 },
  ];
  const d = plegarDistribuciones(rows);
  // Categoría reparte solo lo atribuible → un bucket al 100%.
  assert.deepEqual(d.categoria, [{ name: 'Café Grano', value: 100 }]);
  // Peso sí reparte las dos filas.
  assert.equal(d.peso.length, 2);
});

test('las dos vistas suman ~100 con datos reales de forma mixta', () => {
  const rows: DistribucionRow[] = [
    { categoria: 'cafe_grano',  peso: 500,  total: 2190000 },
    { categoria: 'cafe_molido', peso: 250,  total: 1100000 },
    { categoria: 'cafe_molido', peso: 500,  total: 750000  },
    { categoria: null,          peso: null, total: 200000  },
  ];
  const d = plegarDistribuciones(rows);
  for (const vista of [d.categoria, d.peso]) {
    const suma = vista.reduce((s, x) => s + x.value, 0);
    assert.ok(Math.abs(suma - 100) <= 1, `la vista suma ${suma}`);
  }
});

test('sin filas → dos vistas vacías (no NaN ni división por cero)', () => {
  assert.deepEqual(plegarDistribuciones([]), { categoria: [], peso: [] });
  assert.deepEqual(aPorcentajes(new Map()), []);
});

test('totales en 0 no producen porcentajes', () => {
  assert.deepEqual(aPorcentajes(new Map([['a', 0], ['b', 0]])), []);
});
