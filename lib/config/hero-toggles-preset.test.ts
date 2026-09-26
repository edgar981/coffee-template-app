import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import HeroSection from '@/components/storefront/home/HeroSection';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';

import { DEFAULTS, resolverSiteContent, type SiteContentData } from './site-content-defaults';
import {
  PLIEGO, CORTE, PATIO, VETA, VITRINA, ARRANQUE, PRESETS,
  mergePresetEnContent, validarPreset, presetCompleto,
} from './themes';
import { contenidoConPresetDeVista } from './theme-mirador';

// TEMAS-HERO-TOGGLES-PRESET-1 — CORTE enciende los DOS booleanos del hero-media que
// TEMAS-HERO-MEDIA-AGREGADOS-1 construyó (`hero.ctasVisibles`/`hero.cueDesliza`) A NIVEL PRESET, no
// de contenido: ese slice tocó `site-content-defaults.ts` (el modelo) pero no `themes.ts`, así que
// los dos campos existían y rendían bien pero CORTE nunca los encendía — el mirador mostraba botones
// que el prototipo no tiene (`docs/prototipos/cafeone/index.html:122-138`, `.hero-media` sin `.btn`)
// y ningún cue "Desliza" (`.scroll-cue`, `index.html:135-137`). El patrón es el MISMO que
// `bandaOrigenVisible` (§ ORIGEN-BANDA-1): un campo del `PresetTema`, consumido por
// `mergePresetEnContent`, que sólo escribe si el preset lo declara — la diferencia es que acá el
// destino NO es `visible` de una banda entera, sino dos booleanos DENTRO de una sección que ya
// existe siempre (`hero`).
//
// La FRASE al pie (`hero.fraseAlPie`) se queda CONTENIDO — ver el docstring de `PresetTema` en
// `themes.ts` — y este archivo la deja intacta explícitamente para que quede afirmado, no supuesto.

function renderHero(content: SiteContentData): string {
  const arbol = React.createElement(SiteContentProvider, { value: content, children: React.createElement(HeroSection) });
  return renderToStaticMarkup(arbol);
}

// ─── EL PRESET — CORTE declara los dos, y es el ÚNICO ──────────────────────────────────────────

test('CORTE declara heroCtasVisibles:false y heroCueDesliza:true — sigue validando COMPLETO', () => {
  assert.equal(CORTE.heroCtasVisibles, false);
  assert.equal(CORTE.heroCueDesliza, true);
  assert.deepEqual(validarPreset(CORTE), []);
  assert.ok(presetCompleto(CORTE));
});

test('CORTE es el ÚNICO preset del catálogo que declara heroCtasVisibles/heroCueDesliza', () => {
  for (const preset of PRESETS) {
    if (preset.clave === 'CORTE') continue;
    assert.equal(preset.heroCtasVisibles, undefined, `${preset.clave} no debería declarar heroCtasVisibles`);
    assert.equal(preset.heroCueDesliza, undefined, `${preset.clave} no debería declarar heroCueDesliza`);
  }
});

// ─── EL MERGE — sólo CORTE escribe; los demás no tocan la sección ──────────────────────────────

test('mergePresetEnContent(_, CORTE): escribe hero.ctasVisibles:false y hero.cueDesliza:true, preservando lo demás de la sección', () => {
  const antes = {
    hero: {
      visible: true,
      eyebrow: 'El eyebrow del dueño',
      titulo: 'El título que el dueño escribió',
      fraseAlPie: 'Una frase que el dueño ya había cargado.',
      variante: 'curtina',
    },
  };
  const despues = mergePresetEnContent(antes, CORTE);
  const hero = despues.hero as Record<string, unknown>;
  assert.equal(hero.ctasVisibles, false);
  assert.equal(hero.cueDesliza, true);
  // preservado: ni el texto del dueño ni la frase al pie se tocan.
  assert.equal(hero.eyebrow, 'El eyebrow del dueño');
  assert.equal(hero.titulo, 'El título que el dueño escribió');
  assert.equal(hero.fraseAlPie, 'Una frase que el dueño ya había cargado.');
  // y `variante` la escribe el loop de `preset.variantes` (CORTE pide hero·sticky, § CORTE-USA-HERO-
  // STICKY-1 — 'media' hasta ese slice) — las dos escrituras conviven sobre la MISMA sección sin
  // pisarse.
  assert.equal(hero.variante, 'sticky');
});

test('mergePresetEnContent NO toca hero.ctasVisibles/hero.cueDesliza para un preset que no los declara (PATIO)', () => {
  assert.equal(PATIO.heroCtasVisibles, undefined);
  assert.equal(PATIO.heroCueDesliza, undefined);
  const antes = { hero: { visible: true, ctasVisibles: true, cueDesliza: false, variante: 'curtina' } };
  const despues = mergePresetEnContent(antes, PATIO);
  const hero = despues.hero as Record<string, unknown>;
  // ninguna de las dos claves cambia de valor — el bloque entero se saltea.
  assert.equal(hero.ctasVisibles, true);
  assert.equal(hero.cueDesliza, false);
});

test('mergePresetEnContent(_, CORTE) sobre los CINCO presets restantes: ninguno agrega ctasVisibles/cueDesliza a una sección que no los tenía', () => {
  const antes = { hero: { visible: true, variante: 'curtina' } };
  for (const preset of [PLIEGO, PATIO, VETA, VITRINA, ARRANQUE]) {
    const despues = mergePresetEnContent(antes, preset);
    const hero = despues.hero as Record<string, unknown>;
    assert.equal('ctasVisibles' in hero, false, `${preset.clave} no debería escribir ctasVisibles`);
    assert.equal('cueDesliza' in hero, false, `${preset.clave} no debería escribir cueDesliza`);
  }
});

// ─── EL MIRADOR (`?tema=CORTE`) — LA INVARIANTE: Nayoli no cambia; sólo CORTE ──────────────────

test('LA INVARIANTE: sin ?tema= (Nayoli), el hero rinde con los dos CTA y sin cue — el default de HOY', () => {
  const nayoli = resolverSiteContent({});
  assert.equal(nayoli.hero.ctasVisibles, true);
  assert.equal(nayoli.hero.cueDesliza, false);

  const sinTema = contenidoConPresetDeVista(nayoli, undefined);
  assert.equal(sinTema, nayoli, 'byte-idéntico: la misma referencia, ni un campo tocado');

  const html = renderHero(sinTema);
  assert.ok(html.includes(DEFAULTS.hero.ctaPrimarioLabel));
  assert.ok(html.includes(DEFAULTS.hero.ctaSecundarioLabel));
  assert.ok(!html.includes('data-hero-cue'), 'sin ?tema=, el default cueDesliza=false no debe rendir el cue');
});

// § CORTE-USA-HERO-STICKY-1 REESCRIBE este caso: CORTE pasó `variantes.hero` de 'media' a 'sticky',
// así que `HeroSection` (el dispatcher) ya NO enruta a `HeroMedia` sino a `HeroMediaMarquesina`
// (§ HeroSection.tsx, `VARIANTES.sticky`). `heroCtasVisibles`/`heroCueDesliza` SIGUEN declarados en
// CORTE (`themes.ts` no los toca, § el spec de este slice) pero ninguno de los dos tiene efecto ya:
// `HeroMediaMarquesina` no rinde CTA en NINGÚN caso (ni con `ctasVisibles:true`) y no lee
// `cueDesliza` en absoluto — MEDIDO en `hero-marquesina.test.ts` ("cueDesliza no emite ningún
// marcador — esta variante no lee el agregado de HeroMedia"), decisión YA TOMADA por
// `MUESTRARIO-HERO-MARQUESINA-STICKY-1` (spec: "decidí cómo conviven con el sticky y asentalo") —
// no una regresión de ESTE slice. La ausencia de CTA sigue siendo cierta (nunca rinden, con o sin
// el toggle); el cue "Desliza" YA NO rinde bajo CORTE — el mecanismo sticky+marquee reemplaza su
// propósito (indicar que hay más contenido abajo) por el gesto de "pasar por encima" del marquee,
// que es la lectura real medida contra `x-cafeone.myshopify.com` (sin cue propio en esa sección).
test('?tema=CORTE sobre Nayoli: el hero pasa a sticky — sin CTA (como antes) y SIN el cue "Desliza" (§ HeroMediaMarquesina no lo lee)', () => {
  const nayoli = resolverSiteContent({});
  const conCorte = contenidoConPresetDeVista(nayoli, 'CORTE');
  assert.equal(conCorte.hero.variante, 'sticky');
  assert.equal(conCorte.hero.ctasVisibles, false);
  assert.equal(conCorte.hero.cueDesliza, true, 'CORTE sigue declarando el campo, aunque ya no tenga efecto bajo sticky');

  const html = renderHero(conCorte);
  assert.ok(!html.includes(DEFAULTS.hero.ctaPrimarioLabel), 'sin CTA primario bajo CORTE (sigue siendo cierto)');
  assert.ok(!html.includes(DEFAULTS.hero.ctaSecundarioLabel), 'sin CTA secundario bajo CORTE (sigue siendo cierto)');
  assert.ok(!html.includes('data-hero-cue'), 'el cue ya NO rinde: HeroMediaMarquesina no lee cueDesliza');
});

test('?tema=CORTE NO toca hero.fraseAlPie — sigue CONTENIDO, ningún preset la siembra', () => {
  const nayoli = resolverSiteContent({});
  const conCorte = contenidoConPresetDeVista(nayoli, 'CORTE');
  assert.equal(conCorte.hero.fraseAlPie, nayoli.hero.fraseAlPie);
  assert.equal(conCorte.hero.fraseAlPie, ''); // default de HOY — nadie la fabricó
});

test('?tema=CORTE preserva el copy/imagen del hero que un tenant ya hubiera cargado — sólo cambia variante/ctasVisibles/cueDesliza', () => {
  const conDatos = {
    ...DEFAULTS,
    hero: { ...DEFAULTS.hero, titulo: 'Mi propio título', eyebrow: 'Mi eyebrow', variante: 'curtina' as const },
  } as SiteContentData;
  const conCorte = contenidoConPresetDeVista(conDatos, 'CORTE');
  assert.equal(conCorte.hero.titulo, 'Mi propio título');
  assert.equal(conCorte.hero.eyebrow, 'Mi eyebrow');
  assert.equal(conCorte.hero.ctasVisibles, false);
  assert.equal(conCorte.hero.cueDesliza, true);
});
