import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cssPaleta } from './palette-style';

// La lógica de inyección del layout del storefront: raíces → CSS `:root{…}`, null → null
// (sin <style> → cae a los defaults de código → Nayoli byte-idéntico). Puro; capa 1.

test('las tres raíces null → null (sin inyección → defaults de código)', () => {
  assert.equal(cssPaleta(null, null, null), null);
  assert.equal(cssPaleta('#faf7f4', null, '#8b4513'), null); // una raíz null → tampoco inyecta
});

test('3 raíces → `:root{…}` con las 22 vars --sf-*', () => {
  const css = cssPaleta('#f6f5f3', '#1c1a18', '#e5ff00');
  assert.ok(css);
  assert.match(css!, /^:root\{/);
  assert.match(css!, /\}$/);
  assert.equal((css!.match(/--sf-/g) ?? []).length, 22); // las 20 vars + acento-texto + acento-txt
  assert.match(css!, /--sf-fondo:#f6f5f3/);
  assert.match(css!, /--sf-acento:#e5ff00/);
});

test('memo: mismas raíces devuelven exactamente la misma cadena', () => {
  const a = cssPaleta('#faf7f4', '#1a0f08', '#8b4513');
  const b = cssPaleta('#faf7f4', '#1a0f08', '#8b4513');
  assert.equal(a, b);
});
