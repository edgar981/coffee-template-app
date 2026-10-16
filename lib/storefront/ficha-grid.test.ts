import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { filaAnchoCompleto, filasFichaGrid } from '@/lib/storefront/ficha-grid';

// § CHAMISAS-PAGINAS-ARREGLOS-1 — el defecto medido: la retícula de la Ficha «Etiqueta de bolsa»
// sólo pasaba a dos columnas desde `sm:`, así que en celular (390px, la captura de referencia)
// las 8 filas caían a una sola columna en vez de emparejarse como la maqueta.

describe('filaAnchoCompleto — Variedades y Presentación van a lo ancho, el resto pareado', () => {
  test('Variedades → ancho completo', () => {
    assert.equal(filaAnchoCompleto('Variedades'), true);
  });
  test('Presentación → ancho completo', () => {
    assert.equal(filaAnchoCompleto('Presentación'), true);
  });
  test('Origen/Altitud/Proceso/Cosecha/Familias/Tostión → pareadas, no ancho completo', () => {
    for (const etiqueta of ['Origen', 'Altitud', 'Proceso', 'Cosecha principal', 'Familias', 'Tostión']) {
      assert.equal(filaAnchoCompleto(etiqueta), false, `${etiqueta} no debería ir a lo ancho`);
    }
  });
});

const FILA = (etiqueta: string) => ({ etiqueta, valor: 'x' });

describe('filasFichaGrid — el orden exacto de la maqueta: dos tramos pares, sin promoción', () => {
  test('Origen/Altitud · Variedades(ancha) · Proceso/Cosecha/Familias/Tostión · Presentación(ancha)', () => {
    const filas = [
      FILA('Origen'), FILA('Altitud'), FILA('Variedades'),
      FILA('Proceso'), FILA('Cosecha principal'), FILA('Familias'), FILA('Tostión'),
      FILA('Presentación'),
    ];
    const r = filasFichaGrid(filas);
    assert.deepEqual(r.map((f) => f.anchoCompleto), [false, false, true, false, false, false, false, true]);
    assert.deepEqual(r.map((f) => f.columna), [0, 1, null, 0, 1, 0, 1, null]);
  });
});

describe('filasFichaGrid — el hueco suelto: un tramo IMPAR promueve su ÚLTIMA fila a ancho completo', () => {
  test('una sola fila antes de una ancha (tramo de 1) se promueve entera — nunca queda sola junto a una celda vacía', () => {
    const filas = [FILA('Finca'), FILA('Variedades'), FILA('Altitud')];
    const r = filasFichaGrid(filas);
    // Finca queda SOLA antes de Variedades (tramo de largo 1, impar) → se promueve.
    assert.equal(r[0].anchoCompleto, true, 'Finca (tramo impar de 1) debe promoverse a ancho completo');
    assert.equal(r[1].anchoCompleto, true, 'Variedades sigue ancha, por su propio ícono');
    // Altitud queda SOLA al final (tramo de largo 1, impar) → también se promueve.
    assert.equal(r[2].anchoCompleto, true, 'Altitud (tramo impar de 1, al final) debe promoverse a ancho completo');
  });

  test('un tramo de TRES filas (impar) promueve sólo la ÚLTIMA — las dos primeras siguen pareadas', () => {
    const filas = [FILA('Origen'), FILA('Altitud'), FILA('Proceso'), FILA('Variedades')];
    const r = filasFichaGrid(filas);
    assert.deepEqual(r.map((f) => f.anchoCompleto), [false, false, true, true]);
    assert.deepEqual(r.map((f) => f.columna), [0, 1, null, null]);
  });

  test('sin ninguna fila ancha, un total IMPAR promueve sólo la última del documento', () => {
    const filas = [FILA('Origen'), FILA('Altitud'), FILA('Proceso')];
    const r = filasFichaGrid(filas);
    assert.deepEqual(r.map((f) => f.anchoCompleto), [false, false, true]);
  });

  test('sin ninguna fila ancha, un total PAR no promueve nada', () => {
    const filas = [FILA('Origen'), FILA('Altitud')];
    const r = filasFichaGrid(filas);
    assert.deepEqual(r.map((f) => f.anchoCompleto), [false, false]);
    assert.deepEqual(r.map((f) => f.columna), [0, 1]);
  });

  test('vacío → array vacío, nunca revienta', () => {
    assert.deepEqual(filasFichaGrid([]), []);
  });
});
