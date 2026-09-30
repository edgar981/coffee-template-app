import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import GrindChooserRiel, { TarjetaRiel } from '@/components/storefront/home/GrindChooserRiel';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { CartProvider } from '@/lib/cartStore';
import type { Product } from '@/types/product';
import { resolverSiteContent } from './site-content-defaults';

// RIEL-SCROLL-Y-BADGE-DORADO-1 — el TRACK ("Elige tu presentación", composición 'riel') dejaba de
// scrollear la página cuando el cursor quedaba sobre la tarjeta resaltada. MEDIDO (no supuesto,
// contra una reproducción fiel de las clases Tailwind computadas de este track, con Playwright real
// — el asiento de DECISIONS.md trae la corrida): `overflow-x-auto` fuerza, por regla de la
// especificación CSS, que `overflow-y` se compute como `auto` en vez de `visible`; la tarjeta
// RESALTADA (`sm:scale-[1.06]`) desbordaba su caja de layout ~6% por los cuatro lados vía `transform`
// — un desborde de PINTADO, no de layout, que SÍ contaba para el `scrollHeight` del contenedor con
// overflow no-visible. El fix (`sm:py-6` en el track) reserva ese espacio. § RIEL-PRODUCTOS-Y-VISTA-
// RAPIDA-1 (2026-09-30) retiró el RESALTADO que causaba el desborde (`useIndiceCentrado`, § lib/
// animation.ts) — `sm:py-6` se conserva como respiro visual del track, sin el defecto que lo motivó.
//
// ESTE CARRIL ES LO AFIRMABLE SIN DOM (§ CLAUDE.md, "el glob NO incluye *.test.tsx" — no hay jsdom):
// `renderToStaticMarkup` no ejecuta layout ni efectos. `GrindChooserRiel` fuente sus tarjetas de
// `getCatalog()` (un `fetch` en un `useEffect`), así que bajo este arnés el catálogo SIEMPRE queda
// `[]` y NINGUNA tarjeta llega a renderizarse — el mismo límite ya documentado para Spotlight/
// Marquesina en `admin-tienda-preset.test.ts`. Lo que SÍ es afirmable sin catálogo es la cáscara del
// componente (cabecera, track, controles) y, por separado, `TarjetaRiel` — extraída exactamente para
// eso (§ su docstring en GrindChooserRiel.tsx) — con un producto de fixture, sin fetch ni catálogo.

function renderRiel(): string {
  const content = resolverSiteContent({});
  const arbol = React.createElement(
    SiteContentProvider,
    { value: content, children: React.createElement(CartProvider, { children: React.createElement(GrindChooserRiel) }) },
  );
  return renderToStaticMarkup(arbol);
}

function claseDelTrack(html: string): string {
  const m = html.match(/class="([^"]*grind-riel-track[^"]*)"/);
  assert.ok(m, 'el track (className con "grind-riel-track") debe estar presente en el render');
  return m![1];
}

test('el track del riel sigue declarando el scroll horizontal + snap de siempre (no se tocan)', () => {
  const clase = claseDelTrack(renderRiel());
  assert.match(clase, /\boverflow-x-auto\b/);
  assert.match(clase, /\bsnap-x\b/);
  assert.match(clase, /\bsnap-mandatory\b/);
});

test('el track gana la reserva vertical del fix (sm:py-6) — el mismo valor medido contra Chromium real (§ DECISIONS.md)', () => {
  const clase = claseDelTrack(renderRiel());
  assert.match(clase, /\bsm:py-6\b/);
});

test('el fix NUNCA recorta verticalmente el track — ninguna clase overflow-y-hidden/overflow-y-clip', () => {
  const clase = claseDelTrack(renderRiel());
  assert.doesNotMatch(clase, /overflow-y-(hidden|clip)/);
});

test('LA INVARIANTE: Nayoli no monta esta composición — resolverSiteContent({}) no elige "riel" para presentaciones (sólo CORTE lo pide, vía GrindChooser)', () => {
  const content = resolverSiteContent({});
  assert.notEqual(content.presentaciones?.variante, 'riel');
});

test('bajo Nayoli (sin catálogo, SSR) GrindChooserRiel no revienta — cero tarjetas, no un crash', () => {
  const html = renderRiel();
  assert.ok(html.length > 0, 'debe rendir markup (la cabecera y el track), no tirar');
  assert.doesNotMatch(html, /aspect-\[3\/4\]/, 'sin catálogo (SSR nunca corre el fetch) no hay tarjetas que renderizar');
});

// ─── PARIDAD-RIEL-TARJETAS-1 — los controles de avance viven DESPUÉS del track ────────────────────

test('los controles de avance viven DESPUÉS del track (abajo), no en la cabecera (arriba) — MEDIDO contra `.car-nav`, `css/app.css:553-559` y `index.html:241-246`', () => {
  const html = renderRiel();
  const indiceTrack = html.indexOf('grind-riel-track');
  const indiceFlechaAnterior = html.indexOf('aria-label="Presentación anterior"');
  assert.ok(indiceTrack > -1, 'el track debe estar presente');
  assert.ok(indiceFlechaAnterior > -1, 'el botón "Presentación anterior" debe estar presente');
  assert.ok(
    indiceFlechaAnterior > indiceTrack,
    'las flechas deben aparecer DESPUÉS del track en el HTML — abajo, no en la cabecera',
  );
});

// ─── RIEL-PRODUCTOS-Y-VISTA-RAPIDA-1 — `TarjetaRiel` con un producto de fixture ───────────────────

const PRODUCTO_FIXTURE: Product = {
  id: 'p1',
  nombre: 'Café Nariño 500g',
  slug: 'cafe-narino-500g',
  categoria: 'Café en Grano',
  precio: 35000,
  costo: 0,
  sku: null,
  stock: 10,
  activo: true,
  descripcion: 'Un café de especialidad, tostado con cuidado.',
  imagen: '/a.webp',
  imagenes: ['/b.webp'],
  disponible: true,
};

function renderTarjeta(producto: Product = PRODUCTO_FIXTURE, navHoverClase = 'hover:underline'): string {
  return renderToStaticMarkup(
    React.createElement(TarjetaRiel, {
      producto,
      negocio: undefined,
      navHoverClase,
      preview: false,
      index: 0,
      onEye: () => {},
      onCart: () => {},
    }),
  );
}

test('TarjetaRiel: el tile usa el token de FORMA `sf-radio-tile` con relleno + `object-contain`, nunca `object-cover`/`rounded-3xl`', () => {
  const html = renderTarjeta();
  assert.match(html, /aspect-\[3\/4\] overflow-hidden sf-radio-tile bg-\[var\(--sf-linea\)\]/);
  assert.match(html, /object-contain p-6/);
  assert.doesNotMatch(html, /object-cover/);
  assert.doesNotMatch(html, /rounded-3xl/);
});

test('TarjetaRiel: el precio es el del PRODUCTO, exacto — nunca "Desde"', () => {
  const html = renderTarjeta();
  assert.match(html, /35\.000/, 'debe mostrar el precio formateado del producto ($ 35.000, es-CO)');
  assert.doesNotMatch(html, /Desde/);
});

test('TarjetaRiel: sin foto de atrás (una sola imagen), sólo se renderiza UNA <img> — sin la segunda ni sus clases de crossfade', () => {
  const html = renderTarjeta({ ...PRODUCTO_FIXTURE, imagenes: [] });
  const imgs = html.match(/<img\b/g) ?? [];
  assert.equal(imgs.length, 1, 'sin foto de atrás debe haber UNA sola <img> (la portada), no dos');
  // El `alt=""` es exclusivo de la foto de atrás (la portada lleva el nombre del producto como alt).
  assert.doesNotMatch(html, /alt=""/);
  assert.doesNotMatch(html, /object-contain p-6 opacity-0/, 'sin foto de atrás no debe declararse su clase de crossfade');
});

test('TarjetaRiel: CON foto de atrás, hay DOS <img> — la portada se apaga al hover y la de atrás aparece', () => {
  const html = renderTarjeta();
  const imgs = html.match(/<img\b/g) ?? [];
  assert.equal(imgs.length, 2, 'con foto de atrás debe haber DOS <img>: la portada y la de atrás');
  assert.match(html, /object-contain p-6 transition-opacity duration-500 group-hover:opacity-0 group-focus-within:opacity-0/, 'la portada debe declarar su fade-out al hover');
  assert.match(html, /object-contain p-6 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-within:opacity-100/, 'la foto de atrás debe declarar su fade-in al hover');
});

test('TarjetaRiel: las dos acciones rápidas (ojo y carrito) están presentes, y el carrito se OMITE si el producto no está disponible', () => {
  const conStock = renderTarjeta();
  assert.match(conStock, /Vista rápida de Café Nariño 500g/);
  assert.match(conStock, /Agregar Café Nariño 500g al carrito/);

  const sinStock = renderTarjeta({ ...PRODUCTO_FIXTURE, disponible: false });
  assert.match(sinStock, /Vista rápida de Café Nariño 500g/, 'el ojo sigue disponible aunque no haya stock');
  assert.doesNotMatch(sinStock, /Agregar Café Nariño 500g al carrito/, 'sin stock no se ofrece agregar directo');
});

test('TarjetaRiel: el nombre lleva `navHoverClase` tal cual se lo pasan — sin `navTratamiento.subrayado` cae a `hover:underline`, byte-idéntico a hoy', () => {
  const html = renderTarjeta(PRODUCTO_FIXTURE, 'hover:underline');
  assert.match(html, /font-playfair text-\[var\(--sf-sobre-banda,var\(--sf-tinta\)\)\] hover:underline/);
});

test('TarjetaRiel: con `navTratamiento.subrayado` (CORTE), el nombre lleva la MISMA gramática del subrayado del nav (`after:` + `hover:after:scale-x-100`)', () => {
  const claseNav = 'relative after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-[220ms] after:ease-[cubic-bezier(0.22,0.61,0.36,1)] hover:after:scale-x-100';
  const html = renderTarjeta(PRODUCTO_FIXTURE, claseNav);
  assert.match(html, /hover:after:scale-x-100/);
  assert.doesNotMatch(html, /hover:underline/);
});

test('TarjetaRiel: sin foto en absoluto, cae al placeholder de marca — nunca un <img src=""> roto', () => {
  const html = renderTarjeta({ ...PRODUCTO_FIXTURE, imagen: '', imagenes: [] });
  assert.doesNotMatch(html, /src=""/);
});
