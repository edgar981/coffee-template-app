import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import HeroMedia from '@/components/storefront/home/HeroMedia';
import HeroMediaMarquesina from '@/components/storefront/home/HeroMediaMarquesina';
import Marquesina from '@/components/storefront/home/Marquesina';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';

import { DEFAULTS, resolverSiteContent, type SiteContentData } from './site-content-defaults';
import { CORTE, PATIO } from './themes';
import { contenidoConPresetDeVista } from './theme-mirador';

// CORTE-MARQUESINA-VELO-1 — el velo de la marquesina y el PIE del velo del hero COINCIDEN leyendo la
// MISMA variable derivada de `--sf-tinta` (`--sf-velo`, § app/globals.css), en vez de hornear cada
// uno su propio modificador de opacidad (`/80` en el hero, `/70` en la marquesina — dos literales del
// mismo origen que podían divergir). El owner (ronda de gate visual, 2026-09-23): «el velo de la
// marquesina y el del hero salen del MISMO origen — no copies el rgba, derivalo del token, que los
// dos lean la misma variable». AL MOMENTO DE ESTE SLICE, `HeroMedia` (variante 'media') era la ÚNICA
// que CORTE usaba; § CORTE-USA-HERO-STICKY-1 (posterior) pasó CORTE a 'sticky' (`HeroMediaMarquesina`,
// que fusiona hero+marquee en una sola banda con el mismo token) y apagó la banda suelta — los tests
// generales de `HeroMedia`/`Marquesina` de este archivo (líneas de abajo) siguen siendo válidos EN SÍ
// MISMOS (son genéricos, no atados a qué preset usa cuál variante); sólo el caso `?tema=CORTE` al
// final se reescribió para la composición nueva.
//
// LO QUE ESTE ARCHIVO PUEDE AFIRMAR SIN NAVEGADOR: `renderToStaticMarkup` deja ver el className
// literal (la clase de Tailwind), no el color RESUELTO — ninguna capa de este carril compila CSS ni
// evalúa `color-mix()`. Por eso "el hero renderiza byte-idéntico a hoy" NO se verifica comparando el
// className byte a byte (CAMBIA: pasa de `to-[var(--sf-tinta)]/80` a `to-[var(--sf-velo)]`, a
// propósito) — se verifica en DOS partes: (a) que las DOS superficies referencien el MISMO nombre de
// variable (`--sf-velo`), nunca dos literales, y (b) que la declaración de `--sf-velo` en
// `app/globals.css` sea EXACTAMENTE la fórmula que Tailwind v4 ya genera para un modificador `/80`
// sobre un color arbitrario — `color-mix(in oklab, ${color} ${pct}%, transparent)`, verificado contra
// `node_modules/tailwindcss/dist/lib.js` — así que el color FINAL resuelto en el navegador es el
// mismo que hoy, sólo que nombrado en vez de repetido.

function leerDeclaracionCss(nombre: string): string {
  const cssPath = path.join(fileURLToPath(new URL('.', import.meta.url)), '../../app/globals.css');
  const css = readFileSync(cssPath, 'utf8');
  const m = css.match(new RegExp(`--${nombre}:\\s*([^;]+);`));
  if (!m) throw new Error(`no se encontró --${nombre} en app/globals.css`);
  return m[1].trim();
}

function renderHeroMedia(content: SiteContentData): string {
  const arbol = React.createElement(SiteContentProvider, { value: content, children: React.createElement(HeroMedia) });
  return renderToStaticMarkup(arbol);
}

function renderMarquesina(content: SiteContentData): string {
  const arbol = React.createElement(SiteContentProvider, { value: content, children: React.createElement(Marquesina) });
  return renderToStaticMarkup(arbol);
}

// § CORTE-USA-HERO-STICKY-1: CORTE ya no usa `HeroMedia` (variante 'media') — pasó a 'sticky', que
// rinde `HeroMediaMarquesina`, la composición que fusiona el hero y el marquee en UNA sola banda.
function renderHeroMediaMarquesina(content: SiteContentData): string {
  const arbol = React.createElement(SiteContentProvider, { value: content, children: React.createElement(HeroMediaMarquesina) });
  return renderToStaticMarkup(arbol);
}

// ─── LA VARIABLE — declarada en app/globals.css, derivada de --sf-tinta ────────────────────────────

test('--sf-velo (app/globals.css) es EXACTAMENTE la fórmula que Tailwind genera para un modificador /80 sobre un color arbitrario — el hero queda byte-idéntico', () => {
  const velo = leerDeclaracionCss('sf-velo');
  assert.equal(velo, 'color-mix(in oklab, var(--sf-tinta) 80%, transparent)');
});

// ─── EL HERO (HeroMedia) — el PIE del velo lee --sf-velo, no un literal de opacidad ────────────────

test('HeroMedia: el PIE del velo lee var(--sf-velo) — ya NO hornea /80 sobre --sf-tinta', () => {
  const html = renderHeroMedia(resolverSiteContent({}));
  assert.match(html, /to-\[var\(--sf-velo\)\]/);
  assert.doesNotMatch(html, /to-\[var\(--sf-tinta\)\]\/80/);
});

test('HeroMedia: el resto del gradiente (el tramo superior, 60%, que protege el nav) NO se tocó', () => {
  const html = renderHeroMedia(resolverSiteContent({}));
  assert.match(html, /from-\[var\(--sf-tinta\)\]\/60/);
  assert.match(html, /via-transparent/);
});

// ─── LA MARQUESINA — su velo lee --sf-velo, y ya NO diverge del hero (antes /70, hoy la misma var) ─

test('Marquesina (visible): el velo lee var(--sf-velo) — ya NO hornea /70 sobre --sf-tinta', () => {
  const content = { ...DEFAULTS, marquesina: { ...DEFAULTS.marquesina, visible: true } } as SiteContentData;
  const html = renderMarquesina(content);
  assert.match(html, /bg-\[var\(--sf-velo\)\]/);
  assert.doesNotMatch(html, /bg-\[var\(--sf-tinta\)\]\/70/);
});

// ─── LOS DOS COINCIDEN — MISMA variable, no dos nombres parecidos ──────────────────────────────────

test('el hero y la marquesina referencian el MISMO token de variable (--sf-velo), no dos literales distintos', () => {
  const heroHtml = renderHeroMedia(resolverSiteContent({}));
  const marquesinaHtml = renderMarquesina({
    ...DEFAULTS,
    marquesina: { ...DEFAULTS.marquesina, visible: true },
  } as SiteContentData);

  const veloEnHero = heroHtml.match(/var\(--sf-velo\)/g) ?? [];
  const veloEnMarquesina = marquesinaHtml.match(/var\(--sf-velo\)/g) ?? [];
  assert.equal(veloEnHero.length, 1, 'el pie del hero debe referenciar --sf-velo exactamente una vez');
  assert.equal(veloEnMarquesina.length, 1, 'el velo de la marquesina debe referenciar --sf-velo exactamente una vez');
});

// ─── BYTE-IDENTIDAD DEL RESTO — la marquesina sigue siendo opt-in CORTE ────────────────────────────

test('LA INVARIANTE: Nayoli (sin fila, sin preset) sigue sin renderizar la marquesina — el cambio de velo no la enciende', () => {
  const html = renderMarquesina(resolverSiteContent({}));
  assert.equal(html, '');
});

test('PATIO (preset que NO enciende la marquesina): el contenido resuelto no cambia de forma por este slice', () => {
  const nayoli = resolverSiteContent({});
  const conPatio = contenidoConPresetDeVista(nayoli, 'PATIO');
  assert.equal(PATIO.bandasVisibles?.marquesina, undefined);
  assert.equal(renderMarquesina(conPatio), '');
});

// § CORTE-USA-HERO-STICKY-1 REESCRIBE este caso: CORTE pasó `variantes.hero` de 'media' a 'sticky'
// y apagó `bandasVisibles.marquesina` (era `true`) — el marquee ya NO vive en una banda suelta
// aparte del hero, sino DENTRO de él (`HeroMediaMarquesina`, § su docstring: dejar la banda suelta
// encendida duplicaría el mismo contenido). El COMPORTAMIENTO que este archivo afirma —que el velo
// del marquee sale del MISMO token `--sf-velo` que el del hero, nunca dos literales— SIGUE siendo
// cierto: `HeroMediaMarquesina` es la MISMA composición hero+marquee, con un solo velo compartido
// (afirmado en detalle por `hero-marquesina.test.ts`); lo que cambia es que ya no hay DOS bandas
// separadas que comparar, sino una sola que lleva las dos cosas.
test('?tema=CORTE: la marquesina suelta queda APAGADA (su velo/texto ya viven en el hero·sticky), que sigue leyendo --sf-velo', () => {
  const nayoli = resolverSiteContent({});
  const conCorte = contenidoConPresetDeVista(nayoli, 'CORTE');
  assert.equal(conCorte.hero.variante, 'sticky');
  assert.equal(conCorte.marquesina.visible, false, 'la banda suelta queda apagada — su contenido ya rinde dentro del hero');
  assert.equal(renderMarquesina(conCorte), '', 'la banda suelta no rinde nada bajo CORTE');

  const htmlHeroSticky = renderHeroMediaMarquesina(conCorte);
  assert.match(htmlHeroSticky, /bg-\[var\(--sf-velo\)\]/, 'el velo del hero·sticky sigue leyendo el mismo token');
});
