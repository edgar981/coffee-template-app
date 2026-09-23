import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import HeroSection from '@/components/storefront/home/HeroSection';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { PreviewProvider } from '@/components/storefront/PreviewMode';

import { DEFAULTS, REGISTRY, resolverSiteContent, type HeroContent } from './site-content-defaults';
import { siteContentEditableSchema } from './site-content-schema';

// TEMAS-HERO-MEDIA-AGREGADOS-1 — tres agregados chicos al hero-media del prototipo que
// `HeroMedia.tsx` no tenía (`docs/prototipos/cafeone/index.html:122-138`, `.hero-caption`/
// `.scroll-cue`): CTAs ocultables (`hero.ctasVisibles`), la frase al pie como dato
// (`hero.fraseAlPie`) y el cue animado de "Desliza" (`hero.cueDesliza`). LOS TRES OPT-IN, default =
// el hero-media de HOY — la INVARIANTE que este archivo existe para afirmar: sin encender nada,
// `HeroMedia` (vía el dispatcher real `HeroSection`) rinde EXACTAMENTE el marcado de hoy.

// ─── EL MODELO PURO — REGISTRY/DEFAULTS/resolver ────────────────────────────────────────────────

test('REGISTRY.hero declara los DOS booleanos de esta tanda, y `fraseAlPie` como campo opcional', () => {
  // `.includes`, no `deepEqual` contra el array completo: § CORTE-HERO-TITULAR-OCULTABLE-1 sumó
  // `titularVisible`/`subtituloVisible` al MISMO `booleanos` — el comentario de esa lista en
  // `site-content-defaults.ts` ya lo declara genérico ("para el próximo booleano de sección que
  // aparezca"), así que esta invariante afirma que los DOS de esta tanda siguen ahí, no que sean
  // los únicos.
  assert.ok(REGISTRY.hero.booleanos?.includes('ctasVisibles'));
  assert.ok(REGISTRY.hero.booleanos?.includes('cueDesliza'));
  assert.equal(REGISTRY.hero.campos.fraseAlPie, 'opcional');
});

test('DEFAULTS.hero: los tres agregados nacen en su valor de HOY (byte-idéntico) — ctasVisibles true, fraseAlPie vacía, cueDesliza false', () => {
  assert.equal(DEFAULTS.hero.ctasVisibles, true);
  assert.equal(DEFAULTS.hero.fraseAlPie, '');
  assert.equal(DEFAULTS.hero.cueDesliza, false);
});

test('resolverSiteContent({}): sin fila, los tres agregados resuelven al default de HOY', () => {
  const r = resolverSiteContent({});
  assert.equal(r.hero.ctasVisibles, true);
  assert.equal(r.hero.fraseAlPie, '');
  assert.equal(r.hero.cueDesliza, false);
});

test('ctasVisibles/cueDesliza: sólo un booleano EXPLÍCITO guardado sobreescribe — basura cae al default, mismo mecanismo que `visible`', () => {
  assert.equal(resolverSiteContent({ hero: { ctasVisibles: false } }).hero.ctasVisibles, false);
  assert.equal(resolverSiteContent({ hero: { ctasVisibles: 'no' } }).hero.ctasVisibles, true); // basura → default
  assert.equal(resolverSiteContent({ hero: {} }).hero.ctasVisibles, true); // ausente → default

  assert.equal(resolverSiteContent({ hero: { cueDesliza: true } }).hero.cueDesliza, true);
  assert.equal(resolverSiteContent({ hero: { cueDesliza: 'si' } }).hero.cueDesliza, false); // basura → default
});

test('fraseAlPie: OPCIONAL — presente (aun vacía) se respeta; ausente cae al default', () => {
  assert.equal(resolverSiteContent({ hero: { fraseAlPie: 'Hay algo meditativo en un café de altura.' } }).hero.fraseAlPie,
    'Hay algo meditativo en un café de altura.');
  assert.equal(resolverSiteContent({ hero: { fraseAlPie: '' } }).hero.fraseAlPie, ''); // presente vacía → se respeta
  assert.equal(resolverSiteContent({ hero: {} }).hero.fraseAlPie, ''); // ausente → default
});

// ─── EL SCHEMA — los tres SOBREVIVEN al parse (si no, zod los descartaría al guardar, § #65-B) ───

test('hero: `ctasVisibles`/`fraseAlPie`/`cueDesliza` SOBREVIVEN al parse', () => {
  const parsed = siteContentEditableSchema.parse({
    hero: { ctasVisibles: false, fraseAlPie: 'x', cueDesliza: true },
  });
  assert.equal(parsed.hero!.ctasVisibles, false);
  assert.equal(parsed.hero!.fraseAlPie, 'x');
  assert.equal(parsed.hero!.cueDesliza, true);
});

// ─── EL WIRING — render REAL vía el DISPATCHER (`HeroSection`), no la pieza aislada ────────────
//
// `renderToStaticMarkup`, el mismo mecanismo que ya usan `site-content-defaults.test.ts`
// (`renderGrindChooser`) y `escala-display.test.ts` (`renderConEscala`): SSR a texto, sin jsdom
// (§ CLAUDE.md, "El glob NO incluye *.test.tsx — los tests de COMPONENTE necesitan jsdom, que el
// repo no tiene"). `HeroSection` es el DISPATCHER real de `app/(storefront)/page.tsx`; con
// `hero.variante:'media'` enruta a `HeroMedia`, así que esto ejercita el mismo árbol que sirve el
// mirador de CORTE, no una copia.
function renderHeroMedia(hero: HeroContent, opts: { preview?: boolean } = {}): string {
  const content = { ...DEFAULTS, hero };
  const arbol = React.createElement(SiteContentProvider, {
    value: content,
    children: React.createElement(HeroSection),
  });
  return renderToStaticMarkup(opts.preview ? React.createElement(PreviewProvider, { children: arbol }) : arbol);
}

const nEnlaces = (html: string) => (html.match(/<a /g) || []).length;

test('LA INVARIANTE: HeroMedia con los tres agregados en su default rinde EXACTAMENTE el hero de HOY — dos CTA, sin frase, sin cue', () => {
  const html = renderHeroMedia({ ...DEFAULTS.hero, variante: 'media' });
  assert.equal(nEnlaces(html), 2, 'los dos CTA de siempre (primario + secundario)');
  assert.ok(html.includes(DEFAULTS.hero.ctaPrimarioLabel));
  assert.ok(html.includes(DEFAULTS.hero.ctaSecundarioLabel));
  assert.ok(!html.includes('data-hero-cue'), 'sin el cue: default cueDesliza=false');
  assert.ok(!html.includes('Desliza'), 'la etiqueta del cue no debe aparecer');
});

test('agregado (a) — ctasVisibles:false OCULTA los dos CTA juntos (no uno sí y otro no)', () => {
  const conCtas = renderHeroMedia({ ...DEFAULTS.hero, variante: 'media', ctasVisibles: true });
  assert.equal(nEnlaces(conCtas), 2);

  const sinCtas = renderHeroMedia({ ...DEFAULTS.hero, variante: 'media', ctasVisibles: false });
  assert.equal(nEnlaces(sinCtas), 0, 'CERO <a>: los dos CTA desaparecen juntos');
  assert.ok(!sinCtas.includes(DEFAULTS.hero.ctaPrimarioLabel));
  assert.ok(!sinCtas.includes(DEFAULTS.hero.ctaSecundarioLabel));
});

test('agregado (b) — fraseAlPie ausente/vacía NO renderiza nada; con texto, aparece', () => {
  const sinFrase = renderHeroMedia({ ...DEFAULTS.hero, variante: 'media' });
  assert.ok(!sinFrase.includes('Hay algo profundamente meditativo'));

  const FRASE = 'Hay algo profundamente meditativo en preparar un café cultivado a 1.600 msnm.';
  const conFrase = renderHeroMedia({ ...DEFAULTS.hero, variante: 'media', fraseAlPie: FRASE });
  assert.ok(conFrase.includes(FRASE));
});

test('agregado (c) — cueDesliza:true muestra la línea animada + la etiqueta "Desliza"', () => {
  const html = renderHeroMedia({ ...DEFAULTS.hero, variante: 'media', cueDesliza: true });
  assert.ok(html.includes('data-hero-cue="desliza"'));
  assert.match(html, /<span[^>]*>Desliza<\/span>/);
});

test('agregado (c) — el cue se OMITE en PREVIEW, mismo criterio que el indicador de HeroCurtina (scrollear no significa nada en un marco de vista previa)', () => {
  const htmlPreview = renderHeroMedia({ ...DEFAULTS.hero, variante: 'media', cueDesliza: true }, { preview: true });
  assert.ok(!htmlPreview.includes('data-hero-cue'), 'en preview, el cue no debe renderizar aunque cueDesliza sea true');
});

test('los tres agregados son EXCLUSIVOS de `media`: la curtina (canónica/Nayoli) no los lee — su render no cambia si se le setean', () => {
  // HeroCurtina no destructura ctasVisibles/fraseAlPie/cueDesliza de `hero`, así que setearlos no
  // debe mover una sola línea de su HTML frente al mismo hero sin esos tres campos.
  const base = { ...DEFAULTS.hero, variante: 'curtina' } as HeroContent;
  const conAgregados = { ...base, ctasVisibles: false, fraseAlPie: 'x', cueDesliza: true } as HeroContent;
  assert.equal(renderHeroMedia(base), renderHeroMedia(conAgregados));
});

// ─── REDUCED MOTION — el cue usa el mecanismo COMÚN (`ReducedMotionProvider`), no un guard propio ─
//
// No hay jsdom/matchMedia en este carril (§ arriba), así que la conducta de `MotionConfig
// reducedMotion="user"` bajo `prefers-reduced-motion` NO es observable por render en Node — es
// runtime de navegador. Lo que SÍ es verificable, en la FUENTE, es que el mecanismo elegido es el
// que ese provider realmente congela (§ `lib/animation.ts`: sólo un valor de TRANSFORM —x, y,
// scale, rotate— se vuelve instantáneo bajo `reducedMotion="user"`) y que el componente NO inventa
// un segundo guard (`useReducedMotion()`/`reduce`) para el cue — mismo patrón que
// `palette-derive.test.ts` lee `app/globals.css` para afirmar un valor declarado, no rendereado.
test('el cue anima `y` (un TRANSFORM) en un `motion.span` — el valor que `ReducedMotionProvider` congela bajo reduced-motion, sin guard propio', () => {
  const heroMediaPath = path.join(fileURLToPath(new URL('.', import.meta.url)), '../../components/storefront/home/HeroMedia.tsx');
  const src = readFileSync(heroMediaPath, 'utf8');

  // El bloque del cue: desde `data-hero-cue` hasta su cierre, para acotar la búsqueda al elemento
  // correcto (no a cualquier `motion.span`/`animate` del archivo — HeroMedia no tiene otro).
  const inicioCue = src.indexOf('data-hero-cue');
  assert.ok(inicioCue > -1, 'el cue debe declarar su marcador `data-hero-cue`');
  const bloqueCue = src.slice(inicioCue, inicioCue + 800);

  assert.match(bloqueCue, /motion\.span/, 'el segmento animado debe ser un componente `motion.*` (para que MotionConfig lo alcance)');
  assert.match(bloqueCue, /animate=\{\{\s*y:/, 'debe animar `y` (TRANSFORM) — animar `top`/`left` no lo congelaría MotionConfig');
  assert.doesNotMatch(bloqueCue, /reduce\b/, 'no debe leer la variable `reduce`/`useReducedMotion()` local: el guard es el provider global, no uno propio');
});
