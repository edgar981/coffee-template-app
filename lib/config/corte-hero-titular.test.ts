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

// CORTE-HERO-TITULAR-OCULTABLE-1 — `hero.titularVisible`/`hero.subtituloVisible`, ESPEJO EXACTO de
// `hero.ctasVisibles` en mecánica (§ TEMAS-HERO-MEDIA-AGREGADOS-1, TEMAS-HERO-TOGGLES-PRESET-1). El
// `.hero-inner` del prototipo (`docs/prototipos/cafeone/index.html:130-138`) no lleva eyebrow,
// titular ni subtítulo — sólo el video de fondo, `.hero-caption` (`fraseAlPie`) y `.scroll-cue`
// (`cueDesliza`) — así que CORTE apaga los dos. Sólo `HeroMedia` lee estos dos campos (curtina y
// ficha no); este archivo renderiza `HeroMedia` directo, como su docstring lo declara.

function renderHeroMedia(content: SiteContentData): string {
  const arbol = React.createElement(SiteContentProvider, { value: content, children: React.createElement(HeroMedia) });
  return renderToStaticMarkup(arbol);
}

// ─── EL MODELO — default true, byte-idéntico ───────────────────────────────────────────────────

test('DEFAULTS.hero: titularVisible y subtituloVisible nacen en true — el hero de HOY', () => {
  assert.equal(DEFAULTS.hero.titularVisible, true);
  assert.equal(DEFAULTS.hero.subtituloVisible, true);
});

test('resolverSiteContent({}) — sin fila, los dos toggles resuelven a true (byte-idéntico)', () => {
  const nayoli = resolverSiteContent({});
  assert.equal(nayoli.hero.titularVisible, true);
  assert.equal(nayoli.hero.subtituloVisible, true);
});

// ─── EL PRESET — CORTE declara los dos, y es el ÚNICO ──────────────────────────────────────────

test('CORTE declara heroTitularVisible:false y heroSubtituloVisible:false — sigue validando COMPLETO', () => {
  assert.equal(CORTE.heroTitularVisible, false);
  assert.equal(CORTE.heroSubtituloVisible, false);
  assert.deepEqual(validarPreset(CORTE), []);
  assert.ok(presetCompleto(CORTE));
});

test('CORTE es el ÚNICO preset del catálogo que declara heroTitularVisible/heroSubtituloVisible', () => {
  for (const preset of PRESETS) {
    if (preset.clave === 'CORTE') continue;
    assert.equal(preset.heroTitularVisible, undefined, `${preset.clave} no debería declarar heroTitularVisible`);
    assert.equal(preset.heroSubtituloVisible, undefined, `${preset.clave} no debería declarar heroSubtituloVisible`);
  }
});

// ─── EL MERGE — sólo CORTE escribe; los demás no tocan la sección ──────────────────────────────

test('mergePresetEnContent(_, CORTE): escribe hero.titularVisible:false y hero.subtituloVisible:false, preservando lo demás de la sección', () => {
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
  assert.equal(hero.titularVisible, false);
  assert.equal(hero.subtituloVisible, false);
  // preservado: ni el texto del dueño ni los otros dos toggles se tocan.
  assert.equal(hero.eyebrow, 'El eyebrow del dueño');
  assert.equal(hero.titulo, 'El título que el dueño escribió');
  assert.equal(hero.ctasVisibles, false); // CORTE también los apaga, pero por SU propio campo
  assert.equal(hero.cueDesliza, true);
  assert.equal(hero.variante, 'media');
});

test('mergePresetEnContent NO toca hero.titularVisible/hero.subtituloVisible para un preset que no los declara (PATIO)', () => {
  assert.equal(PATIO.heroTitularVisible, undefined);
  assert.equal(PATIO.heroSubtituloVisible, undefined);
  const antes = { hero: { visible: true, titularVisible: true, subtituloVisible: false, variante: 'curtina' } };
  const despues = mergePresetEnContent(antes, PATIO);
  const hero = despues.hero as Record<string, unknown>;
  assert.equal(hero.titularVisible, true);
  assert.equal(hero.subtituloVisible, false);
});

test('mergePresetEnContent(_, CORTE) sobre los CINCO presets restantes: ninguno agrega titularVisible/subtituloVisible a una sección que no los tenía', () => {
  const antes = { hero: { visible: true, variante: 'curtina' } };
  for (const preset of [PLIEGO, PATIO, VETA, VITRINA, ARRANQUE]) {
    const despues = mergePresetEnContent(antes, preset);
    const hero = despues.hero as Record<string, unknown>;
    assert.equal('titularVisible' in hero, false, `${preset.clave} no debería escribir titularVisible`);
    assert.equal('subtituloVisible' in hero, false, `${preset.clave} no debería escribir subtituloVisible`);
  }
});

// ─── EL RENDER — HeroMedia, en memoria ─────────────────────────────────────────────────────────

test('default (true/true): HeroMedia renderiza titulo, tituloEnfasis y subtitulo — el hero de HOY', () => {
  const nayoli = resolverSiteContent({});
  const html = renderHeroMedia(nayoli);
  assert.ok(html.includes(DEFAULTS.hero.titulo));
  assert.ok(html.includes(DEFAULTS.hero.tituloEnfasis));
  assert.ok(html.includes(DEFAULTS.hero.subtitulo));
});

test('titularVisible:false, subtituloVisible:true — HeroMedia omite titulo/tituloEnfasis, conserva subtitulo', () => {
  const content = {
    ...DEFAULTS,
    hero: { ...DEFAULTS.hero, titularVisible: false, subtituloVisible: true },
  } as SiteContentData;
  const html = renderHeroMedia(content);
  assert.ok(!html.includes(DEFAULTS.hero.titulo), 'sin titulo con titularVisible:false');
  assert.ok(!html.includes(DEFAULTS.hero.tituloEnfasis), 'sin tituloEnfasis con titularVisible:false');
  assert.ok(html.includes(DEFAULTS.hero.subtitulo), 'subtitulo se conserva: apagador PROPIO');
});

test('titularVisible:true, subtituloVisible:false — HeroMedia conserva titulo/tituloEnfasis, omite subtitulo', () => {
  const content = {
    ...DEFAULTS,
    hero: { ...DEFAULTS.hero, titularVisible: true, subtituloVisible: false },
  } as SiteContentData;
  const html = renderHeroMedia(content);
  assert.ok(html.includes(DEFAULTS.hero.titulo), 'titulo se conserva: apagador PROPIO');
  assert.ok(html.includes(DEFAULTS.hero.tituloEnfasis), 'tituloEnfasis se conserva: apagador PROPIO');
  assert.ok(!html.includes(DEFAULTS.hero.subtitulo), 'sin subtitulo con subtituloVisible:false');
});

test('titularVisible:false y subtituloVisible:false — HeroMedia sin titular ni subtítulo (el hero-media del prototipo)', () => {
  const content = {
    ...DEFAULTS,
    hero: { ...DEFAULTS.hero, titularVisible: false, subtituloVisible: false },
  } as SiteContentData;
  const html = renderHeroMedia(content);
  assert.ok(!html.includes(DEFAULTS.hero.titulo));
  assert.ok(!html.includes(DEFAULTS.hero.tituloEnfasis));
  assert.ok(!html.includes(DEFAULTS.hero.subtitulo));
  // el resto del hero-media sigue vivo: eyebrow, frase al pie y CTA no dependen de estos dos toggles.
  assert.ok(html.includes(DEFAULTS.hero.eyebrow));
});

// ─── EL MIRADOR (`?tema=CORTE`) — LA INVARIANTE: Nayoli no cambia; sólo CORTE ──────────────────

test('LA INVARIANTE: sin ?tema= (Nayoli), el hero rinde con titular y subtítulo — el default de HOY', () => {
  const nayoli = resolverSiteContent({});
  assert.equal(nayoli.hero.titularVisible, true);
  assert.equal(nayoli.hero.subtituloVisible, true);

  const sinTema = contenidoConPresetDeVista(nayoli, undefined);
  assert.equal(sinTema, nayoli, 'byte-idéntico: la misma referencia, ni un campo tocado');

  const html = renderHeroMedia(sinTema);
  assert.ok(html.includes(DEFAULTS.hero.titulo));
  assert.ok(html.includes(DEFAULTS.hero.subtitulo));
});

test('?tema=CORTE sobre Nayoli: el hero pasa a media SIN titular ni subtítulo', () => {
  const nayoli = resolverSiteContent({});
  const conCorte = contenidoConPresetDeVista(nayoli, 'CORTE');
  assert.equal(conCorte.hero.variante, 'media');
  assert.equal(conCorte.hero.titularVisible, false);
  assert.equal(conCorte.hero.subtituloVisible, false);

  const html = renderHeroMedia(conCorte);
  assert.ok(!html.includes(DEFAULTS.hero.titulo), 'sin titulo bajo CORTE');
  assert.ok(!html.includes(DEFAULTS.hero.tituloEnfasis), 'sin tituloEnfasis bajo CORTE');
  assert.ok(!html.includes(DEFAULTS.hero.subtitulo), 'sin subtitulo bajo CORTE');
});

test('?tema=CORTE preserva el copy del hero que un tenant ya hubiera cargado — sólo cambia variante/titularVisible/subtituloVisible', () => {
  const conDatos = {
    ...DEFAULTS,
    hero: { ...DEFAULTS.hero, titulo: 'Mi propio título', subtitulo: 'Mi propio subtítulo', variante: 'curtina' as const },
  } as SiteContentData;
  const conCorte = contenidoConPresetDeVista(conDatos, 'CORTE');
  assert.equal(conCorte.hero.titulo, 'Mi propio título');
  assert.equal(conCorte.hero.subtitulo, 'Mi propio subtítulo');
  assert.equal(conCorte.hero.titularVisible, false);
  assert.equal(conCorte.hero.subtituloVisible, false);
});
