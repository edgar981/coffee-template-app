import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUSINESS_TZ, dayKeyStart, zonedDayKey, startOfZonedDay } from '@duna/core/timezone';
import { elegirEscala, bucketsDelRango, bucketKey, bucketear, MAX_PUNTOS, MIN_PUNTOS } from './bucketeo';

// Capa 1 — puro. Dos reglas duras del eje temporal de la curva: la escalera de TRES
// peldaños con tope de 92 puntos, y el anclaje de la semana al calendario (lunes
// Bogotá). Las dos verificaciones que pidió el diseño se corren SIN el mecanismo
// (fuerza bruta del tope, y el corte que cambia con el `desde` sin el anclaje).

const TZ = BUSINESS_TZ;
const masDias = (key: string, n: number) =>
  zonedDayKey(startOfZonedDay(dayKeyStart(key, TZ), TZ, n), TZ);
// Días absolutos desde epoch de un day key (para emular el bucketeo roto de la maqueta).
const diaAbs = (key: string) => Math.round(dayKeyStart(key, TZ).valueOf() / 86_400_000);
// Meses de calendario entre dos day keys (para afirmar el tope SIN usar el mecanismo).
const mesesEntre = (a: string, b: string) =>
  (Number(b.slice(0, 4)) * 12 + Number(b.slice(5, 7))) - (Number(a.slice(0, 4)) * 12 + Number(a.slice(5, 7)));

test('la escalera de TRES elige el peldaño más fino que quepa en 92', () => {
  assert.equal(elegirEscala('2026-01-01', masDias('2026-01-01', 9)),   'dia');    // 10 días
  assert.equal(elegirEscala('2026-01-01', masDias('2026-01-01', 91)),  'dia');    // 92 días: el tope justo
  assert.equal(elegirEscala('2026-01-01', masDias('2026-01-01', 92)),  'semana'); // 93 días: sube un peldaño
  assert.equal(elegirEscala('2026-01-01', '2027-06-30'),               'semana'); // ~78 semanas
  assert.equal(elegirEscala('2026-01-01', '2030-12-31'),               'mes');    // 60 meses
});

test('si ni el mes cabe en 92 puntos (>7½ años), NO dibuja: tipo "muchas"', () => {
  assert.equal(elegirEscala('2026-01-01', '2040-12-31'), null); // 180 meses
  assert.equal(bucketear('2026-01-01', '2040-12-31').tipo, 'muchas');
});

test('bajo 4 puntos la curva NO dibuja: tipo "pocas" (2–3 no son tendencia)', () => {
  // El OTRO extremo del tope. n === 1 lo consume el gráfico como "recorte activo"
  // (cambia de eje a método); 2–3 son el mensaje de colapso.
  assert.deepEqual(bucketear('2026-08-18', '2026-08-18'), { tipo: 'pocas', n: 1 });
  assert.equal(bucketear('2026-08-18', '2026-08-19').tipo, 'pocas'); // 2 días
  assert.equal(bucketear('2026-08-18', '2026-08-20').tipo, 'pocas'); // 3 días
  assert.equal(bucketear('2026-08-18', '2026-08-21').tipo, 'dibuja'); // 4 días → ya dibuja
});

test('FUERZA BRUTA — ningún rango produce más de 92 puntos; null sólo si ni el mes cabe', () => {
  // Se varía el DÍA DE INICIO (los 7 de la semana) además del span: un span que
  // arranca a mitad de semana toca un bucket MÁS —el borde donde un tope por
  // span-en-días fallaría—, así que el conteo es de buckets TOCADOS, no de días/7.
  const inicios = ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16']; // lun..dom
  const spans = [0, 1, 2, 3, 4, 90, 91, 92, 93, 94, 200, 640, 643, 650, 700, 2000, 2790, 2800, 2850, 2900, 5000, 11000, 20000];
  for (const ini of inicios) {
    for (const span of spans) {
      const hasta = masDias(ini, span);
      const r = bucketear(ini, hasta);
      if (r.tipo === 'muchas') {
        // Sólo puede declarar "muchas" si ni el peldaño más grueso (mes) cabe.
        const meses = mesesEntre(ini, hasta) + 1;
        assert.ok(meses > MAX_PUNTOS, `${ini}..${hasta} dio "muchas" con sólo ${meses} meses`);
      } else if (r.tipo === 'pocas') {
        assert.ok(r.n < MIN_PUNTOS, `${ini}..${hasta} dio "pocas" con ${r.n} puntos`);
      } else {
        assert.ok(r.buckets.length >= MIN_PUNTOS && r.buckets.length <= MAX_PUNTOS,
          `${ini}..${hasta} → ${r.escala} produjo ${r.buckets.length} puntos (fuera de [4,92])`);
        // Contiguos y ordenados: cada bucket empieza donde terminó el anterior.
        for (let i = 1; i < r.buckets.length; i++) {
          assert.equal(+r.buckets[i].inicio, +r.buckets[i - 1].fin, `hueco en ${ini}..${hasta}`);
        }
      }
    }
  }
});

test('semanas de LUNES, con parciales sólo en la primera y la última barra', () => {
  // Rango a mitad de semana (mié 12 ago → mié 30 sep), ~50 días → escala semana.
  const buckets = bucketsDelRango('2026-08-12', '2026-09-30', 'semana');
  assert.ok(buckets.length > 2);
  assert.equal(buckets[0].parcial, true,  'la primera arranca a mitad de semana');
  assert.equal(buckets.at(-1)!.parcial, true, 'la última termina a mitad de semana');
  for (let i = 1; i < buckets.length - 1; i++) {
    assert.equal(buckets[i].parcial, false, `la barra ${i} del medio es una semana completa`);
  }
  // El ancla de la primera es el LUNES anterior (10 ago), no el 12.
  assert.equal(buckets[0].key, '2026-08-10');
});

test('un rango alineado lunes→domingo NO tiene barras parciales', () => {
  const buckets = bucketsDelRango('2026-08-10', '2026-09-27', 'semana'); // lun 10 ago → dom 27 sep
  assert.ok(buckets.length >= 7);
  assert.ok(buckets.every(b => !b.parcial), 'ninguna barra debería ser parcial');
});

test('SIN el anclaje al calendario, dos rangos del mismo período cortan la semana DISTINTO', () => {
  // Un pago el miércoles 12 ago. Dos rangos que lo contienen, con `desde` distinto.
  const fecha = dayKeyStart('2026-08-12', TZ);
  // CON anclaje (bucketKey): la clave NO depende del rango — es el lunes de esa
  // semana, siempre. Ésa es la corrección.
  assert.equal(bucketKey(fecha, 'semana'), '2026-08-10');

  // SIN anclaje (lo que hacía la maqueta: floor((fecha - desde)/7)): el mismo pago
  // cae en índices DISTINTOS según por dónde entró el rango.
  const maqueta = (desde: string) => Math.floor((diaAbs('2026-08-12') - diaAbs(desde)) / 7);
  assert.notEqual(maqueta('2026-08-05'), maqueta('2026-08-08'),
    'el defecto: sin anclaje el corte de la semana cambia con el desde');
});

test('SIN el tope de 92, un rango supera el límite; la escalera lo evita', () => {
  // Forzar 'dia' sobre un rango de 120 días produce 120 puntos — más que el tope.
  const sinTope = bucketsDelRango('2026-01-01', masDias('2026-01-01', 119), 'dia');
  assert.equal(sinTope.length, 120);
  assert.ok(sinTope.length > MAX_PUNTOS, 'sin escalón, 120 puntos > 92');

  // Con la escalera, ese mismo rango sube a semana y queda en ≤92.
  const r = bucketear('2026-01-01', masDias('2026-01-01', 119));
  assert.equal(r.tipo, 'dibuja');
  if (r.tipo === 'dibuja') {
    assert.equal(r.escala, 'semana');
    assert.ok(r.buckets.length <= MAX_PUNTOS);
  }
});

test('bucketKey coincide con la escala en cada peldaño', () => {
  const f = dayKeyStart('2026-08-12', TZ); // miércoles
  assert.equal(bucketKey(f, 'dia'),    '2026-08-12');
  assert.equal(bucketKey(f, 'semana'), '2026-08-10');      // lunes
  assert.equal(bucketKey(f, 'mes'),    '2026-08');
});
