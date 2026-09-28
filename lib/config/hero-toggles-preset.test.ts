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

// § CORTE-USA-HERO-STICKY-1 REESCRIBIÓ este caso: CORTE pasó `variantes.hero` de 'media' a 'sticky',
// así que `HeroSection` (el dispatcher) ya NO enruta a `HeroMedia` sino a `HeroMediaMarquesina`
// (§ HeroSection.tsx, `VARIANTES.sticky`). `heroCtasVisibles`/`heroCueDesliza` SIGUEN declarados en
// CORTE (`themes.ts` no los toca), pero desde entonces los dos divergieron: `ctasVisibles` sigue sin
// efecto (`HeroMediaMarquesina` no rinde CTA en NINGÚN caso); `cueDesliza`, en cambio, VOLVIÓ a tener
// efecto en § CORTE-HERO-STICKY-RONDA-2-1 — el owner pidió el cue VISIBLE sobre el prototipo
// aplicado, y la variante pasó a leer el MISMO campo (§ `hero-marquesina.test.ts`, el caso que ESE
// slice invirtió: "la variante RINDE el cue, mismo marcado que HeroMedia"). La ausencia de CTA sigue
// siendo cierta (nunca rinden, con o sin el toggle); el cue "Desliza" SÍ rinde bajo CORTE de nuevo.
test('?tema=CORTE sobre Nayoli: el hero pasa a sticky — sin CTA (como antes) y CON el cue "Desliza" (§ CORTE-HERO-STICKY-RONDA-2-1)', () => {
  const nayoli = resolverSiteContent({});
  const conCorte = contenidoConPresetDeVista(nayoli, 'CORTE');
  assert.equal(conCorte.hero.variante, 'sticky');
  assert.equal(conCorte.hero.ctasVisibles, false);
  assert.equal(conCorte.hero.cueDesliza, true);

  const html = renderHero(conCorte);
  assert.ok(!html.includes(DEFAULTS.hero.ctaPrimarioLabel), 'sin CTA primario bajo CORTE (sigue siendo cierto)');
  assert.ok(!html.includes(DEFAULTS.hero.ctaSecundarioLabel), 'sin CTA secundario bajo CORTE (sigue siendo cierto)');
  assert.ok(html.includes('data-hero-cue'), 'el cue RINDE de nuevo: HeroMediaMarquesina ya lee cueDesliza');
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

// ─── heroVeloVisible — § CORTE-HERO-VELO-OFF-Y-TICKER-1, MISMO PATRÓN, SEXTO booleano ────────────
//
// El owner, con el tema real en la mano (2026-09-27): «ese velo verde debemos quitarlo, hace que el
// video se vea sin calidad». `heroVeloVisible` es UN booleano más de `REGISTRY.hero.booleanos`
// (default `true`, byte-idéntico); CORTE lo declaró en `false` en ESA ronda — el mecanismo de render
// (el `<motion.div>` del velo deja de MONTARSE) vive en `HeroMediaMarquesina.tsx` y se afirma en
// `hero-marquesina.test.ts`.
//
// § CORTE-HERO-REVELADO-MASCARA-1 (RONDA 4) REVIERTE esto: sobre el gate visual de esa ronda, el
// owner pidió el velo de vuelta, más suave. CORTE deja de declarar `heroVeloVisible` (hereda el
// default `true`) y en su lugar declara `heroVeloIntensidad`/`heroTickerVelocidad` — los DOS tests de
// abajo ("RONDA 4") reemplazan a los de heroVeloVisible que este bloque tenía.

test('CORTE ya NO declara heroVeloVisible (RONDA 4 lo revirtió) — hereda el default true, byte-idéntico al mecanismo de siempre', () => {
  assert.equal(CORTE.heroVeloVisible, undefined);
  assert.deepEqual(validarPreset(CORTE), []);
  assert.ok(presetCompleto(CORTE));
});

test('NINGÚN preset del catálogo declara heroVeloVisible hoy', () => {
  for (const preset of PRESETS) {
    assert.equal(preset.heroVeloVisible, undefined, `${preset.clave} no debería declarar heroVeloVisible`);
  }
});

test('mergePresetEnContent(_, CORTE): YA NO toca hero.veloVisible — la clave ni se escribe', () => {
  const antes = { hero: { visible: true, titulo: 'El título del dueño', variante: 'curtina' } };
  const despues = mergePresetEnContent(antes, CORTE);
  const hero = despues.hero as Record<string, unknown>;
  assert.equal('veloVisible' in hero, false, 'CORTE ya no declara heroVeloVisible, así que no debe escribir la clave');
  assert.equal(hero.titulo, 'El título del dueño');
});

test('LA INVARIANTE: sin ?tema= (Nayoli), hero.veloVisible sigue en su default true — el velo de HOY', () => {
  const nayoli = resolverSiteContent({});
  assert.equal(nayoli.hero.veloVisible, true);
  const sinTema = contenidoConPresetDeVista(nayoli, undefined);
  assert.equal(sinTema, nayoli, 'byte-idéntico: la misma referencia, ni un campo tocado');
});

test('?tema=CORTE sobre Nayoli: hero.veloVisible sigue en true — RONDA 4 ya no lo apaga', () => {
  const nayoli = resolverSiteContent({});
  const conCorte = contenidoConPresetDeVista(nayoli, 'CORTE');
  assert.equal(conCorte.hero.veloVisible, true);
});

// ─── heroVeloIntensidad/heroTickerVelocidad — § CORTE-HERO-REVELADO-MASCARA-1, RONDA 4; el VALOR de
// heroVeloIntensidad pasa de 'suave' a 'intermedia' en § HERO-VELO-INTERMEDIO-1 ──────────────────
//
// DOS escalares (string), MISMO patrón mecánico que `heroCtasVisibles`/`heroCueDesliza` (arriba) pero
// de STRING en vez de boolean — como `variante`, no como los seis booleanos de la sección de arriba.
// El owner, sobre el gate visual de RONDA 4: «también podemos agregar un velo, pero no tiene que ser
// tan fuerte» y «la velocidad… debería ser más baja». § HERO-VELO-INTERMEDIO-1 (2026-09-28), sobre el
// gate visual de 'suave' ya aplicada: «el velo del hero puede ser un poquito más oscuro» — CORTE pasa
// a declarar 'intermedia' (el tercer paso del set, § site-content-defaults.ts); `heroTickerVelocidad`
// NO cambia.

test('CORTE declara heroVeloIntensidad:"intermedia" y heroTickerVelocidad:"lenta" — sigue validando COMPLETO', () => {
  assert.equal(CORTE.heroVeloIntensidad, 'intermedia');
  assert.equal(CORTE.heroTickerVelocidad, 'lenta');
  assert.deepEqual(validarPreset(CORTE), []);
  assert.ok(presetCompleto(CORTE));
});

test('CORTE es el ÚNICO preset del catálogo que declara heroVeloIntensidad/heroTickerVelocidad', () => {
  for (const preset of PRESETS) {
    if (preset.clave === 'CORTE') continue;
    assert.equal(preset.heroVeloIntensidad, undefined, `${preset.clave} no debería declarar heroVeloIntensidad`);
    assert.equal(preset.heroTickerVelocidad, undefined, `${preset.clave} no debería declarar heroTickerVelocidad`);
  }
});

test('mergePresetEnContent(_, CORTE): escribe hero.veloIntensidad:"intermedia" y hero.tickerVelocidad:"lenta", preservando lo demás de la sección', () => {
  const antes = { hero: { visible: true, titulo: 'El título del dueño', variante: 'curtina' } };
  const despues = mergePresetEnContent(antes, CORTE);
  const hero = despues.hero as Record<string, unknown>;
  assert.equal(hero.veloIntensidad, 'intermedia');
  assert.equal(hero.tickerVelocidad, 'lenta');
  assert.equal(hero.titulo, 'El título del dueño');
});

test('mergePresetEnContent NO toca hero.veloIntensidad/tickerVelocidad para un preset que no los declara (PATIO)', () => {
  assert.equal(PATIO.heroVeloIntensidad, undefined);
  assert.equal(PATIO.heroTickerVelocidad, undefined);
  const antes = { hero: { visible: true, veloIntensidad: 'media', tickerVelocidad: 'media', variante: 'curtina' } };
  const despues = mergePresetEnContent(antes, PATIO);
  const hero = despues.hero as Record<string, unknown>;
  assert.equal(hero.veloIntensidad, 'media', 'ninguna clave cambia de valor — el bloque entero se saltea');
  assert.equal(hero.tickerVelocidad, 'media');
});

test('mergePresetEnContent(_, preset) sobre los CINCO presets restantes: ninguno agrega veloIntensidad/tickerVelocidad a una sección que no los tenía', () => {
  const antes = { hero: { visible: true, variante: 'curtina' } };
  for (const preset of [PLIEGO, PATIO, VETA, VITRINA, ARRANQUE]) {
    const despues = mergePresetEnContent(antes, preset);
    const hero = despues.hero as Record<string, unknown>;
    assert.equal('veloIntensidad' in hero, false, `${preset.clave} no debería escribir veloIntensidad`);
    assert.equal('tickerVelocidad' in hero, false, `${preset.clave} no debería escribir tickerVelocidad`);
  }
});

test('LA INVARIANTE: sin ?tema= (Nayoli), hero.veloIntensidad/tickerVelocidad siguen en su default "media" — byte-idéntico', () => {
  const nayoli = resolverSiteContent({});
  assert.equal(nayoli.hero.veloIntensidad, 'media');
  assert.equal(nayoli.hero.tickerVelocidad, 'media');
});

test('?tema=CORTE sobre Nayoli: hero.veloIntensidad pasa a "intermedia" y hero.tickerVelocidad a "lenta"', () => {
  const nayoli = resolverSiteContent({});
  const conCorte = contenidoConPresetDeVista(nayoli, 'CORTE');
  assert.equal(conCorte.hero.veloIntensidad, 'intermedia');
  assert.equal(conCorte.hero.tickerVelocidad, 'lenta');
});
