import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cssFuentes } from './fuentes-style';

// Gemelo del test de cssPaleta: par → CSS `:root{…}`, Editorial/null → null (sin <style> → las clases
// `.font-*` caen a su fallback Inter/Playfair → Nayoli byte-idéntico). Puro; capa 1.

test('Editorial/null/basura → null (sin inyección → fallback Inter/Playfair)', () => {
  assert.equal(cssFuentes(null), null);
  assert.equal(cssFuentes('editorial'), null);
  assert.equal(cssFuentes('basura' as never), null);
});

test('un par CUSTOM → `:root{}` con las 2 vars --sf-fuente-*', () => {
  const css = cssFuentes('calido');
  assert.ok(css);
  assert.match(css!, /^:root\{/);
  assert.match(css!, /\}$/);
  assert.match(css!, /--sf-fuente-titulo:'Fraunces', serif/);
  assert.match(css!, /--sf-fuente-cuerpo:'Nunito Sans', sans-serif/);
  assert.equal((css!.match(/--sf-fuente-/g) ?? []).length, 2);
});
