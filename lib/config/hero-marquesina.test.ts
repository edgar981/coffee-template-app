import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import HeroSection from '@/components/storefront/home/HeroSection';
import HeroMediaMarquesina from '@/components/storefront/home/HeroMediaMarquesina';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { PreviewProvider } from '@/components/storefront/PreviewMode';

import {
  DEFAULTS,
  REGISTRY,
  bandaOscuraCanonica,
  bandaUniforme,
  resolverSiteContent,
  resolverVariante,
  type SiteContentData,
} from './site-content-defaults';

// MUESTRARIO-HERO-MARQUESINA-STICKY-1 — la CUARTA variante del hero (tras curtina/ficha/media,
// § HeroSection.tsx): el hero y la marquesina dejan de ser DOS bandas apiladas y pasan a ser UNA
// composición, con el hero pineado (`position:sticky`) mientras el texto del marquee y la tarjeta
// del producto pasan POR ENCIMA de su media — MEDIDO contra el tema real
// (`https://x-cafeone.myshopify.com/`, sección `hero_banner_marquee`), NO contra
// `docs/prototipos/cafeone/` (que DERIVA de ese tema: su `.marquee` es una banda APARTE, la forma
// de dos bandas apiladas que el owner reportó como mala). Ver el docstring de cabecera de
// `HeroMediaMarquesina.tsx` para la mecánica completa (el ancestro no-pineado que da el presupuesto
// de scroll, por qué el progreso se mide contra él y no contra la `<section>` pineada, etc.).
//
// LA CLAVE DE LA VARIANTE ES `'sticky'`, NO `'marquesina'` — DESVÍO MEDIDO (§ el docstring de
// `HeroSection.tsx`/`site-content-defaults.ts`): `'marquesina'` ya está reservado en
// `PLIEGO.variantes.hero` (themes.ts) como placeholder de una composición AJENA (el diseño
// "Pliego"), y `themes.test.ts` (fuera de `touches:` de este slice) afirma que ese pedido de PLIEGO
// debe seguir fallando la validación por nombre. Usar 'marquesina' acá lo habría vuelto válido por
// accidente. La SECCIÓN de contenido que este componente lee SÍ sigue llamándose `marquesina`
// (`texto`/`productoSlug`, sin cambios) — es sólo la CLAVE DE VARIANTE la que es 'sticky'.
//
// ESTE ARCHIVO AFIRMA: (1) el modelo — la nueva clave entra al set cerrado de `hero.variantes` sin
// tocar la canónica; (2) el render — la variante lee `marquesina.texto`/`.productoSlug` (NUNCA un
// campo propio del hero — el spec pidió reusar el dato existente, no duplicarlo), el velo sale del
// token `--sf-velo` (nunca un rgba horneado), y el pin es hide-on-empty de UN elemento, como en
// `Marquesina.tsx`; (3) el DISPATCHER (`HeroSection.tsx`) enruta `variante:'sticky'` a este
// componente y deja intactas curtina/ficha/media; (4) movimiento reducido: el texto queda quieto,
// como en `Marquesina.tsx` (mismo gate, mismas funciones puras de `lib/animation.ts`, sin una sola
// línea de motor nueva); (5) Nayoli (sin fila, sin preset) sigue en la canónica 'curtina' — byte-
// idéntica, cero bytes nuevos.

function renderHeroSection(content: SiteContentData, opts: { preview?: boolean } = {}): string {
  const arbol = React.createElement(SiteContentProvider, { value: content, children: React.createElement(HeroSection) });
  return renderToStaticMarkup(opts.preview ? React.createElement(PreviewProvider, { children: arbol }) : arbol);
}

function renderHeroMediaMarquesina(content: SiteContentData, opts: { preview?: boolean } = {}): string {
  const arbol = React.createElement(SiteContentProvider, {
    value: content,
    children: React.createElement(HeroMediaMarquesina),
  });
  return renderToStaticMarkup(opts.preview ? React.createElement(PreviewProvider, { children: arbol }) : arbol);
}

// ─── EL MODELO — la clave nueva entra al set cerrado; la canónica NO cambia ───────────────────────

test('REGISTRY.hero.variantes.claves incluye "sticky", CUARTA del set; la canónica sigue siendo "curtina"', () => {
  assert.deepEqual(
    REGISTRY.hero.variantes,
    { claves: ['curtina', 'ficha', 'media', 'sticky'], canonica: 'curtina', noUniformes: ['ficha'] },
  );
});

test('resolverVariante: "sticky" se respeta; basura/ausente sigue cayendo en "curtina"', () => {
  assert.equal(resolverVariante(REGISTRY.hero.variantes!, 'sticky'), 'sticky');
  assert.equal(resolverVariante(REGISTRY.hero.variantes!, undefined), 'curtina');
  assert.equal(resolverVariante(REGISTRY.hero.variantes!, 'no-existe'), 'curtina');
});

test('DEFAULTS.hero.variante sigue siendo "curtina" — esta variante no la toca (Nayoli byte-idéntica)', () => {
  assert.equal(DEFAULTS.hero.variante, 'curtina');
});

test('hero: una `variante` guardada "sticky" se respeta a través de resolverSiteContent', () => {
  const r = resolverSiteContent({ hero: { variante: 'sticky' } });
  assert.equal(r.hero.variante, 'sticky');
});

// 'sticky' es un solo plano de media (como 'media'): oscura por canónica, uniforme (nav
// transparente-flotante), NUNCA en `noUniformes` — sólo 'ficha' (bi-tonal) está ahí.
test('hero·sticky es OSCURA por canónica y UNIFORME — mismo trato que hero·media', () => {
  assert.equal(bandaOscuraCanonica('hero', 'sticky'), true);
  assert.equal(bandaUniforme('hero', 'sticky'), true);
});

// ─── EL RENDER — lee marquesina.texto/.productoSlug, NUNCA un campo propio del hero ──────────────

test('el texto del loop viene de `marquesina.texto`, NO de ningún campo del hero (eyebrow/titulo no rinden)', () => {
  const content = {
    ...DEFAULTS,
    hero: { ...DEFAULTS.hero, variante: 'sticky' as const, eyebrow: 'ESTO NO DEBE VERSE', titulo: 'NI ESTO' },
    marquesina: { ...DEFAULTS.marquesina, texto: 'Café fresco todos los días' },
  } as SiteContentData;
  const html = renderHeroMediaMarquesina(content);
  assert.ok(html.includes('Café fresco todos los días'), 'debe rendir el texto de `marquesina.texto`');
  assert.ok(!html.includes('ESTO NO DEBE VERSE'), 'no debe rendir el eyebrow del hero');
  assert.ok(!html.includes('NI ESTO'), 'no debe rendir el titulo del hero');
});

test('el texto del loop rinde DOS VECES dentro del track (cinta continua), más la 3ª aparición del `aria-label` de la sección', () => {
  const content = { ...DEFAULTS, marquesina: { ...DEFAULTS.marquesina, texto: 'Calidad que se nota' } } as SiteContentData;
  const html = renderHeroMediaMarquesina(content);
  const apariciones = html.split('Calidad que se nota').length - 1;
  assert.equal(apariciones, 3);
  const enSpans = (html.match(/<span class="pr-8">/g) || []).length;
  assert.equal(enSpans, 2);
});

test('sin pin (`marquesina.productoSlug` vacío, el default): la tarjeta flotante NO rinde — hide-on-empty de UN elemento', () => {
  const html = renderHeroMediaMarquesina(DEFAULTS as SiteContentData);
  assert.ok(!/aspect-\[3\/4\]/.test(html), 'sin pin, no debe rendir el marcado de la tarjeta');
});

test('con `productoSlug` pero SIN catálogo real (SSR, mismo límite que `marquesina-banda.test.ts`/`spotlight-cableado.test.ts`): la tarjeta tampoco rinde', () => {
  const content = { ...DEFAULTS, marquesina: { ...DEFAULTS.marquesina, productoSlug: 'un-producto-cualquiera' } } as SiteContentData;
  const html = renderHeroMediaMarquesina(content);
  assert.ok(!/aspect-\[3\/4\]/.test(html), 'sin catálogo cargado, la tarjeta flotante no puede resolver el pin');
});

// ─── EL VELO — token `--sf-velo`, overlay PLANO (NO el gradiente de dos paradas de HeroMedia) ────

test('el velo lee `var(--sf-velo)`, NUNCA un rgba/opacidad horneada sobre `--sf-tinta`', () => {
  const html = renderHeroMediaMarquesina(DEFAULTS as SiteContentData);
  assert.match(html, /bg-\[var\(--sf-velo\)\]/);
  assert.doesNotMatch(html, /--sf-tinta\)\]\/\d/, 'no debe hornear un modificador de opacidad sobre --sf-tinta');
});

test('el velo es PLANO — una sola referencia a `--sf-velo`, no el `from/via/to` de HeroMedia.tsx', () => {
  const html = renderHeroMediaMarquesina(DEFAULTS as SiteContentData);
  const apariciones = (html.match(/var\(--sf-velo\)/g) ?? []).length;
  assert.equal(apariciones, 1, 'un solo overlay plano, no un degradado de dos paradas');
  assert.doesNotMatch(html, /bg-linear-to-b/, 'HeroMediaMarquesina no usa el gradiente de HeroMedia');
});

// ─── LA MECÁNICA STICKY — el ancestro da el presupuesto de scroll; el panel visible es el pineado ─

test('el panel visible es `sticky top-0`, a `h-[100svh]` SIEMPRE (no lee `alturaLlena`)', () => {
  const conAlturaLlenaFalse = renderHeroMediaMarquesina({ ...DEFAULTS, hero: { ...DEFAULTS.hero, alturaLlena: false } } as SiteContentData);
  const conAlturaLlenaTrue = renderHeroMediaMarquesina({ ...DEFAULTS, hero: { ...DEFAULTS.hero, alturaLlena: true } } as SiteContentData);
  for (const html of [conAlturaLlenaFalse, conAlturaLlenaTrue]) {
    assert.match(html, /sticky top-0/);
    assert.match(html, /h-\[100svh\]/);
  }
  // alturaLlena no cambia NADA del render de esta variante — mismo HTML con true o false.
  assert.equal(conAlturaLlenaFalse, conAlturaLlenaTrue);
});

test('el ancestro (root del componente) tiene el presupuesto de scroll extra — 100svh del panel + 70vh (el mismo alto que `Marquesina.tsx` ya usaba)', () => {
  const html = renderHeroMediaMarquesina(DEFAULTS as SiteContentData);
  assert.match(html, /min-h-\[calc\(100svh\+70vh\)\]/);
});

test('`cueDesliza` no emite ningún marcador — esta variante no lee el agregado de HeroMedia', () => {
  const html = renderHeroMediaMarquesina({ ...DEFAULTS, hero: { ...DEFAULTS.hero, cueDesliza: true } } as SiteContentData);
  assert.doesNotMatch(html, /data-hero-cue/);
});

// ─── MOVIMIENTO REDUCIDO (proxy: PreviewProvider, MISMO límite que `marquesina-banda.test.ts`) ───

test('EN PREVIEW (proxy de movimiento reducido): el texto queda CENTRADO y QUIETO — sin desplazamiento horizontal', () => {
  const html = renderHeroMediaMarquesina(DEFAULTS as SiteContentData, { preview: true });
  assert.ok(html.includes('transform:translateY(-50%)'), 'debe rendir el transform QUIETO bajo el gate estático');
  assert.ok(!/translate\(-?\d/.test(html), 'ningún transform de desplazamiento horizontal debe sobrevivir bajo el gate estático');
});

test('SIN el gate estático (SSR, progreso arranca en 0): el texto arranca sin desplazamiento todavía', () => {
  const html = renderHeroMediaMarquesina(DEFAULTS as SiteContentData);
  assert.ok(html.includes('transform:translate(0.0px, -50%)'));
  assert.ok(!html.includes('transform:translateY(-50%)'), 'sin el gate estático no debe rendir la forma "quieta"');
});

// ─── EL DISPATCHER — HeroSection enruta "sticky"; curtina/ficha/media quedan INTACTAS ────────────

test('HeroSection con `variante:"sticky"` enruta a HeroMediaMarquesina (rinde el panel sticky)', () => {
  const content = { ...DEFAULTS, hero: { ...DEFAULTS.hero, variante: 'sticky' as const } } as SiteContentData;
  const html = renderHeroSection(content);
  assert.match(html, /sticky top-0/);
  assert.match(html, /h-\[100svh\]/);
});

test('LA INVARIANTE — Nayoli (sin fila, canónica "curtina"): HeroSection NO rinde nada de la variante nueva', () => {
  const nayoli = resolverSiteContent({});
  assert.equal(nayoli.hero.variante, 'curtina');
  const html = renderHeroSection(nayoli);
  assert.doesNotMatch(html, /sticky top-0/);
  assert.doesNotMatch(html, /min-h-\[calc\(100svh\+70vh\)\]/);
});

test('HeroSection con `variante:"media"` sigue enrutando a HeroMedia — sin cambios por esta variante nueva', () => {
  const content = { ...DEFAULTS, hero: { ...DEFAULTS.hero, variante: 'media' as const } } as SiteContentData;
  const html = renderHeroSection(content);
  // HeroMedia usa min-h-[92vh]/[100svh], nunca el ancestro de presupuesto de scroll de la nueva variante.
  assert.doesNotMatch(html, /min-h-\[calc\(100svh\+70vh\)\]/);
  assert.doesNotMatch(html, /sticky top-0/);
});
