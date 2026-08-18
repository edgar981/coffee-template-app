import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUSINESS_TZ, dayKeyStart, zonedDayKey, startOfZonedDay } from '@duna/core/timezone';
import { elegirEscala, bucketsDelRango, bucketKey, bucketear, MAX_BARRAS, MIN_BARRAS } from './bucketeo';

// Capa 1 — puro. Dos reglas duras del eje temporal del strip: la escalera con tope
// de 31 barras, y el anclaje de la semana al calendario (lunes Bogotá). Las dos
// verificaciones que pidió el diseño se corren SIN el mecanismo (fuerza bruta del
// tope, y el corte que cambia con el `desde` sin el anclaje).

const TZ = BUSINESS_TZ;
const masDias = (key: string, n: number) =>
  zonedDayKey(startOfZonedDay(dayKeyStart(key, TZ), TZ, n), TZ);
// Días absolutos desde epoch de un day key (para emular el bucketeo roto de la maqueta).
const diaAbs = (key: string) => Math.round(dayKeyStart(key, TZ).valueOf() / 86_400_000);
const anioDe = (key: string) => Number(key.slice(0, 4));

test('la escalera elige el peldaño más fino que quepa en 31', () => {
  assert.equal(elegirEscala('2026-01-01', masDias('2026-01-01', 9)),   'dia');       // 10 días
  assert.equal(elegirEscala('2026-01-01', masDias('2026-01-01', 59)),  'semana');    // 60 días
  assert.equal(elegirEscala('2026-01-01', '2027-12-31'),               'mes');       // 24 meses
  assert.equal(elegirEscala('2026-01-01', '2030-12-31'),               'trimestre'); // 20 trimestres
  assert.equal(elegirEscala('2026-01-01', '2045-12-31'),               'anio');      // 20 años
});

test('si ni el año cabe en 31 barras (>31 años), NO dibuja: tipo "muchas"', () => {
  assert.equal(elegirEscala('2026-01-01', '2060-12-31'), null); // 35 años
  assert.equal(bucketear('2026-01-01', '2060-12-31').tipo, 'muchas');
});

test('bajo 4 barras el strip NO dibuja: tipo "pocas" (un día no tiene forma)', () => {
  // El OTRO extremo del tope: "Hoy" = 1 barra, y hasta 3 barras, no informan.
  assert.deepEqual(bucketear('2026-08-18', '2026-08-18'), { tipo: 'pocas', n: 1 });
  assert.equal(bucketear('2026-08-18', '2026-08-19').tipo, 'pocas'); // 2 días
  assert.equal(bucketear('2026-08-18', '2026-08-20').tipo, 'pocas'); // 3 días
  assert.equal(bucketear('2026-08-18', '2026-08-21').tipo, 'dibuja'); // 4 días → ya dibuja
});

test('FUERZA BRUTA — ningún rango produce más de 31 barras; null sólo si >31 años', () => {
  // Se varía el DÍA DE INICIO (los 7 de la semana) además del span: un span de 217
  // días arranca a mitad de semana y toca 32 semanas —el borde donde un tope por
  // span-en-días fallaría—, así que el conteo es de buckets TOCADOS, no de días/7.
  const inicios = ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16']; // lun..dom
  const spans = [0, 1, 29, 30, 31, 32, 100, 209, 216, 217, 218, 224, 900, 929, 940, 2800, 2831, 2900, 11000, 11322, 11700, 20000];
  for (const ini of inicios) {
    for (const span of spans) {
      const hasta = masDias(ini, span);
      const r = bucketear(ini, hasta);
      if (r.tipo === 'muchas') {
        const anios = anioDe(hasta) - anioDe(ini) + 1;
        assert.ok(anios > MAX_BARRAS, `${ini}..${hasta} dio "muchas" con sólo ${anios} años`);
      } else if (r.tipo === 'pocas') {
        assert.ok(r.n < MIN_BARRAS, `${ini}..${hasta} dio "pocas" con ${r.n} barras`);
      } else {
        assert.ok(r.buckets.length >= MIN_BARRAS && r.buckets.length <= MAX_BARRAS,
          `${ini}..${hasta} → ${r.escala} produjo ${r.buckets.length} barras (fuera de [4,31])`);
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

test('SIN el tope de 31, un rango supera el límite; la escalera lo evita', () => {
  // Forzar 'dia' sobre un rango de 45 días produce 45 barras — más que el tope.
  const sinTope = bucketsDelRango('2026-01-01', masDias('2026-01-01', 44), 'dia');
  assert.equal(sinTope.length, 45);
  assert.ok(sinTope.length > MAX_BARRAS, 'sin escalón, 45 barras > 31');

  // Con la escalera, ese mismo rango sube a semana y queda en ≤31.
  const r = bucketear('2026-01-01', masDias('2026-01-01', 44));
  assert.equal(r.tipo, 'dibuja');
  if (r.tipo === 'dibuja') {
    assert.equal(r.escala, 'semana');
    assert.ok(r.buckets.length <= MAX_BARRAS);
  }
});

test('bucketKey coincide con la escala en cada peldaño', () => {
  const f = dayKeyStart('2026-08-12', TZ); // miércoles
  assert.equal(bucketKey(f, 'dia'),       '2026-08-12');
  assert.equal(bucketKey(f, 'semana'),    '2026-08-10');      // lunes
  assert.equal(bucketKey(f, 'mes'),       '2026-08');
  assert.equal(bucketKey(f, 'trimestre'), '2026-T3');         // ago = Q3
  assert.equal(bucketKey(f, 'anio'),      '2026');
});
