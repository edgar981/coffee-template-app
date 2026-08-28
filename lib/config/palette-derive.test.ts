import { test } from 'node:test';
import assert from 'node:assert/strict';
import { derivarPaleta, pisoContraste, contraste, mezclar, type RaicesPaleta } from './palette-derive';

// El motor de color del storefront — puro, así que los tests son propiedades sobre la
// derivación. Se corre con `npm test` (capa 1). NO borrar: es lo único que afirma que el
// PISO DE CONTRASTE se aplica a los roles correctos y a ninguno más.

const NAYOLI: RaicesPaleta = { fondo: '#faf7f4', tinta: '#1a0f08', acento: '#8b4513' };
const NEON:   RaicesPaleta = { fondo: '#f6f5f3', tinta: '#1c1a18', acento: '#e5ff00' };

test('las 3 raíces se copian tal cual', () => {
  const p = derivarPaleta(NAYOLI);
  assert.equal(p.fondo, '#faf7f4');
  assert.equal(p.tinta, '#1a0f08');
  assert.equal(p.acento, '#8b4513');
});

test('deriva las 22 tintas (3 raíces + 19: las 20 vars + acento-texto y acento-txt)', () => {
  const p = derivarPaleta(NAYOLI);
  assert.equal(Object.keys(p).length, 22);
  for (const k of ['superficie','linea','superficie-2','tinta-2','acento-2','acento-3','acento-4','acento-texto','acento-txt','texto','texto-suave','tostado','tostado-2','tostado-3','tostado-4','tostado-5','tostado-6','tostado-7','tostado-8']) {
    assert.match(p[k], /^#[0-9a-f]{6}$/, `${k} debe ser hex`);
  }
});

test('acento-txt (texto del BOTÓN): blanco para acento oscuro (byte-idéntico con text-white), tinta para uno claro', () => {
  // Nayoli (acento oscuro) → gana el blanco → #ffffff EXACTO = el `text-white` de hoy → byte-idéntico.
  assert.equal(derivarPaleta(NAYOLI)['acento-txt'], '#ffffff');
  // Neón (acento claro) → gana la tinta oscura, y el texto del botón queda legible sobre el neón.
  const neon = derivarPaleta(NEON)['acento-txt'];
  assert.notEqual(neon, '#ffffff');
  assert.ok(contraste(neon, NEON.acento) >= 4.5, `texto del botón sobre neón (fue ${contraste(neon, NEON.acento).toFixed(2)})`);
});

test('acento oscuro (Nayoli): acento-texto = el acento EXACTO — el split es byte-idéntico', () => {
  // #8b4513 ya contrasta ~7:1 sobre crema, así que el piso no lo toca y el guard a===b
  // evita el round-trip. Es lo que mantiene los 39 sitios re-mapeados idénticos.
  const p = derivarPaleta(NAYOLI);
  assert.equal(p['acento-texto'], '#8b4513');
  assert.ok(contraste(p['acento-texto'], p.fondo) >= 4.5);
});

test('acento NEÓN: el piso hace legibles los roles de TEXTO sobre fondo (≥4.5:1)', () => {
  const p = derivarPaleta(NEON);
  for (const rol of ['acento-texto', 'texto', 'texto-suave']) {
    assert.ok(contraste(p[rol], p.fondo) >= 4.5, `${rol} debe pasar AA sobre fondo (fue ${contraste(p[rol], p.fondo).toFixed(2)})`);
  }
});

test('acento NEÓN: el piso NO se pasa — los decorativos claros NO se oscurecen', () => {
  // La regla de dirección: sólo texto-sobre-claro pisa hacia oscuro. `tostado` es
  // decorativo/claro-sobre-oscuro, así que con un neón SIGUE claro (no floreado). Si
  // alguien "completa la simetría" floreándolo, este test se cae.
  const p = derivarPaleta(NEON);
  assert.ok(contraste(p.tostado, p.fondo) < 4.5, 'tostado NO debe estar floreado (es claro, decorativo)');
});

test('pisoContraste: oscurece un color claro hasta el objetivo; deja quieto uno ya oscuro', () => {
  assert.ok(contraste(pisoContraste('#e5ff00', '#faf7f4'), '#faf7f4') >= 4.5); // neón → oscurece
  assert.equal(pisoContraste('#1a0f08', '#faf7f4'), '#1a0f08'); // ya contrasta → sin cambio (exacto)
});

test('mezclar es identidad al 0 y al 1', () => {
  assert.equal(mezclar('#8b4513', '#faf7f4', 0), '#8b4513');
  assert.equal(mezclar('#8b4513', '#faf7f4', 1), '#faf7f4');
});
