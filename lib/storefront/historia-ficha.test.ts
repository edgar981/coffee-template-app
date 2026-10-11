import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  filasFicha, franjaAltitud, puntoFinca, rotuloSuperior, pieSvgIlustracion,
  FICHA_VIEWBOX_W, FICHA_VIEWBOX_H, PUNTO_FINCA_X,
} from './historia-ficha';
import { DEFAULTS } from '../config/site-content-defaults';

const base = DEFAULTS.brandStory;

// ─── filasFicha — AND (rótulo Y valor), compactando huecos, 2 a 6 ────────────────────────────────

test('DEFAULTS: las 6 filas vacías → [] (nadie eligió esta composición todavía)', () => {
  assert.deepEqual(filasFicha(base), []);
});

test('fila1 y fila2 completas, el resto vacías → 2 filas, en orden', () => {
  const f = filasFicha({ ...base, fila1Rotulo: 'Finca', fila1Valor: 'Origen', fila2Rotulo: 'Altitud', fila2Valor: '1.650–2.100 msnm' });
  assert.equal(f.length, 2);
  assert.deepEqual(f[0], { rotulo: 'Finca', valor: 'Origen', subLinea: '' });
  assert.deepEqual(f[1], { rotulo: 'Altitud', valor: '1.650–2.100 msnm', subLinea: '' });
});

test('huecos en el medio se COMPACTAN: fila2 vacía, fila1/fila3/fila4 llenas → 3 filas, orden 1,3,4', () => {
  const f = filasFicha({
    ...base,
    fila1Rotulo: 'Finca', fila1Valor: 'A',
    fila3Rotulo: 'Variedad', fila3Valor: 'B',
    fila4Rotulo: 'Proceso', fila4Valor: 'C',
  });
  assert.deepEqual(f.map((x) => x.rotulo), ['Finca', 'Variedad', 'Proceso']);
});

test('AND, no OR: rótulo SIN valor no se muestra', () => {
  const f = filasFicha({ ...base, fila1Rotulo: 'Finca', fila1Valor: '' });
  assert.deepEqual(f, []);
});

test('AND, no OR: valor SIN rótulo no se muestra', () => {
  const f = filasFicha({ ...base, fila1Rotulo: '', fila1Valor: 'Nayoli' });
  assert.deepEqual(f, []);
});

test('sub-línea es opcional: una fila completa SIN sub-línea sigue contando como completa', () => {
  const f = filasFicha({ ...base, fila1Rotulo: 'Vereda', fila1Valor: 'Providencia', fila1SubLinea: '' });
  assert.equal(f.length, 1);
  assert.equal(f[0].subLinea, '');
});

test('sub-línea viaja cuando está presente', () => {
  const f = filasFicha({ ...base, fila1Rotulo: 'Vereda', fila1Valor: 'Providencia', fila1SubLinea: 'Supatá, Cundinamarca' });
  assert.equal(f[0].subLinea, 'Supatá, Cundinamarca');
});

test('las 6 filas completas → 6, en orden 1 a 6 (el tope)', () => {
  const llenas = Object.fromEntries(
    [1, 2, 3, 4, 5, 6].flatMap((n) => [[`fila${n}Rotulo`, `R${n}`], [`fila${n}Valor`, `V${n}`]]),
  );
  const f = filasFicha({ ...base, ...llenas });
  assert.equal(f.length, 6);
  assert.deepEqual(f.map((x) => x.rotulo), ['R1', 'R2', 'R3', 'R4', 'R5', 'R6']);
});

// ─── franjaAltitud — con y sin rango ──────────────────────────────────────────────────────────────

test('franjaAltitud: min y max presentes → objeto con las dos etiquetas, unidad incluida', () => {
  const franja = franjaAltitud('1.650', '2.100', 'msnm');
  assert.ok(franja);
  assert.equal(franja!.etiquetaMax, '2.100 msnm');
  assert.equal(franja!.etiquetaMin, '1.650 msnm');
});

test('franjaAltitud: unidad vacía → la etiqueta es sólo el número, sin espacio colgando', () => {
  const franja = franjaAltitud('1.650', '2.100', '');
  assert.ok(franja);
  assert.equal(franja!.etiquetaMax, '2.100');
  assert.equal(franja!.etiquetaMin, '1.650');
});

test('franjaAltitud: falta max → null (un rango es los DOS, no uno solo)', () => {
  assert.equal(franjaAltitud('1.650', '', 'msnm'), null);
});

test('franjaAltitud: falta min → null', () => {
  assert.equal(franjaAltitud('', '2.100', 'msnm'), null);
});

test('franjaAltitud: los dos vacíos → null (el caso DEFAULT de hoy)', () => {
  assert.equal(franjaAltitud(base.altitudMin, base.altitudMax, base.altitudUnidad), null);
});

test('franjaAltitud: las posiciones (yTop/yBottom) son FIJAS — no dependen de la magnitud del rango', () => {
  const chico = franjaAltitud('0', '100', 'msnm');
  const grande = franjaAltitud('1.000', '4.000', 'msnm');
  assert.deepEqual([chico!.yTop, chico!.yBottom], [grande!.yTop, grande!.yBottom]);
});

// ─── puntoFinca — dentro de la franja, o en la cresta ────────────────────────────────────────────

test('puntoFinca: con franja → Y cae ESTRICTAMENTE dentro de la banda (entre yTop y yBottom)', () => {
  const franja = franjaAltitud('1.650', '2.100', 'msnm');
  const p = puntoFinca(franja);
  assert.equal(p.x, PUNTO_FINCA_X);
  assert.ok(p.y > franja!.yTop && p.y < franja!.yBottom);
});

test('puntoFinca: sin franja → Y queda FUERA de donde estaría la banda (en la cresta, § el spec)', () => {
  const sinFranja = puntoFinca(null);
  const franja = franjaAltitud('1.650', '2.100', 'msnm');
  assert.ok(sinFranja.y < franja!.yTop, 'el punto "en la cresta" debe quedar por encima de la banda');
});

// ─── rotuloSuperior / pieSvgIlustracion — texto opcional, se omite vacío ─────────────────────────

test('rotuloSuperior: con lugar → bookends de estrella', () => {
  assert.equal(rotuloSuperior('Supatá · Cundinamarca'), '✦ Supatá · Cundinamarca ✦');
});

test('rotuloSuperior: vacío → null (se omite, no se dibuja un rótulo fantasma)', () => {
  assert.equal(rotuloSuperior(''), null);
  assert.equal(rotuloSuperior('   '), null);
});

test('pieSvgIlustracion: con texto → se devuelve tal cual, SIN bookends (a diferencia del rótulo superior)', () => {
  assert.equal(pieSvgIlustracion('Castillo · Lavado'), 'Castillo · Lavado');
});

test('pieSvgIlustracion: vacío → null', () => {
  assert.equal(pieSvgIlustracion(''), null);
});

// ─── La geometría declarada es la de la maqueta aprobada (4:5) ──────────────────────────────────

test('el viewBox es 4:5 — la MISMA proporción que la foto (imagen1), para que elegir Medio no cambie la celda', () => {
  assert.equal(FICHA_VIEWBOX_W / FICHA_VIEWBOX_H, 4 / 5);
});
