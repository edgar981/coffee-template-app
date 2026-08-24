import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bucketsPorHora, curvaDibuja, HORAS_DIA, ventanaCurvaHoy } from './hoy';

test('bucketsPorHora rellena las 24 horas: un hueco es un 0 real, no un undefined', () => {
  const b = bucketsPorHora([{ hora: 9, n: 3 }, { hora: 14, n: 1 }]);
  assert.equal(b.length, HORAS_DIA);
  assert.equal(b[9], 3);
  assert.equal(b[14], 1);
  assert.equal(b[0], 0, 'la medianoche sin pedidos es 0');
  assert.equal(b[23], 0);
  assert.ok(b.every(n => typeof n === 'number'), 'ningún hueco queda undefined');
});

test('el orden de las filas no importa: cada conteo cae en SU hora', () => {
  const b = bucketsPorHora([{ hora: 23, n: 5 }, { hora: 0, n: 2 }, { hora: 12, n: 4 }]);
  assert.equal(b[0], 2);
  assert.equal(b[12], 4);
  assert.equal(b[23], 5);
});

test('una hora fuera de rango no desborda ni desplaza el resto', () => {
  const b = bucketsPorHora([{ hora: 10, n: 7 }, { hora: 24, n: 99 }, { hora: -1, n: 99 }]);
  assert.equal(b.length, HORAS_DIA);
  assert.equal(b[10], 7);
  assert.equal(b.reduce((s, n) => s + n, 0), 7, 'las horas inválidas se ignoran');
});

test('curvaDibuja: con al menos un pedido, dibuja', () => {
  assert.equal(curvaDibuja(bucketsPorHora([{ hora: 8, n: 1 }])), true);
});

test('curvaDibuja: DÍA SIN PEDIDOS declara, no dibuja — buckets todos en 0', () => {
  assert.equal(curvaDibuja(bucketsPorHora([])), false);
  assert.equal(curvaDibuja(new Array(HORAS_DIA).fill(0)), false);
});

// LA VENTANA DEL EJE. Candado de un comportamiento CORRECTO (no rojo-primero): la
// primera actividad se lee sobre los 24 buckets del DÍA, así que el borde izquierdo
// nunca pasa esa hora y ningún pedido queda fuera. `conActividad` arma los 24 con un
// conteo en cada hora pedida — el input es SIEMPRE el día completo, que es el contrato.
const conActividad = (...horas: number[]) => {
  const b = new Array<number>(HORAS_DIA).fill(0);
  for (const h of horas) b[h] = 3;
  return b;
};

test('ventana: pa 8, ahora 10 → [4..10] (el span mínimo rellena hacia atrás)', () => {
  const { inicioEje, horaFin } = ventanaCurvaHoy(conActividad(8), 10);
  assert.deepEqual([inicioEje, horaFin], [4, 10]);
});

test('ventana: pa 8, ahora 14 → [8..14] (borde izq = primera actividad, no recorta)', () => {
  const { inicioEje, horaFin } = ventanaCurvaHoy(conActividad(8), 14);
  assert.deepEqual([inicioEje, horaFin], [8, 14]);
});

test('ventana: pa 8, ahora 15 → [8..15] (no salta a 9 — no es ahora−6 crudo)', () => {
  const { inicioEje, horaFin } = ventanaCurvaHoy(conActividad(8), 15);
  assert.deepEqual([inicioEje, horaFin], [8, 15]);
});

test('ventana: pa 8, ahora 20 → [8..20] — el pedido de las 8 SIGUE visible', () => {
  // EL caso que atrapa la realimentación: si `primeraActividad` se leyera sobre la
  // ventana recortada en vez de los 24 del día, findIndex sobre [14..20] no vería el
  // pedido de las 8 y el eje daría [14..20], escondiéndolo. Con los 24, ve la hora 8.
  const { inicioEje, horaFin } = ventanaCurvaHoy(conActividad(8), 20);
  assert.deepEqual([inicioEje, horaFin], [8, 20]);
});

test('ventana: primera actividad 1 a.m., ahora 15 → [1..15] (la madrugada se ve)', () => {
  const { inicioEje, horaFin } = ventanaCurvaHoy(conActividad(1), 15);
  assert.deepEqual([inicioEje, horaFin], [1, 15]);
});

test('ventana: 00:30 con un pedido en la hora 0 → [0..0], n=1 (marcador solo)', () => {
  const { inicioEje, horaFin, n } = ventanaCurvaHoy(conActividad(0), 0);
  assert.deepEqual([inicioEje, horaFin, n], [0, 0, 1]);
});

test('ventana: el borde izquierdo NUNCA pasa la primera actividad (invariante)', () => {
  for (const pa of [1, 8, 18]) {
    for (let ahora = pa; ahora < HORAS_DIA; ahora++) {
      const { inicioEje } = ventanaCurvaHoy(conActividad(pa), ahora);
      assert.ok(inicioEje <= pa, `pa=${pa} ahora=${ahora}: inicioEje ${inicioEje} > ${pa}`);
    }
  }
});
