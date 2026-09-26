import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import HeroMedia from '@/components/storefront/home/HeroMedia';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';

import { DEFAULTS, resolverSiteContent, type SiteContentData } from './site-content-defaults';
import {
  PLIEGO, CORTE, PATIO, VETA, VITRINA, ARRANQUE, PRESETS,
  mergePresetEnContent, validarPreset, presetCompleto,
} from './themes';
import { contenidoConPresetDeVista } from './theme-mirador';

// CORTE-HERO-VIEWPORT-LLENO-1 — `hero.alturaLlena`, ESPEJO EXACTO de `hero.titularVisible` en
// mecánica (§ CORTE-HERO-TITULAR-OCULTABLE-1, TEMAS-HERO-MEDIA-AGREGADOS-1, TEMAS-HERO-TOGGLES-
// PRESET-1). El owner, gateando `?tema=CORTE` contra el prototipo (2026-09-23): «el hero no llena la
// pantalla: termina antes del borde inferior y asoma debajo la foto velada de la marquesina». El
// `.hero` del prototipo (`docs/prototipos/cafeone/css/app.css:358-362`) es
// `height:calc(100vh - (var(--frame-gap) * 2))` con `min-height:640px` — el viewport COMPLETO —, así
// que CORTE apaga el `min-h-[92vh]` de HOY a favor de `min-h-[100svh]` (§ el docstring de
// `HeroContent.alturaLlena`: `svh`, no `vh`/`dvh` — no corta y no salta en móvil). Sólo `HeroMedia`
// lee este campo (curtina y ficha no); este archivo renderiza `HeroMedia` directo, como su docstring
// lo declara.

function renderHeroMedia(content: SiteContentData): string {
  const arbol = React.createElement(SiteContentProvider, { value: content, children: React.createElement(HeroMedia) });
  return renderToStaticMarkup(arbol);
}

// ─── EL MODELO — default false, byte-idéntico ──────────────────────────────────────────────────

test('DEFAULTS.hero: alturaLlena nace en false — el hero de HOY (min-h-[92vh])', () => {
  assert.equal(DEFAULTS.hero.alturaLlena, false);
});

test('resolverSiteContent({}) — sin fila, alturaLlena resuelve a false (byte-idéntico)', () => {
  const nayoli = resolverSiteContent({});
  assert.equal(nayoli.hero.alturaLlena, false);
});

// ─── EL PRESET — CORTE declara heroAlturaLlena, y es el ÚNICO ──────────────────────────────────

test('CORTE declara heroAlturaLlena:true — sigue validando COMPLETO', () => {
  assert.equal(CORTE.heroAlturaLlena, true);
  assert.deepEqual(validarPreset(CORTE), []);
  assert.ok(presetCompleto(CORTE));
});

test('CORTE es el ÚNICO preset del catálogo que declara heroAlturaLlena', () => {
  for (const preset of PRESETS) {
    if (preset.clave === 'CORTE') continue;
    assert.equal(preset.heroAlturaLlena, undefined, `${preset.clave} no debería declarar heroAlturaLlena`);
  }
});

// ─── EL MERGE — sólo CORTE escribe; los demás no tocan la sección ──────────────────────────────

test('mergePresetEnContent(_, CORTE): escribe hero.alturaLlena:true, preservando lo demás de la sección', () => {
  const antes = {
    hero: {
      visible: true,
      eyebrow: 'El eyebrow del dueño',
      titulo: 'El título que el dueño escribió',
      ctasVisibles: true,
      cueDesliza: false,
      variante: 'curtina',
    },
  };
  const despues = mergePresetEnContent(antes, CORTE);
  const hero = despues.hero as Record<string, unknown>;
  assert.equal(hero.alturaLlena, true);
  // preservado: ni el texto del dueño ni los otros toggles se tocan.
  assert.equal(hero.eyebrow, 'El eyebrow del dueño');
  assert.equal(hero.titulo, 'El título que el dueño escribió');
  assert.equal(hero.ctasVisibles, false); // CORTE también lo apaga, pero por SU propio campo
  assert.equal(hero.variante, 'sticky'); // § CORTE-USA-HERO-STICKY-1 (era 'media')
});

test('mergePresetEnContent NO toca hero.alturaLlena para un preset que no lo declara (PATIO)', () => {
  assert.equal(PATIO.heroAlturaLlena, undefined);
  const antes = { hero: { visible: true, alturaLlena: true, variante: 'curtina' } };
  const despues = mergePresetEnContent(antes, PATIO);
  const hero = despues.hero as Record<string, unknown>;
  assert.equal(hero.alturaLlena, true);
});

test('mergePresetEnContent(_, CORTE) sobre los CINCO presets restantes: ninguno agrega alturaLlena a una sección que no lo tenía', () => {
  const antes = { hero: { visible: true, variante: 'curtina' } };
  for (const preset of [PLIEGO, PATIO, VETA, VITRINA, ARRANQUE]) {
    const despues = mergePresetEnContent(antes, preset);
    const hero = despues.hero as Record<string, unknown>;
    assert.equal('alturaLlena' in hero, false, `${preset.clave} no debería escribir alturaLlena`);
  }
});

// ─── EL RENDER — HeroMedia, en memoria: la UNIDAD de viewport, no el texto ─────────────────────

test('default (false): HeroMedia usa min-h-[92vh] — el hero de HOY, byte-idéntico', () => {
  const nayoli = resolverSiteContent({});
  const html = renderHeroMedia(nayoli);
  assert.match(html, /min-h-\[92vh\]/);
  assert.doesNotMatch(html, /min-h-\[100svh\]/);
});

test('alturaLlena:true — HeroMedia usa min-h-[100svh], NO min-h-[92vh]', () => {
  const content = {
    ...DEFAULTS,
    hero: { ...DEFAULTS.hero, alturaLlena: true },
  } as SiteContentData;
  const html = renderHeroMedia(content);
  assert.match(html, /min-h-\[100svh\]/);
  assert.doesNotMatch(html, /min-h-\[92vh\]/);
});

// ─── EL MIRADOR (`?tema=CORTE`) — LA INVARIANTE: Nayoli no cambia; sólo CORTE ──────────────────

test('LA INVARIANTE: sin ?tema= (Nayoli), el hero rinde con min-h-[92vh] — el default de HOY', () => {
  const nayoli = resolverSiteContent({});
  assert.equal(nayoli.hero.alturaLlena, false);

  const sinTema = contenidoConPresetDeVista(nayoli, undefined);
  assert.equal(sinTema, nayoli, 'byte-idéntico: la misma referencia, ni un campo tocado');

  const html = renderHeroMedia(sinTema);
  assert.match(html, /min-h-\[92vh\]/);
});

test('?tema=CORTE sobre Nayoli: el hero pasa a sticky (§ CORTE-USA-HERO-STICKY-1, era media) con min-h-[100svh] (viewport completo)', () => {
  const nayoli = resolverSiteContent({});
  const conCorte = contenidoConPresetDeVista(nayoli, 'CORTE');
  assert.equal(conCorte.hero.variante, 'sticky');
  assert.equal(conCorte.hero.alturaLlena, true);

  const html = renderHeroMedia(conCorte);
  assert.match(html, /min-h-\[100svh\]/);
  assert.doesNotMatch(html, /min-h-\[92vh\]/);
});

test('?tema=CORTE preserva el copy del hero que un tenant ya hubiera cargado — sólo cambia variante/alturaLlena', () => {
  const conDatos = {
    ...DEFAULTS,
    hero: { ...DEFAULTS.hero, titulo: 'Mi propio título', subtitulo: 'Mi propio subtítulo', variante: 'curtina' as const },
  } as SiteContentData;
  const conCorte = contenidoConPresetDeVista(conDatos, 'CORTE');
  assert.equal(conCorte.hero.titulo, 'Mi propio título');
  assert.equal(conCorte.hero.subtitulo, 'Mi propio subtítulo');
  assert.equal(conCorte.hero.alturaLlena, true);
});
