import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import HeroMedia from '@/components/storefront/home/HeroMedia';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';

import { DEFAULTS, type SiteContentData } from './site-content-defaults';

// CORTE-HERO-PIE-POSICION-1 — el eslabón (e) de los seis (2026-09-23). MEDIDO contra el código antes
// de tocar nada: `HeroMedia` YA posiciona la frase (`.hero-caption`) abajo-derecha (`ml-auto`,
// `text-right`, `max-w-[34ch]`) y el cue (`.scroll-cue`) abajo-izquierda (línea 56×1 + palabra encima)
// — las dos calzan el prototipo (`docs/prototipos/cafeone/index.html:133-137`). Lo que el owner vio
// "del lado equivocado" era el SUBTÍTULO ocupando ese lugar, ya cerrado por
// CORTE-HERO-TITULAR-OCULTABLE-1. El ÚNICO delta de estilo contra `.scroll-cue`
// (`docs/prototipos/cafeone/css/app.css:385-391`, `css/tokens.css:127` `--tracking-eyebrow:.11em`,
// sin `font-weight` propio = regular): la palabra "Desliza" usaba `tracking-[0.2em]`/`font-medium` en
// vez de `.11em`/regular. Este archivo AFIRMA las dos cosas: lo que ya calzaba (frase, estructura del
// cue) y lo único que se corrigió (el tracking/peso de la palabra).

function renderHeroMedia(content: SiteContentData): string {
  const arbol = React.createElement(SiteContentProvider, { value: content, children: React.createElement(HeroMedia) });
  return renderToStaticMarkup(arbol);
}

function spanDesliza(html: string): string {
  const match = html.match(/<span[^>]*>Desliza<\/span>/);
  assert.ok(match, 'el cue "Desliza" debe estar presente en el HTML');
  return match![0];
}

// ─── EL CUE — tracking .11em (no .2em), sans/regular, verbatim `.scroll-cue` ───────────────────

test('cueDesliza:true — el span "Desliza" usa tracking-[0.11em] (el --tracking-eyebrow del prototipo), no tracking-[0.2em]', () => {
  const content = { ...DEFAULTS, hero: { ...DEFAULTS.hero, cueDesliza: true } } as SiteContentData;
  const html = renderHeroMedia(content);
  const span = spanDesliza(html);
  assert.ok(span.includes('tracking-[0.11em]'), `esperaba tracking-[0.11em] en: ${span}`);
  assert.ok(!span.includes('tracking-[0.2em]'), `no debería seguir en tracking-[0.2em]: ${span}`);
});

test('cueDesliza:true — el span "Desliza" es font-normal (peso regular, el default de .scroll-cue), no font-medium', () => {
  const content = { ...DEFAULTS, hero: { ...DEFAULTS.hero, cueDesliza: true } } as SiteContentData;
  const html = renderHeroMedia(content);
  const span = spanDesliza(html);
  assert.ok(span.includes('font-normal'), `esperaba font-normal en: ${span}`);
  assert.ok(!span.includes('font-medium'), `no debería seguir en font-medium: ${span}`);
});

test('cueDesliza:false (default) — sin cue: byte-idéntico, ningún tracking-[0.11em] en el HTML', () => {
  assert.equal(DEFAULTS.hero.cueDesliza, false);
  const html = renderHeroMedia(DEFAULTS);
  assert.ok(!html.includes('data-hero-cue'));
  assert.ok(!html.includes('tracking-[0.11em]'));
});

// ─── LA FRASE — YA calzaba el prototipo (medido); este test lo AFIRMA, no lo cambia ────────────

test('fraseAlPie con contenido — sale ml-auto/text-right/max-w-[34ch] (ya calzaba .hero-caption, sin tocar)', () => {
  const content = { ...DEFAULTS, hero: { ...DEFAULTS.hero, fraseAlPie: 'Una finca, una historia.' } } as SiteContentData;
  const html = renderHeroMedia(content);
  const match = html.match(/<p[^>]*>Una finca, una historia\.<\/p>/);
  assert.ok(match, 'la frase al pie debe rendir en un <p>');
  const p = match![0];
  assert.ok(p.includes('ml-auto'), `esperaba ml-auto en: ${p}`);
  assert.ok(p.includes('text-right'), `esperaba text-right en: ${p}`);
  assert.ok(p.includes('max-w-[34ch]'), `esperaba max-w-[34ch] en: ${p}`);
});

test('fraseAlPie vacío (default) — se omite, byte-idéntico', () => {
  assert.equal(DEFAULTS.hero.fraseAlPie, '');
  const html = renderHeroMedia(DEFAULTS);
  assert.ok(!html.includes('max-w-[34ch]'));
});
