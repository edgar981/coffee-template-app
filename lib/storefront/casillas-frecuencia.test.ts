import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { casillasDeFrecuencia, totalEnviosEnVentana, NOMBRES_MES_ABREV, type FrecuenciaEnvio } from './casillas-frecuencia';

// Ancla fija: 12 de octubre de 2026 (§ cifras-decision del spec) — nunca `new Date()` (§ CLAUDE.md,
// "toda medición por tiempo lleva su ancla fija").
const HOY = new Date(2026, 9, 12); // los meses de Date() son 0-indexados: 9 = octubre

const MENSUAL: FrecuenciaEnvio = { enviosPorMes: 1, cadaNMeses: 1 };
const QUINCENAL: FrecuenciaEnvio = { enviosPorMes: 2, cadaNMeses: 1 };
const BIMESTRAL: FrecuenciaEnvio = { enviosPorMes: 1, cadaNMeses: 2 };
const TRIMESTRAL: FrecuenciaEnvio = { enviosPorMes: 1, cadaNMeses: 3 };

describe('casillasDeFrecuencia', () => {
  test('arranca en el mes SIGUIENTE a "hoy", nunca el actual', () => {
    const casillas = casillasDeFrecuencia(MENSUAL, ['bourbon'], HOY, 6);
    assert.equal(casillas[0].mes, 10); // noviembre (0-indexado)
    assert.equal(casillas[0].anio, 2026);
  });

  test('cruza el año en el offset correcto', () => {
    const casillas = casillasDeFrecuencia(MENSUAL, ['bourbon'], HOY, 6);
    // nov(10)/26, dic(11)/26, ene(0)/27, feb(1)/27, mar(2)/27, abr(3)/27
    assert.deepEqual(
      casillas.map((c) => [c.mes, c.anio]),
      [[10, 2026], [11, 2026], [0, 2027], [1, 2027], [2, 2027], [3, 2027]],
    );
  });

  test('mensual: las 6 llevan envío, ninguna doble', () => {
    const casillas = casillasDeFrecuencia(MENSUAL, ['bourbon'], HOY, 6);
    assert.ok(casillas.every((c) => c.conEnvio));
    assert.ok(casillas.every((c) => !c.dosVeces));
  });

  test('quincenal: las 6 llevan envío, TODAS dobles ("×2")', () => {
    const casillas = casillasDeFrecuencia(QUINCENAL, ['bourbon'], HOY, 6);
    assert.ok(casillas.every((c) => c.conEnvio));
    assert.ok(casillas.every((c) => c.dosVeces));
  });

  test('bimestral: sólo los meses pares del offset (0,2,4) llevan envío', () => {
    const casillas = casillasDeFrecuencia(BIMESTRAL, ['bourbon'], HOY, 6);
    assert.deepEqual(casillas.map((c) => c.conEnvio), [true, false, true, false, true, false]);
    assert.ok(casillas.every((c) => !c.dosVeces));
  });

  test('trimestral: sólo los offsets 0 y 3 llevan envío', () => {
    const casillas = casillasDeFrecuencia(TRIMESTRAL, ['bourbon'], HOY, 6);
    assert.deepEqual(casillas.map((c) => c.conEnvio), [true, false, false, true, false, false]);
  });

  test('sin marcas (ningún café elegido): las casillas con envío quedan VACÍAS igual', () => {
    const casillas = casillasDeFrecuencia(MENSUAL, [], HOY, 6);
    assert.ok(casillas.every((c) => c.conEnvio));
    assert.ok(casillas.every((c) => c.marcas.length === 0));
  });

  test('las marcas sólo aparecen en casillas CON envío, nunca en las sin envío', () => {
    const casillas = casillasDeFrecuencia(BIMESTRAL, ['bourbon', 'papayo'], HOY, 6);
    for (const c of casillas) {
      if (c.conEnvio) assert.deepEqual(c.marcas, ['bourbon', 'papayo']);
      else assert.deepEqual(c.marcas, []);
    }
  });

  test('n es configurable (no asume 6)', () => {
    const casillas = casillasDeFrecuencia(MENSUAL, [], HOY, 3);
    assert.equal(casillas.length, 3);
  });
});

describe('totalEnviosEnVentana', () => {
  test('mensual: 6 envíos en 6 meses', () => {
    assert.equal(totalEnviosEnVentana(MENSUAL, 6), 6);
  });

  test('quincenal: 12 envíos en 6 meses (cada casilla cuenta DOBLE)', () => {
    assert.equal(totalEnviosEnVentana(QUINCENAL, 6), 12);
  });

  test('bimestral: 3 envíos en 6 meses', () => {
    assert.equal(totalEnviosEnVentana(BIMESTRAL, 6), 3);
  });

  test('trimestral: 2 envíos en 6 meses', () => {
    assert.equal(totalEnviosEnVentana(TRIMESTRAL, 6), 2);
  });
});

describe('NOMBRES_MES_ABREV', () => {
  test('12 meses, empezando en enero', () => {
    assert.equal(NOMBRES_MES_ABREV.length, 12);
    assert.equal(NOMBRES_MES_ABREV[0], 'ene');
    assert.equal(NOMBRES_MES_ABREV[11], 'dic');
  });
});
