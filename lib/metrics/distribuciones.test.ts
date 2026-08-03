import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  plegarDistribuciones, plegarMetodosPago, formatPeso, aPorcentajes,
  type DistribucionRow, type MetodoPagoRow,
} from './distribuciones';

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

// ─── Vista por método de pago (base distinta: Payment.monto) ──────────────────

test('los métodos se pintan con su label humano, nunca el valor del enum', () => {
  const rows: MetodoPagoRow[] = [
    { metodo: 'DAVIPLATA', total: 600 },
    { metodo: 'TRANSFERENCIA', total: 400 },
  ];
  assert.deepEqual(plegarMetodosPago(rows), [
    { name: 'Daviplata',     value: 60 },
    { name: 'Transferencia', value: 40 },
  ]);
});

test('un pago sin método cae en "Sin especificar" (no se pierde plata del reparto)', () => {
  const rows: MetodoPagoRow[] = [
    { metodo: 'EFECTIVO', total: 750 },
    { metodo: null,       total: 250 },
  ];
  assert.deepEqual(plegarMetodosPago(rows), [
    { name: 'Efectivo',        value: 75 },
    { name: 'Sin especificar', value: 25 },
  ]);
});

test('un método desconocido (enum ampliado sin actualizar el mapa) se muestra crudo, no se descarta', () => {
  const rows: MetodoPagoRow[] = [
    { metodo: 'EFECTIVO', total: 500 },
    { metodo: 'CRIPTO',   total: 500 },
  ];
  const r = plegarMetodosPago(rows);
  assert.equal(r.length, 2);
  assert.ok(r.some(x => x.name === 'CRIPTO'));
});

test('sin pagos → vista vacía', () => {
  assert.deepEqual(plegarMetodosPago([]), []);
});

test('los métodos suman ~100', () => {
  const rows: MetodoPagoRow[] = [
    { metodo: 'DAVIPLATA', total: 1094000 },
    { metodo: 'TRANSFERENCIA', total: 1041000 },
    { metodo: 'EFECTIVO', total: 909000 },
    { metodo: 'NEQUI', total: 788000 },
  ];
  const suma = plegarMetodosPago(rows).reduce((s, x) => s + x.value, 0);
  assert.ok(Math.abs(suma - 100) <= 1, `suma ${suma}`);
});
