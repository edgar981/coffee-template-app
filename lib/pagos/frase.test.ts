import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUSINESS_TZ, dayKeyStart } from '@duna/core/timezone';
import { formatCOP } from '@duna/core/utils';
import { fraseDePagos, mejorDiaDe, type EntradaFrase } from './frase';
import type { RecorteTiempo } from './etiquetas';

// Capa 1 — puro. Los cuatro ejes de la frase: CONCORDANCIA (entró/entraron),
// VACÍO (es la misma frase, no un mensaje aparte), BUCKET (el recorte manda sobre
// el rango) y MÉTODO (el sufijo). La redacción es la decisión de producto, así que
// se afirma acá y no en un gate visual.

const AHORA = dayKeyStart('2026-08-19', BUSINESS_TZ); // mié 19 ago 2026, Bogotá

const base: EntradaFrase = {
  desde: '2026-08-01', hasta: '2026-08-19',
  bucket: null, metodoLabel: null,
  total: 315_000, conteo: 11, mejorDia: null, ahora: AHORA,
};

/** El texto plano de la frase, para afirmar la redacción completa. */
const texto = (e: EntradaFrase) => fraseDePagos(e).tramos.map(t => t.t).join('');
// Los montos se componen con `formatCOP` (lleva espacio duro): lo que estos tests
// afirman es la FRASE —concordancia, sujeto, sufijos—, no el formato de la moneda,
// que tiene su propio dueño.
const m = (n: number) => formatCOP(n);

test('sin recorte: el mes en curso se nombra "Este mes", y va en PLURAL', () => {
  assert.equal(texto(base), `Este mes entraron ${m(315_000)} en 11 pagos.`);
});

test('con bucket de día: el sujeto es el día y la concordancia pasa a SINGULAR', () => {
  const bucket: RecorteTiempo = { escala: 'dia', key: '2026-08-14', etiqueta: 'jue 14 ago' };
  assert.equal(
    texto({ ...base, bucket, total: 1_240_000, conteo: 26 }),
    `El jue 14 ago entró ${m(1_240_000)} en 26 pagos.`,
  );
});

test('el bucket MANDA sobre el rango: mismo rango, sujeto distinto', () => {
  // Sin bucket el sujeto es el período; con bucket, el bucket. El rango no cambió.
  const bucket: RecorteTiempo = { escala: 'semana', key: '2026-08-10', etiqueta: 'semana del 10 ago' };
  assert.match(texto({ ...base, bucket }), /^La semana del 10 ago entró /);
});

test('un rango de UN día va en singular; si es hoy, se llama "Hoy"', () => {
  assert.match(texto({ ...base, desde: '2026-08-19', hasta: '2026-08-19' }), /^Hoy entró /);
  // Otro día suelto se nombra por su fecha, no "Hoy".
  assert.match(texto({ ...base, desde: '2026-08-12', hasta: '2026-08-12' }), /^El 12 ago entró /);
});

test('el método se sufija a la frase y al eyebrow', () => {
  const f = fraseDePagos({ ...base, metodoLabel: 'Nequi', conteo: 26 });
  assert.equal(f.tramos.map(t => t.t).join(''), `Este mes entraron ${m(315_000)} en 26 pagos por Nequi.`);
  assert.equal(f.eyebrow, '1 ago – 19 ago · Nequi');
});

test('VACÍO: es la misma frase, no un "sin resultados" — y nombra el método', () => {
  const f = fraseDePagos({ ...base, total: 0, conteo: 0, metodoLabel: 'Daviplata' });
  assert.equal(f.tramos.map(t => t.t).join(''), 'Este mes no entró ningún pago por Daviplata.');
  assert.equal(f.subtitulo, 'No es un error del filtro: simplemente no hubo.');
  // Sin cifra ni conteo no hay nada que resaltar: la frase del vacío es un solo tramo.
  assert.equal(f.tramos.filter(t => t.fuerte).length, 0);
});

test('la cifra y el conteo son los tramos FUERTES (semibold), nada más', () => {
  const fuertes = fraseDePagos(base).tramos.filter(t => t.fuerte).map(t => t.t);
  assert.deepEqual(fuertes, [m(315_000), '11 pagos']);
});

test('un solo pago se dice "1 pago", no "1 pagos"', () => {
  assert.equal(texto({ ...base, total: 50_000, conteo: 1 }), `Este mes entraron ${m(50_000)} en 1 pago.`);
});

test('el subtítulo lleva el promedio, y el mejor día SÓLO si la curva lo dio', () => {
  assert.equal(fraseDePagos(base).subtitulo, `Promedio de ${m(28_636)} por pago.`);
  const conPico = fraseDePagos({ ...base, mejorDia: { etiqueta: '12 ago', monto: 90_000 } });
  assert.equal(conPico.subtitulo,
    `Promedio de ${m(28_636)} por pago · el mejor día fue el 12 ago con ${m(90_000)}.`);
});

test('el eyebrow es el rango activo; con un solo día no se repite', () => {
  assert.equal(fraseDePagos(base).eyebrow, '1 ago – 19 ago');
  assert.equal(fraseDePagos({ ...base, desde: '2026-08-19', hasta: '2026-08-19' }).eyebrow, '19 ago');
});

test('mejorDiaDe agrupa por DÍA de Bogotá y devuelve el pico', () => {
  const pagos = [
    { fecha: '2026-08-12T15:00:00Z', monto: 30_000 },
    { fecha: '2026-08-12T20:00:00Z', monto: 60_000 }, // mismo día Bogotá → 90.000
    { fecha: '2026-08-14T15:00:00Z', monto: 80_000 },
  ];
  assert.deepEqual(mejorDiaDe(pagos), { etiqueta: '12 ago', monto: 90_000 });
  assert.equal(mejorDiaDe([]), null);
});

test('mejorDiaDe usa la frontera de BOGOTÁ, no UTC', () => {
  // 2026-08-13T02:00Z son las 21:00 del 12 en Bogotá (UTC-5): el pago es del 12.
  const pagos = [{ fecha: '2026-08-13T02:00:00Z', monto: 10_000 }];
  assert.equal(mejorDiaDe(pagos)!.etiqueta, '12 ago');
});
