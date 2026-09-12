import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cssPaleta } from './palette-style';
import { derivarPaleta } from './palette-derive';

// La lógica de inyección del layout del storefront: raíces → CSS `:root{…}`, null → null
// (sin <style> → cae a los defaults de código → Nayoli byte-idéntico). Puro; capa 1.

test('las tres raíces null → null (sin inyección → defaults de código)', () => {
  assert.equal(cssPaleta(null, null, null), null);
  assert.equal(cssPaleta('#faf7f4', null, '#8b4513'), null); // una raíz null → tampoco inyecta
});

test('3 raíces → `:root{…}` con una var --sf-* por cada clave de `derivarPaleta`', () => {
  const raices = { fondo: '#f6f5f3', tinta: '#1c1a18', acento: '#e5ff00' };
  const css = cssPaleta(raices.fondo, raices.tinta, raices.acento);
  assert.ok(css);
  assert.match(css!, /^:root\{/);
  assert.match(css!, /\}$/);
  // La cuenta se DERIVA de la fuente autoritativa, no se escribe a mano: `cssPaleta` emite
  // EXACTAMENTE una `--sf-` por clave del objeto que devuelve `derivarPaleta` (una entrada
  // de `Object.entries` → un `--sf-${k}:${v}`, y ningún valor —siempre un hex— contiene la
  // subcadena `--sf-`), así que las dos cuentas no pueden divergir: agregar o quitar una
  // clave en `derivarPaleta` mueve esta aserción sola, sin volver a tocar este archivo.
  assert.equal((css!.match(/--sf-/g) ?? []).length, Object.keys(derivarPaleta(raices)).length);
  assert.match(css!, /--sf-fondo:#f6f5f3/);
  assert.match(css!, /--sf-acento:#e5ff00/);
});

test('memo: mismas raíces devuelven exactamente la misma cadena', () => {
  const a = cssPaleta('#faf7f4', '#1a0f08', '#8b4513');
  const b = cssPaleta('#faf7f4', '#1a0f08', '#8b4513');
  assert.equal(a, b);
});
