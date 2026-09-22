import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CartTitulo, CartCTA } from '@/components/storefront/CartDrawer';

// § CROMO-CARRITO-TEMATIZADO-1. El owner decidió (2026-09-22) que el cromo del carrito lateral es
// GLOBAL, no opt-in: cambia el carrito de TODOS los tenants. Medido en CROMO-GLOBAL-CENSO-1, el
// carrito ya leía `--sf-*` en 30/34 sitios; dos huecos quedaban horneados: el título en la fuente de
// CUERPO (`.font-semibold` a secas, sin rol de fuente) y el CTA en `--sf-tinta` (el color de TINTA,
// no el de ACCIÓN) con texto `--sf-sobre`. Este slice cierra los dos.
//
// `useCartStore` (`lib/cartStore.tsx`) es un CONTEXT con throw duro sin `CartProvider`
// (§ CLAUDE.md, "Montar un componente en OTRO árbol de providers no lo atrapa ni tsc ni el build") —
// y `CartProvider` no tiene forma de sembrar `items`/`isOpen` desde afuera (su estado nace vacío y
// cerrado; no hay prop de siembra, y `lib/cartStore.tsx` NO está en `touches:` de este slice, así
// que no se le agrega una). Montar `<CartDrawer />` completo en el carril (sin jsdom, sin árbol de
// Next real) es por tanto inalcanzable de forma honesta: probarlo exigiría mockear el módulo
// (`node:test`'s `mock.module` sólo existe tras `--experimental-test-module-mocks`, una bandera que
// `npm test` no lleva y que este slice no puede agregar sin tocar `package.json`, fuera de
// `touches:`) o instalar `react-test-renderer` (dependencia nueva, misma frontera).
//
// La salida: `CartTitulo` y `CartCTA` se EXTRAJERON de `CartDrawer.tsx` como los dos únicos
// fragmentos de marcado que este slice toca, y NINGUNO de los dos depende de `useCartStore` — el
// título es fijo; el CTA recibe su `onClick` por prop en vez de leerlo de contexto. `CartDrawer`
// sigue usando el MISMO marcado (mismas clases, mismo texto, mismo orden), sólo que ahora vive en un
// componente con nombre propio en vez de JSX inline — el DOM que el visitante ve no cambia un byte.
// Con eso, este archivo AFIRMA POR RENDER (no por grep del código fuente) que el título usa la clase
// de fuente de TÍTULO del preset y el CTA el token de ACCIÓN, sin mockear nada.

test('CartTitulo: el título usa `.font-playfair` -- la clase que resuelve `var(--sf-fuente-titulo, "Playfair Display", serif)`, el rol DISPLAY del preset (antes: sin clase de fuente, heredaba el rol CUERPO)', () => {
  const html = renderToStaticMarkup(React.createElement(CartTitulo));
  assert.equal(
    html,
    '<h2 class="font-playfair font-semibold text-[var(--sf-tinta)]">Tu Carrito</h2>',
  );
  assert.match(html, /class="font-playfair /, 'font-playfair debe ser la PRIMERA clase, igual que en los demás títulos del storefront (h2/h3 con font-playfair)');
});

test('CartCTA: el fondo usa `--sf-accion` (con fallback a `--sf-tostado`, byte-idéntico para Nayoli hoy) -- el MISMO patrón que el CTA primario de Hero (bg-[var(--sf-accion,var(--sf-tostado))])', () => {
  const html = renderToStaticMarkup(React.createElement(CartCTA, { onClick: () => {} }));
  assert.match(html, /class="[^"]*bg-\[var\(--sf-accion,var\(--sf-tostado\)\)\][^"]*"/, 'el fondo del CTA debe leer el token de ACCIÓN, no --sf-tinta');
  assert.doesNotMatch(html, /bg-\[var\(--sf-tinta\)\]/, 'el CTA ya no debe pintar su fondo con --sf-tinta (el color de INK, no de acción)');
});

test('CartCTA: el texto sobre el fondo de acción usa `--sf-tinta` -- el mismo "texto sobre-acción" que ya usa el botón primario del storefront (Hero*), no `--sf-sobre`', () => {
  const html = renderToStaticMarkup(React.createElement(CartCTA, { onClick: () => {} }));
  assert.match(html, /class="[^"]*text-\[var\(--sf-tinta\)\][^"]*"/);
  assert.doesNotMatch(html, /text-\[var\(--sf-sobre\)\]/, 'el CTA ya no debe usar --sf-sobre (el token de texto sobre TINTA, no sobre ACCIÓN)');
});

test('CartCTA: el hover sigue el MISMO token que el CTA primario de Hero (`hover:bg-[var(--sf-tostado-4)]`), no el `--sf-tinta-2` que sólo tenía sentido cuando el fondo era tinta', () => {
  const html = renderToStaticMarkup(React.createElement(CartCTA, { onClick: () => {} }));
  assert.match(html, /hover:bg-\[var\(--sf-tostado-4\)\]/);
  assert.doesNotMatch(html, /hover:bg-\[var\(--sf-tinta-2\)\]/);
});

test('CartCTA: la estructura (href, texto, ícono) no cambió -- sólo el color; sigue apuntando a /checkout y dice "Ir al Checkout"', () => {
  const html = renderToStaticMarkup(React.createElement(CartCTA, { onClick: () => {} }));
  assert.match(html, /href="\/checkout"/);
  assert.match(html, /Ir al Checkout/);
});
