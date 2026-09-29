import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import GrindChooserRiel from '@/components/storefront/home/GrindChooserRiel';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { resolverSiteContent } from './site-content-defaults';

// RIEL-SCROLL-Y-BADGE-DORADO-1 — el TRACK ("Elige tu presentación", composición 'riel') dejaba de
// scrollear la página cuando el cursor quedaba sobre la tarjeta resaltada. MEDIDO (no supuesto,
// contra una reproducción fiel de las clases Tailwind computadas de este track, con Playwright real
// — el asiento de DECISIONS.md trae la corrida): `overflow-x-auto` fuerza, por regla de la
// especificación CSS, que `overflow-y` se compute como `auto` en vez de `visible`; la tarjeta
// RESALTADA (`sm:scale-[1.06]`) desborda su caja de layout por PINTADO (`transform` no participa del
// layout, pero SÍ del `scrollHeight` de un ancestro con overflow no-visible) — antes del fix,
// `scrollHeight` (518) > `clientHeight` (511) en el peor caso medido: 7px de rango vertical real, la
// condición que un scroll-chaining de rueda/trackpad puede latchear y sentir "pegado". El fix
// (`sm:py-6` en el track) RESERVA ese espacio en vez de recortarlo — medido `scrollHeight ===
// clientHeight` (560/560) tras el fix, en la misma reproducción.
//
// ESTE CARRIL ES LO AFIRMABLE SIN DOM (§ CLAUDE.md, "el glob NO incluye *.test.tsx" — no hay jsdom):
// `renderToStaticMarkup` no ejecuta layout ni mide scrollHeight/clientHeight reales — eso lo afirma
// la medición contra Chromium real, documentada en DECISIONS.md, no este archivo. Lo que SÍ es
// afirmable sin DOM es la FORMA de la clase que aplica el fix: que el track siga declarando el
// scroll horizontal + snap de siempre, que gane la reserva vertical (`sm:py-6`), y que NINGUNA clase
// de recorte vertical (`overflow-y-hidden`/`overflow-y-clip`) se haya colado — el spec pide
// explícitamente "sin recortar la tarjeta escalada ni su sombra", así que un recorte sería la
// regresión que este test existe para impedir.

function renderRiel(): string {
  const content = resolverSiteContent({});
  const arbol = React.createElement(SiteContentProvider, { value: content, children: React.createElement(GrindChooserRiel) });
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

// ─── PARIDAD-RIEL-TARJETAS-1 — la FORMA del bloque, medida contra `riel-antes-1440`/`riel-antes-390`
// (DECISIONS.md) y el prototipo (`docs/prototipos/cafeone/index.html:225-247`, `css/app.css:508-559`).
// Dos regresiones que el gate visual solo no atraparía por sí mismo: los controles de avance vivían
// AGRUPADOS con el CTA en la cabecera (arriba del track) y el tile usaba `rounded-3xl` en vez del rol
// de forma dedicado — los dos hallazgos de código del censo de paridad.

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

test('el tile usa el token de FORMA `sf-radio-tile`, no un radio fijo en el componente (`rounded-3xl` retirado)', () => {
  const html = renderRiel();
  assert.match(html, /aspect-\[3\/4\] overflow-hidden sf-radio-tile bg-\[var\(--sf-linea\)\]/);
  assert.doesNotMatch(html, /rounded-3xl/);
});

test('el precio NUNCA revienta sin catálogo — SSR (sin efectos, § el límite de admin-tienda-preset.test.ts) deja el catálogo en `[]` y ninguna tarjeta muestra "Desde"', () => {
  // Documenta el límite, no lo rodea: `getCatalog()` corre en un `useEffect`, que
  // `renderToStaticMarkup` nunca ejecuta — mismo patrón que Spotlight/Marquesina.
  const html = renderRiel();
  assert.doesNotMatch(html, /Desde/);
});
