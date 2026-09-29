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
//
// ACTUALIZADO por § CTA-PRIMARIO-COLOR-Y-HOVER-1 (DEVIACIÓN DECLARADA, archivo fuera de `touches:`
// de ese slice): las dos aserciones de abajo pineaban el texto del CTA en `--sf-tinta` LITERAL y su
// hover en `--sf-tostado-4` LITERAL — exactamente el par que ese slice existe para cambiar (`CartCTA`
// es uno de los 9 miembros de la familia, y `CartDrawer.tsx` SÍ está en su `touches:`). Dejarlas sin
// tocar habría forzado GATE_RED sobre un archivo que un slice aprobado por el owner necesitaba tocar,
// o habría dejado `CartCTA` como la única excepción de la familia sin su fix — las dos peores que
// editar dos aserciones. El texto ahora es `--sf-accion-txt` (con fallback a `--sf-tinta`, byte-
// idéntico para Nayoli/todo tenant sin `origenAccion:'acento'`) y el hover `--sf-accion-hover` (con
// fallback a `--sf-tostado-4`, misma byte-identidad) — ver `lib/config/palette-derive.ts` y
// `lib/config/cta-primario.test.ts` para la derivación y el censo completo de la familia.

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

test('CartCTA: el texto sobre el fondo de acción usa `--sf-accion-txt` (fallback `--sf-tinta`) -- § CTA-PRIMARIO-COLOR-Y-HOVER-1, no `--sf-sobre` ni el `--sf-tinta` fijo de antes', () => {
  const html = renderToStaticMarkup(React.createElement(CartCTA, { onClick: () => {} }));
  assert.match(html, /class="[^"]*text-\[var\(--sf-accion-txt,var\(--sf-tinta\)\)\][^"]*"/);
  assert.doesNotMatch(html, /text-\[var\(--sf-sobre\)\]/, 'el CTA ya no debe usar --sf-sobre (el token de texto sobre TINTA, no sobre ACCIÓN)');
});

test('CartCTA: el hover usa `--sf-accion-hover` (fallback `--sf-tostado-4`, byte-idéntico) -- § CTA-PRIMARIO-COLOR-Y-HOVER-1, no el `--sf-tinta-2` que sólo tenía sentido cuando el fondo era tinta', () => {
  const html = renderToStaticMarkup(React.createElement(CartCTA, { onClick: () => {} }));
  assert.match(html, /hover:bg-\[var\(--sf-accion-hover,var\(--sf-tostado-4\)\)\]/);
  assert.doesNotMatch(html, /hover:bg-\[var\(--sf-tinta-2\)\]/);
});

test('CartCTA: la estructura (href, texto, ícono) no cambió -- sólo el color; sigue apuntando a /checkout y dice "Ir al Checkout"', () => {
  const html = renderToStaticMarkup(React.createElement(CartCTA, { onClick: () => {} }));
  assert.match(html, /href="\/checkout"/);
  assert.match(html, /Ir al Checkout/);
});
