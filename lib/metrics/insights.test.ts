import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  insightRacha, insightContraPromedio, insightEnBanda, insightMuestraCorta,
  insightUltimoEvento, insightHistoriaDisponible, diasEntre, widgetInsight,
  MIN_ORDENES_INSIGHT, type InsightMonthPoint, type WidgetInsightData,
  dibujaTendencia,
} from './insights';

// Reglas de insight — puras, así que los tests son tablas de entrada/salida.
// Se corren con el runner nativo de Node sobre tsx: `npm test`.

/** Serie de meses cerrados con volumen suficiente, salvo que se indique otro. */
function serie(values: number[], opts: { ordenes?: number; enCurso?: number } = {}): WidgetInsightData {
  const ordenes = opts.ordenes ?? MIN_ORDENES_INSIGHT;
  const puntos: InsightMonthPoint[] = values.map((value, i) => ({
    month:   `2026-${String(i + 1).padStart(2, '0')}`,
    value,
    ordenes,
    cerrado: true,
  }));
  if (opts.enCurso !== undefined) {
    puntos.push({
      month:   `2026-${String(values.length + 1).padStart(2, '0')}`,
      value:   opts.enCurso,
      ordenes,
      cerrado: false,
    });
  }
  return { serie: puntos };
}

// ─── Racha ───────────────────────────────────────────────────────────────────

test('3 meses cerrados estrictamente decrecientes → racha a la baja', () => {
  assert.deepEqual(insightRacha(serie([300, 200, 100])), { text: '3 meses consecutivos a la baja', enfasis: true });
});

test('3 meses cerrados estrictamente crecientes → racha al alza', () => {
  assert.deepEqual(insightRacha(serie([100, 200, 300])), { text: '3 meses consecutivos al alza', enfasis: true });
});

test('solo 2 meses de datos → sin insight', () => {
  assert.equal(insightRacha(serie([200, 100])), null);
});

test('sin datos → sin insight', () => {
  assert.equal(insightRacha({ serie: [] }), null);
  assert.equal(insightRacha(null), null);
  assert.equal(insightRacha(undefined), null);
});

test('serie no monótona → sin insight', () => {
  assert.equal(insightRacha(serie([100, 300, 200])), null);
});

test('valores repetidos no son racha (exige estrictamente monótono)', () => {
  assert.equal(insightRacha(serie([200, 200, 100])), null);
});

test('bajo la guarda de órdenes → sin insight aunque la serie caiga', () => {
  assert.equal(insightRacha(serie([300, 200, 100], { ordenes: MIN_ORDENES_INSIGHT - 1 })), null);
});

test('el mes EN CURSO no cuenta como tercer mes de la racha', () => {
  // Dos meses cerrados + el mes en curso: la racha necesita 3 CERRADOS.
  assert.equal(insightRacha(serie([300, 200], { enCurso: 100 })), null);
});

test('el mes en curso no rompe una racha ya formada entre meses cerrados', () => {
  // 3 cerrados decrecientes + un mes en curso que va subiendo (incompleto).
  assert.deepEqual(
    insightRacha(serie([300, 200, 100], { enCurso: 999 })),
    { text: '3 meses consecutivos a la baja', enfasis: true },
  );
});

// ─── Contra promedio semestral ────────────────────────────────────────────────

test('último mes cerrado >25% bajo el promedio de los 6 previos → por debajo', () => {
  assert.deepEqual(
    insightContraPromedio(serie([100, 100, 100, 100, 100, 100, 50])),
    { text: 'Por debajo del promedio semestral', enfasis: true },
  );
});

test('último mes cerrado >25% sobre el promedio de los 6 previos → por encima', () => {
  assert.deepEqual(
    insightContraPromedio(serie([100, 100, 100, 100, 100, 100, 200])),
    { text: 'Por encima del promedio semestral', enfasis: true },
  );
});

test('desvío dentro del ±25% → sin insight', () => {
  assert.equal(insightContraPromedio(serie([100, 100, 100, 100, 100, 100, 80])), null);
});

test('6 meses cerrados no alcanzan (el promedio semestral exige 6 PREVIOS)', () => {
  assert.equal(insightContraPromedio(serie([100, 100, 100, 100, 100, 40])), null);
});

test('el mes EN CURSO incompleto no dispara contra-promedio', () => {
  // 6 meses cerrados + mes en curso hundido: si el mes en curso contara como
  // "último mes", esto diría "por debajo del promedio" cada primero de mes.
  assert.equal(insightContraPromedio(serie([100, 100, 100, 100, 100, 100], { enCurso: 10 })), null);
});

test('promedio previo en 0 → sin insight (no hay desvío reportable)', () => {
  assert.equal(insightContraPromedio(serie([0, 0, 0, 0, 0, 0, 500])), null);
});

test('contra-promedio también respeta la guarda de órdenes', () => {
  assert.equal(
    insightContraPromedio(serie([100, 100, 100, 100, 100, 100, 50], { ordenes: 3 })),
    null,
  );
});

// ─── Prehistoria (meses en cero antes de la primera orden) ────────────────────

test('meses iniciales sin órdenes no cuentan como historia (no fabrican promedio)', () => {
  // 4 meses de prehistoria (0 órdenes) + 3 de operación real: la regla semestral
  // NO debe dispararse — sin el descarte, el promedio de los "6 previos" saldría
  // hundido por los ceros y el último mes quedaría "por encima".
  const conPrehistoria: WidgetInsightData = {
    serie: [
      { month: '2025-12', value: 0,       ordenes: 0,  cerrado: true },
      { month: '2026-01', value: 0,       ordenes: 0,  cerrado: true },
      { month: '2026-02', value: 0,       ordenes: 0,  cerrado: true },
      { month: '2026-03', value: 0,       ordenes: 0,  cerrado: true },
      { month: '2026-04', value: 255000,  ordenes: 5,  cerrado: true },
      { month: '2026-05', value: 1416000, ordenes: 30, cerrado: true },
      { month: '2026-06', value: 1197000, ordenes: 33, cerrado: true },
    ],
  };
  assert.equal(insightContraPromedio(conPrehistoria), null);
  // Y la racha tampoco: 255k → 1416k → 1197k no es monótona.
  assert.equal(insightRacha(conPrehistoria), null);
});

test('un mes en cero EN MEDIO de la operación sí es dato real', () => {
  // Racha a la baja legítima que pasa por 0: 300 → 100 → 0 con muestra suficiente.
  const conHueco: WidgetInsightData = {
    serie: [
      { month: '2026-04', value: 300, ordenes: 20, cerrado: true },
      { month: '2026-05', value: 100, ordenes: 18, cerrado: true },
      { month: '2026-06', value: 0,   ordenes: 16, cerrado: true },
    ],
  };
  assert.deepEqual(insightRacha(conHueco), { text: '3 meses consecutivos a la baja', enfasis: true });
});

// ─── En banda (mismo cálculo que contra-promedio, dentro del ±25%) ────────────

test('en banda: 7 meses cerrados, muestra suficiente y desvío dentro del ±25%', () => {
  assert.deepEqual(
    insightEnBanda(serie([100, 100, 100, 100, 100, 100, 90])),
    { text: 'En línea con el promedio semestral', enfasis: true },
  );
});

test('en banda NO emite si contra-promedio disparó (el hecho ya está dicho)', () => {
  const fuera = serie([100, 100, 100, 100, 100, 100, 50]);
  assert.deepEqual(insightContraPromedio(fuera), { text: 'Por debajo del promedio semestral', enfasis: true });
  assert.equal(insightEnBanda(fuera), null);
});

test('en banda NO emite con menos de 6 meses previos (no hay semestre que promediar)', () => {
  // 6 cerrados = solo 5 previos al comparado: el texto diría "semestral" en falso.
  assert.equal(insightEnBanda(serie([100, 100, 100, 100, 100, 100])), null);
});

test('en banda respeta la guarda de muestra (no se relaja para tener texto)', () => {
  assert.equal(
    insightEnBanda(serie([100, 100, 100, 100, 100, 100, 90], { ordenes: MIN_ORDENES_INSIGHT - 1 })),
    null,
  );
});

test('en banda ignora la prehistoria igual que las demás reglas', () => {
  const conPrehistoria: WidgetInsightData = {
    serie: [
      { month: '2025-11', value: 0,   ordenes: 0,  cerrado: true },
      { month: '2025-12', value: 0,   ordenes: 0,  cerrado: true },
      { month: '2026-01', value: 100, ordenes: 20, cerrado: true },
      { month: '2026-02', value: 100, ordenes: 20, cerrado: true },
      { month: '2026-03', value: 100, ordenes: 20, cerrado: true },
    ],
  };
  assert.equal(insightEnBanda(conPrehistoria), null);
});

// ─── Muestra corta ────────────────────────────────────────────────────────────

test('muestra corta: menos de 3 meses cerrados', () => {
  assert.deepEqual(insightMuestraCorta(serie([100, 100])), { text: 'Muestra aún pequeña para tendencias' });
});

test('muestra corta: 3 meses pero bajo la guarda de órdenes', () => {
  assert.deepEqual(
    insightMuestraCorta(serie([300, 200, 100], { ordenes: 10 })),
    { text: 'Muestra aún pequeña para tendencias' },
  );
});

test('muestra corta NO aplica cuando hay base suficiente', () => {
  assert.equal(insightMuestraCorta(serie([300, 200, 100])), null);
});

test('muestra corta no aplica a una tarjeta sin serie (esas usan último evento)', () => {
  assert.equal(insightMuestraCorta({ ultimoEvento: null, hoy: '2026-07-29' }), null);
});

// ─── Último evento (tarjetas de scope HOY) ───────────────────────────────────

test('último evento hoy → copy de "hoy"', () => {
  const r = insightUltimoEvento(
    { ultimoEvento: '2026-07-29T14:00:00.000Z', hoy: '2026-07-29' },
    { hoy: 'Último pago registrado hoy', dias: n => `hace ${n}`, nunca: 'Sin registros todavía' },
  );
  assert.deepEqual(r, { text: 'Último pago registrado hoy' });
});

test('último evento hace N días → copy con el conteo', () => {
  const r = insightUltimoEvento(
    { ultimoEvento: '2026-07-26T14:00:00.000Z', hoy: '2026-07-29' },
    { hoy: 'hoy', dias: n => `Último pago hace ${n} ${n === 1 ? 'día' : 'días'}`, nunca: 'Sin registros todavía' },
  );
  assert.deepEqual(r, { text: 'Último pago hace 3 días' });
});

test('un solo día usa singular', () => {
  const r = insightUltimoEvento(
    { ultimoEvento: '2026-07-28T10:00:00.000Z', hoy: '2026-07-29' },
    { hoy: 'hoy', dias: n => `Última orden hace ${n} ${n === 1 ? 'día' : 'días'}`, nunca: 'Sin registros' },
  );
  assert.deepEqual(r, { text: 'Última orden hace 1 día' });
});

test('FRANJA 19:00–23:59 Bogotá: el día se deriva en Bogotá, no en UTC → "ayer", no "hoy"', () => {
  // 2026-08-23T00:10:00Z = 2026-08-22 19:10 en Bogotá (UTC-5): AYER. Con el slice
  // del ISO en UTC daba "2026-08-23" = hoy y la tarjeta decía "creada hoy" mientras
  // su conteo decía 0 (el conteo usa la ventana de Bogotá). Debe decir "hace 1 día".
  const r = insightUltimoEvento(
    { ultimoEvento: '2026-08-23T00:10:00.000Z', hoy: '2026-08-23' },
    { hoy: 'Última orden creada hoy', dias: n => `Última orden hace ${n} ${n === 1 ? 'día' : 'días'}`, nunca: 'Sin registros' },
  );
  assert.deepEqual(r, { text: 'Última orden hace 1 día' });
});

test('borde simétrico: 05:00Z es 00:00 Bogotá del MISMO día → "hoy"', () => {
  // 2026-08-23T05:00:00Z = 2026-08-23 00:00 Bogotá: el primer instante de hoy.
  const r = insightUltimoEvento(
    { ultimoEvento: '2026-08-23T05:00:00.000Z', hoy: '2026-08-23' },
    { hoy: 'hoy', dias: n => `hace ${n}`, nunca: 'Sin registros' },
  );
  assert.deepEqual(r, { text: 'hoy' });
});

test('el copy de días recibe el ISO para formatear la fecha (caso despachos)', () => {
  const r = insightUltimoEvento(
    { ultimoEvento: '2026-07-24T10:00:00.000Z', hoy: '2026-07-29' },
    { hoy: 'hoy', dias: (_n, fecha) => `Sin despachos desde ${fecha.slice(0, 10)}`, nunca: 'Sin registros' },
  );
  assert.deepEqual(r, { text: 'Sin despachos desde 2026-07-24' });
});

test('widget de hoy sin eventos históricos → "Sin registros todavía"', () => {
  const r = insightUltimoEvento(
    { ultimoEvento: null, hoy: '2026-07-29' },
    { hoy: 'hoy', dias: n => `hace ${n}`, nunca: 'Sin registros todavía' },
  );
  assert.deepEqual(r, { text: 'Sin registros todavía' });
});

test('sin día de referencia no se inventa un "hace N días"', () => {
  assert.equal(
    insightUltimoEvento({ ultimoEvento: '2026-07-26T14:00:00.000Z' },
      { hoy: 'hoy', dias: n => `hace ${n}`, nunca: 'nunca' }),
    null,
  );
});

test('diasEntre cuenta días de calendario', () => {
  assert.equal(diasEntre('2026-07-29', '2026-07-29'), 0);
  assert.equal(diasEntre('2026-07-28', '2026-07-29'), 1);
  assert.equal(diasEntre('2026-06-29', '2026-07-29'), 30);
});

// ─── Selección ───────────────────────────────────────────────────────────────

test('la racha gana sobre el promedio cuando ambas aplican', () => {
  // 7 cerrados: los últimos 3 caen Y el último está bien bajo el promedio.
  assert.deepEqual(
    widgetInsight(serie([100, 100, 100, 100, 300, 200, 50])),
    { text: '3 meses consecutivos a la baja', enfasis: true },
  );
});

test('sin racha, cae al promedio semestral', () => {
  assert.deepEqual(
    widgetInsight(serie([100, 100, 100, 100, 100, 100, 50])),
    { text: 'Por debajo del promedio semestral', enfasis: true },
  );
});

// ─── Escalera completa: cada escalón solo si los anteriores dieron null ────────

test('escalera: racha (a) gana a todo lo demás', () => {
  // 7 cerrados donde ADEMÁS el último está en banda: manda la racha.
  const d = serie([100, 100, 100, 100, 130, 120, 110]);
  assert.equal(insightRacha(d)?.text, '3 meses consecutivos a la baja');
  assert.deepEqual(widgetInsight(d), { text: '3 meses consecutivos a la baja', enfasis: true });
});

test('escalera: sin racha → contra-promedio (b)', () => {
  const d = serie([100, 100, 100, 100, 100, 100, 50]);
  assert.equal(insightRacha(d), null);
  assert.deepEqual(widgetInsight(d), { text: 'Por debajo del promedio semestral', enfasis: true });
});

test('escalera: sin racha ni desvío → en banda (c)', () => {
  const d = serie([100, 90, 100, 90, 100, 90, 95]);
  assert.equal(insightRacha(d), null);
  assert.equal(insightContraPromedio(d), null);
  assert.deepEqual(widgetInsight(d), { text: 'En línea con el promedio semestral', enfasis: true });
});

test('escalera: historia corta → muestra corta (d), no un texto de tendencia', () => {
  const d = serie([100, 100]);
  assert.equal(insightRacha(d), null);
  assert.equal(insightContraPromedio(d), null);
  assert.equal(insightEnBanda(d), null);
  assert.deepEqual(widgetInsight(d), { text: 'Muestra aún pequeña para tendencias' });
});

test('bajo la guarda de muestra NINGÚN escalón emite texto de tendencia', () => {
  const d = serie([300, 200, 100, 100, 100, 100, 50], { ordenes: MIN_ORDENES_INSIGHT - 1 });
  assert.equal(insightRacha(d), null);
  assert.equal(insightContraPromedio(d), null);
  assert.equal(insightEnBanda(d), null);
  // Lo único que sale es el hecho de que no hay base — sin énfasis.
  assert.deepEqual(widgetInsight(d), { text: 'Muestra aún pequeña para tendencias' });
});

test('escalera: con muestra pero sin racha ni semestre → historia disponible (e)', () => {
  // Caso real del dashboard: 3 meses cerrados, muestra de sobra, serie no monótona
  // y sin semestre que promediar. La línea no puede quedar vacía.
  const d: WidgetInsightData = {
    serie: [
      { month: '2026-04', value: 255000,  ordenes: 20, cerrado: true },
      { month: '2026-05', value: 1416000, ordenes: 30, cerrado: true },
      { month: '2026-06', value: 1197000, ordenes: 33, cerrado: true },
    ],
  };
  assert.equal(insightRacha(d), null);
  assert.equal(insightContraPromedio(d), null);
  assert.equal(insightEnBanda(d), null);
  assert.equal(insightMuestraCorta(d), null);
  assert.deepEqual(widgetInsight(d), { text: '3 meses completos de historia' });
});

test('historia disponible usa singular con un mes', () => {
  assert.deepEqual(
    insightHistoriaDisponible({ serie: [{ month: '2026-06', value: 10, ordenes: 20, cerrado: true }] }),
    { text: '1 mes completo de historia' },
  );
});

test('historia disponible no aplica sin meses cerrados', () => {
  assert.equal(insightHistoriaDisponible({ serie: [] }), null);
  assert.equal(insightHistoriaDisponible({ ultimoEvento: null, hoy: '2026-07-29' }), null);
});

test('los fallbacks NO llevan énfasis; los de tendencia SÍ', () => {
  assert.equal(widgetInsight(serie([300, 200, 100]))?.enfasis, true);
  assert.equal(widgetInsight(serie([100, 100]))?.enfasis, undefined);
});

// ─── Dibuja o declara ─────────────────────────────────────────────────────────
//
// El invariante que estos tests fijan NO es un umbral: es que el gráfico y el
// titular NO PUEDAN CONTRADECIRSE. Por eso cada caso afirma las DOS mitades a la
// vez —lo que dice el guard y lo que hace el dibujo—. Si alguien le diera a
// `dibujaTendencia` un umbral propio, estos tests se caen, que es justo lo que se
// les pide.

test('un solo mes NO dibuja: es el caso que motivó la regla', () => {
  const d = serie([100]);
  assert.equal(dibujaTendencia(d), false);
  assert.deepEqual(insightMuestraCorta(d), { text: 'Muestra aún pequeña para tendencias' });
});

test('dos meses tampoco dibujan', () => {
  assert.equal(dibujaTendencia(serie([100, 200])), false);
});

test('tres meses con muestra suficiente SÍ dibujan', () => {
  const d = serie([300, 200, 100]);
  assert.equal(dibujaTendencia(d), true);
  assert.equal(insightMuestraCorta(d), null);
});

test('tres meses bajo la guarda de ÓRDENES no dibujan, aunque sobren meses', () => {
  // La muestra corta no es sólo cuestión de cuántos meses hay: con pocas órdenes el
  // porcentaje es ruido. El dibujo hereda esa guarda entera, no sólo el conteo.
  assert.equal(dibujaTendencia(serie([300, 200, 100], { ordenes: 10 })), false);
});

test('sin serie NO dibuja — y es el borde que obliga a la guarda explícita', () => {
  // AQUÍ ESTÁ LA RAZÓN DE `!data?.serie?.length`, y es un borde real, no ceremonia:
  // con `null`/`undefined` el guard devuelve `null` —correcto para un insight: "no
  // tengo nada que decir"— y delegar a secas leería ese `null` como "no hay
  // objeción, dibuja". O sea, sin serie dibujaría.
  assert.equal(insightMuestraCorta(null), null);
  assert.equal(dibujaTendencia(null), false);
  assert.equal(dibujaTendencia(undefined), false);

  // Un array VACÍO no pasa por esa rama —`[]` es truthy—, así que el guard sí
  // opina y devuelve muestra corta. Las dos entradas llegan al mismo `false` por
  // caminos distintos, y por eso se afirman las dos.
  assert.deepEqual(insightMuestraCorta({ serie: [] }), { text: 'Muestra aún pequeña para tendencias' });
  assert.equal(dibujaTendencia({ serie: [] }), false);
});

test('el mes EN CURSO no habilita el dibujo: sólo cuentan los cerrados', () => {
  // Dos cerrados + uno en curso siguen siendo dos para la regla, igual que para el
  // guard. Sin esto, el día 1 de cada mes un negocio nuevo "estrenaría" tendencia.
  assert.equal(dibujaTendencia(serie([100, 200], { enCurso: 300 })), false);
});
