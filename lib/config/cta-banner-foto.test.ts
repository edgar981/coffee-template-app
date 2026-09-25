import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import SubscriptionCTALinea from '@/components/storefront/home/SubscriptionCTALinea';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { PreviewProvider } from '@/components/storefront/PreviewMode';

import { DEFAULTS, REGISTRY, type SiteContentData } from './site-content-defaults';
import { camposControladosPorPanel } from './panel-controles';

// MUESTRARIO-CTA-BANNER-FOTO-1 — `subscriptionCTA` gana una imagen de fondo OPCIONAL, sólo leída
// por la variante 'linea' (§ SubscriptionCTALinea.tsx). Vacío (default, Nayoli incluida) = el fondo
// SÓLIDO de hoy, byte-idéntico. Con imagen: foto a sangre completa + velo degradado (reusa
// `--sf-velo`, NUNCA un rgba nuevo) + parallax (reusa `useProgresoScroll`, el mismo motor de
// scroll-scrub de Marquesina.tsx — cero piezas nuevas del motor).
//
// `renderToStaticMarkup` sobre el árbol REAL, sin jsdom (§ CLAUDE.md, "El glob NO incluye *.test.tsx"),
// MISMO patrón que `marquesina-banda.test.ts`/`site-content-defaults.test.ts` (GrindChooserRiel): el
// `useScroll` real es capa 3 — acá se afirma sólo el gate ESTÁTICO (preview = proxy de movimiento
// reducido) y la forma del HTML a progreso=0 (el valor con el que arranca el SSR).

function renderLinea(content: SiteContentData, opts: { preview?: boolean } = {}): string {
  const arbol = React.createElement(SiteContentProvider, { value: content, children: React.createElement(SubscriptionCTALinea) });
  return renderToStaticMarkup(opts.preview ? React.createElement(PreviewProvider, { children: arbol }) : arbol);
}

// ─── EL MODELO ──────────────────────────────────────────────────────────────────────────────────

test('REGISTRY.subscriptionCTA.imagenes nombra `imagenFondo` — si no, el borrado de blobs (imagenesDe) la pierde en silencio', () => {
  assert.deepEqual(REGISTRY.subscriptionCTA.imagenes, ['imagenFondo']);
});

test('REGISTRY.subscriptionCTA.campos.imagenFondo es OPCIONAL (vacío = fondo sólido, no un default fabricado)', () => {
  assert.equal(REGISTRY.subscriptionCTA.campos.imagenFondo, 'opcional');
});

test('DEFAULTS.subscriptionCTA.imagenFondo nace VACÍO (byte-idéntico para Nayoli)', () => {
  assert.equal(DEFAULTS.subscriptionCTA.imagenFondo, '');
});

test('subscriptionCTA.imagenFondo tiene CONTROL de panel (sin exención en PENDIENTE_PANEL)', () => {
  assert.ok(camposControladosPorPanel().includes('subscriptionCTA.imagenFondo'));
});

// ─── EL RENDER — SIN imagen: el fondo sólido de hoy, byte-idéntico ────────────────────────────────

test('SIN imagenFondo (los DEFAULTS, Nayoli): rinde el fondo SÓLIDO de hoy — sin <img>, sin velo, sin --sf-velo', () => {
  const html = renderLinea(DEFAULTS as unknown as SiteContentData);
  assert.ok(html.includes('bg-[var(--sf-banda,var(--sf-tinta-2))]'), 'el fondo sólido de hoy debe seguir en la clase de la sección');
  assert.ok(!html.includes('<img'), 'sin imagenFondo, ningún <img> de fondo debe rendir');
  assert.ok(!html.includes('--sf-velo'), 'sin imagenFondo, el velo no debe montarse en absoluto');
});

test('SIN imagenFondo: el contenido (gancho, título, botón) rinde igual que antes de este slice', () => {
  const html = renderLinea(DEFAULTS as unknown as SiteContentData);
  assert.ok(html.includes(DEFAULTS.subscriptionCTA.titulo));
  assert.ok(html.includes(DEFAULTS.subscriptionCTA.ctaLabel));
});

// ─── EL RENDER — CON imagen: velo desde --sf-velo, parallax, imagen a sangre completa ─────────────

test('CON imagenFondo: rinde el <img> a sangre completa y dos capas de velo, la de --sf-velo NO es un literal rgba', () => {
  const content = { ...DEFAULTS, subscriptionCTA: { ...DEFAULTS.subscriptionCTA, imagenFondo: '/images/historia-4-v1.jpg' } } as SiteContentData;
  const html = renderLinea(content);
  // next/image reescribe el src a través de `/_next/image?url=...`; la ruta original sobrevive
  // url-encoded dentro de esa query.
  assert.ok(html.includes('url=%2Fimages%2Fhistoria-4-v1.jpg'), 'la imagen de fondo debe rendir su src');
  assert.ok(html.includes('data-nimg="fill"'), 'la imagen debe usar `fill` — a sangre completa, no un tamaño fijo');
  assert.ok(html.includes('object-cover'), 'la imagen debe cubrir su caja a sangre completa');
  // El velo REUSA el token, no un rgba/hex nuevo: la clase arbitraria de Tailwind conserva el
  // `var(--sf-velo)` literal en el atributo `class`.
  assert.ok(html.includes('var(--sf-velo)'), 'el velo debe leer el token --sf-velo, no un color inventado');
  assert.ok(!/rgba\(/.test(html), 'ningún rgba(...) horneado — el degradado sólo usa tokens del sistema');
});

test('CON imagenFondo: la sección deja de llevar la clase del fondo sólido (una foto y un color sólido a la vez sería doble fondo)', () => {
  const content = { ...DEFAULTS, subscriptionCTA: { ...DEFAULTS.subscriptionCTA, imagenFondo: '/images/historia-4-v1.jpg' } } as SiteContentData;
  const html = renderLinea(content);
  assert.ok(!html.includes('bg-[var(--sf-banda,var(--sf-tinta-2))]'));
});

test('SubscriptionCTABloque (la variante canónica) NO importa ni lee `imagenFondo` — la capacidad es sólo de "linea"', () => {
  const bloquePath = path.join(fileURLToPath(new URL('.', import.meta.url)), '../../components/storefront/home/SubscriptionCTABloque.tsx');
  const src = readFileSync(bloquePath, 'utf8');
  assert.ok(!src.includes('imagenFondo'));
});

// ─── EL GATE ESTÁTICO — preview (proxy de movimiento reducido): la imagen queda QUIETA ────────────

test('EN PREVIEW (proxy de movimiento reducido): el parallax queda en 0%, sin desplazamiento', () => {
  const content = { ...DEFAULTS, subscriptionCTA: { ...DEFAULTS.subscriptionCTA, imagenFondo: '/images/historia-4-v1.jpg' } } as SiteContentData;
  const html = renderLinea(content, { preview: true });
  assert.ok(html.includes('0%'), 'bajo el gate estático, el parallax debe rendir su forma QUIETA (0%)');
  assert.ok(!/-?\d\.\d\d%/.test(html.replace('0%', '')), 'ningún desplazamiento con decimales debe sobrevivir al gate estático');
});

test('SIN el gate estático (SSR, sin scroll real: progreso arranca en 0): el parallax arranca en 5.00% ((0-0.5)*-10)', () => {
  const content = { ...DEFAULTS, subscriptionCTA: { ...DEFAULTS.subscriptionCTA, imagenFondo: '/images/historia-4-v1.jpg' } } as SiteContentData;
  const html = renderLinea(content);
  assert.ok(html.includes('5.00%'), 'a progreso=0, sin el gate estático, el parallax debe arrancar en 5.00%');
});
