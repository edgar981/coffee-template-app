import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coloresCorreo } from './email-colors';
import { derivarPaleta, RAICES_DEFECTO } from './palette-derive';

// Los 6 colores del correo se DERIVAN de las 3 raíces de `content.tema` (§ Tanda C2). Este test
// afirma el CABLEADO —qué clave de `derivarPaleta` alimenta cada slot del correo—, no valores
// literales: si alguien re-mapea un slot (p. ej. muted→tostado), se cae. Los 4 exactos + 2 de criterio.

test('cada color del correo mapea a su clave de derivarPaleta', () => {
  const raices = { fondo: '#f2ede6', tinta: '#201008', acento: '#a0522d' };
  const p = derivarPaleta(raices);
  const c = coloresCorreo(raices.fondo, raices.tinta, raices.acento);
  assert.equal(c.crema, p.fondo, 'crema → fondo');
  assert.equal(c.papel, p.superficie, 'papel → superficie');
  assert.equal(c.cafe, p.acento, 'cafe → acento (exacto)');
  assert.equal(c.borde, p.linea, 'borde → linea');
  assert.equal(c.espresso, p.tinta, 'espresso → tinta (criterio)');
  assert.equal(c.muted, p['texto-suave'], 'muted → texto-suave (criterio)');
});

test('cafe pasa EXACTO el acento (derivarPaleta copia las raíces)', () => {
  assert.equal(coloresCorreo('#ffffff', '#000000', '#8b4513').cafe, '#8b4513');
});

test('sin `content.tema` (raíces null) DERIVA de RAICES_DEFECTO (Nayoli)', () => {
  const c = coloresCorreo(null, null, null);
  const p = derivarPaleta(RAICES_DEFECTO);
  assert.equal(c.crema, p.fondo);
  assert.equal(c.espresso, p.tinta);
  assert.equal(c.cafe, RAICES_DEFECTO.acento); // #8b4513 — byte-idéntico al viejo emailColors.cafe
  assert.equal(c.muted, p['texto-suave']);
});

test('una raíz null cae al default de ESA raíz, sin arrastrar las otras', () => {
  // Defensivo: en la práctica `resolverTema` entrega las 3 raíces o ninguna, pero el `??` es por-campo.
  const c = coloresCorreo('#f0f0f0', null, '#123456');
  const p = derivarPaleta({ fondo: '#f0f0f0', tinta: RAICES_DEFECTO.tinta, acento: '#123456' });
  assert.equal(c.crema, p.fondo);
  assert.equal(c.cafe, '#123456');
});
