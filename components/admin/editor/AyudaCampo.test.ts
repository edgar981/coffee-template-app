import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partirAyuda } from './AyudaCampo';

// § EDITOR-VISUAL-NIVELES-1 — `partirAyuda` es la mitad PURA de la ayuda corta del panel (la otra
// mitad, `AyudaCampo`, es JSX y se verifica por captura/gate visual). Capa 1, sin DOM.

test('un hint corto se queda tal cual, sin "completa" que mostrar detrás de un «?»', () => {
  const r = partirAyuda('Vacío: se usa el texto por defecto.');
  assert.equal(r.corta, 'Vacío: se usa el texto por defecto.');
  assert.equal(r.completa, null);
});

test('string vacío no revienta: corta vacía, sin completa', () => {
  const r = partirAyuda('');
  assert.equal(r.corta, '');
  assert.equal(r.completa, null);
});

test('un hint largo con una primera oración corta se trunca en el punto, conservando el original completo', () => {
  const hint = 'Vacío: no se muestra. Es la línea bajo el titular que aparece sólo con las composiciones "media" o "sticky", en cursiva, para dar énfasis a una palabra del mensaje.';
  const r = partirAyuda(hint);
  assert.equal(r.corta, 'Vacío: no se muestra.');
  assert.equal(r.completa, hint);
});

test('un hint largo SIN una primera oración corta se trunca por palabra con elipsis', () => {
  const hint = 'Sólo con la composición "sticky" y el velo encendido, controla qué tan oscuro se pone el velo que cubre el video de fondo mientras el visitante hace scroll por la página de inicio';
  const r = partirAyuda(hint);
  assert.ok(r.corta.endsWith('…'), `esperaba elipsis al final, dio "${r.corta}"`);
  assert.ok(r.corta.length <= 71, `esperaba <=70 chars + elipsis, dio ${r.corta.length}`);
  // La corta nunca parte una palabra a la mitad: siempre corta en un espacio.
  assert.ok(hint.startsWith(r.corta.slice(0, -1)), 'la corta debe ser un prefijo literal del original');
  assert.equal(r.completa, hint);
});

test('un hint EXACTAMENTE en el umbral no lleva «?»', () => {
  const hint = 'x'.repeat(70);
  const r = partirAyuda(hint);
  assert.equal(r.corta, hint);
  assert.equal(r.completa, null);
});

test('un hint de 71 caracteres, sin oraciones ni espacios, se trunca a 70 + elipsis', () => {
  const hint = 'x'.repeat(71);
  const r = partirAyuda(hint);
  assert.equal(r.corta, `${'x'.repeat(70)}…`);
  assert.equal(r.completa, hint);
});
