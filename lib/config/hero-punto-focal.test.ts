import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import HeroMedia from '@/components/storefront/home/HeroMedia';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';

import {
  DEFAULTS,
  REGISTRY,
  PUNTOS_FOCALES,
  resolverVariante,
  resolverSiteContent,
  objectPositionDePuntoFocal,
  type SiteContentData,
} from './site-content-defaults';

// HERO-PUNTO-FOCAL-1 — recorte MÍNIMO del Backlog #58 ("el ENCUADRE de las imágenes subidas: punto
// focal, no recorte con caja"). El owner, gateando desde un celular: «el video del hero no sé si
// hay forma de cuadrarlo que salga más la parte del centro del mismo» — `HeroMedia.tsx` recorta con
// `object-cover` SIN `object-position`, así que el navegador usa el centro GEOMÉTRICO, que en un
// viewport angosto puede no ser el centro de INTERÉS.
//
// LA FORMA: un escalar CLAMPADO (como `imagenTipo`, `hero.escalares.puntoFocal`) con la grilla de
// NUEVE posiciones que `object-position` ya entiende de forma nativa — un SELECT NATIVO de
// opciones fijas (§ Controles de formulario, CLAUDE.md), no dos campos de porcentaje libre: el
// dueño elige una posición con nombre, sin pelear con números. `'centro'` es la canónica y NO
// emite `object-position` en absoluto — Nayoli (que no declara el campo) queda byte-idéntica.
//
// ALCANCE: SÓLO el hero, y SÓLO la variante `media` (§ HeroMedia.tsx) — curtina/ficha no leen
// `puntoFocal` (mismo alcance que `titularVisible`/`ctasVisibles`/`alturaLlena`, § tienda-
// secciones.ts). El resto del Backlog #58 (el encuadre de TODA imagen subida, con un selector
// visual de arrastre) sigue sin construirse — es un ALCANCE mayor, con su propio disparador.

function renderHeroMedia(content: SiteContentData): string {
  const arbol = React.createElement(SiteContentProvider, { value: content, children: React.createElement(HeroMedia) });
  return renderToStaticMarkup(arbol);
}

// ─── EL MODELO — la canónica, y el clamp de basura (§ REGISTRY.hero.escalares.puntoFocal) ────────

test('DEFAULTS.hero.puntoFocal es "centro" (byte-idéntico al recorte de hoy)', () => {
  assert.equal(DEFAULTS.hero.puntoFocal, 'centro');
});

test('resolverSiteContent({}) — sin fila, puntoFocal resuelve a "centro"', () => {
  const r = resolverSiteContent({});
  assert.equal(r.hero.puntoFocal, 'centro');
});

test('EL CASO REAL DE HOY: una fila de SiteContent que EXISTE y NO tiene `puntoFocal` en su JSON (todas las filas anteriores a este slice) cae a "centro" — Nayoli no cambia', () => {
  const r = resolverSiteContent({ hero: { titulo: 'Un titular ya editado', imagen: '/mi-foto.jpg' } });
  assert.equal(r.hero.puntoFocal, 'centro');
  assert.equal(r.hero.imagen, '/mi-foto.jpg'); // el resto de la fila no se toca
});

test('una posición del set cerrado guardada se respeta, para las NUEVE claves', () => {
  for (const clave of PUNTOS_FOCALES) {
    const r = resolverSiteContent({ hero: { puntoFocal: clave } });
    assert.equal(r.hero.puntoFocal, clave);
  }
});

test('puntoFocal fuera del set cerrado (basura) cae a la canónica "centro" — nunca lanza (ocultable:false, la ÚNICA portada)', () => {
  for (const basura of ['diagonal', '', null, undefined, 42, {}, ['arriba']]) {
    assert.equal(resolverSiteContent({ hero: { puntoFocal: basura } }).hero.puntoFocal, 'centro');
  }
});

test('resolverVariante con las claves de `puntoFocal`: ausente/vacío/null/basura → "centro"; cada clave del set se respeta', () => {
  const def = REGISTRY.hero.escalares!.puntoFocal;
  assert.equal(resolverVariante(def, undefined), 'centro');
  assert.equal(resolverVariante(def, ''), 'centro');
  assert.equal(resolverVariante(def, null), 'centro');
  assert.equal(resolverVariante(def, 'diagonal'), 'centro');
  for (const clave of PUNTOS_FOCALES) {
    assert.equal(resolverVariante(def, clave), clave);
  }
});

test('una sección SIN `escalares` declarado no gana `puntoFocal` en el resuelto (brandStory, p. ej. — sólo el hero lo tiene)', () => {
  const r = resolverSiteContent({});
  assert.equal('puntoFocal' in r.brandStory, false);
});

// ─── EL MAPEO PURO — `objectPositionDePuntoFocal`, la traducción a CSS ────────────────────────────

test('objectPositionDePuntoFocal("centro") → undefined — la canónica no emite NADA (byte-idéntico)', () => {
  assert.equal(objectPositionDePuntoFocal('centro'), undefined);
});

test('objectPositionDePuntoFocal: un valor fuera del set/rango NO valida — devuelve undefined, igual que si no se hubiera declarado', () => {
  for (const basura of ['diagonal', '', 'ARRIBA', 'top-left']) {
    assert.equal(objectPositionDePuntoFocal(basura), undefined);
  }
});

test('objectPositionDePuntoFocal: las OCHO posiciones no-canónicas traducen al valor CSS `object-position` correcto', () => {
  assert.equal(objectPositionDePuntoFocal('arriba'), 'center top');
  assert.equal(objectPositionDePuntoFocal('abajo'), 'center bottom');
  assert.equal(objectPositionDePuntoFocal('izquierda'), 'left center');
  assert.equal(objectPositionDePuntoFocal('derecha'), 'right center');
  assert.equal(objectPositionDePuntoFocal('arriba-izquierda'), 'left top');
  assert.equal(objectPositionDePuntoFocal('arriba-derecha'), 'right top');
  assert.equal(objectPositionDePuntoFocal('abajo-izquierda'), 'left bottom');
  assert.equal(objectPositionDePuntoFocal('abajo-derecha'), 'right bottom');
});

test('objectPositionDePuntoFocal: las NUEVE claves de PUNTOS_FOCALES tienen un resultado definido (8 con valor CSS, 1 -- centro -- undefined)', () => {
  const conValor = PUNTOS_FOCALES.filter((c) => objectPositionDePuntoFocal(c) !== undefined);
  assert.equal(conValor.length, PUNTOS_FOCALES.length - 1);
  assert.ok(!conValor.includes('centro'));
});

// ─── EL RENDER — HeroMedia, en memoria: sin declarar no emite `object-position`, declarado sí ─────
// (§ corte-hero-viewport.test.ts, mismo patrón: `renderToStaticMarkup` sobre el componente REAL,
// dentro de `SiteContentProvider`, sin iframe ni jsdom.)

test('sin declarar (Nayoli, sin fila): la IMAGEN no emite `object-position` — byte-idéntico al recorte de hoy', () => {
  const nayoli = resolverSiteContent({});
  const html = renderHeroMedia(nayoli);
  assert.doesNotMatch(html, /object-position/);
});

test('`puntoFocal: "centro"` declarado EXPLÍCITO: tampoco emite `object-position` — la canónica es "sin declarar", no un valor más', () => {
  const content = { ...DEFAULTS, hero: { ...DEFAULTS.hero, puntoFocal: 'centro' as const } } as SiteContentData;
  const html = renderHeroMedia(content);
  assert.doesNotMatch(html, /object-position/);
});

test('`puntoFocal` fuera del set (basura guardada) resuelve a "centro" — el render tampoco emite `object-position`: un valor fuera de rango no valida', () => {
  const nayoli = resolverSiteContent({ hero: { puntoFocal: 'diagonal' } });
  const html = renderHeroMedia(nayoli);
  assert.doesNotMatch(html, /object-position/);
});

test('declarado ("arriba-derecha") sobre una IMAGEN: el render emite `object-position:right top`', () => {
  const content = { ...DEFAULTS, hero: { ...DEFAULTS.hero, puntoFocal: 'arriba-derecha' as const } } as SiteContentData;
  const html = renderHeroMedia(content);
  assert.match(html, /<img[^>]*style="[^"]*object-position:right top[^"]*"/);
});

test('declarado ("abajo-izquierda") sobre un VIDEO (`imagenTipo: "video"`): el render emite `object-position:left bottom` en el `<video>`, NO en un `<img>`', () => {
  const content = {
    ...DEFAULTS,
    hero: { ...DEFAULTS.hero, imagenTipo: 'video' as const, imagen: '/v.mp4', imagenPoster: '/p.jpg', puntoFocal: 'abajo-izquierda' as const },
  } as SiteContentData;
  const html = renderHeroMedia(content);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /<video[^>]*style="object-position:left bottom"/);
});

test('sin declarar sobre un VIDEO: el `<video>` tampoco emite `object-position` — el alcance cubre los DOS medios por igual', () => {
  const content = {
    ...DEFAULTS,
    hero: { ...DEFAULTS.hero, imagenTipo: 'video' as const, imagen: '/v.mp4', imagenPoster: '/p.jpg' },
  } as SiteContentData;
  const html = renderHeroMedia(content);
  assert.match(html, /<video/);
  assert.doesNotMatch(html, /object-position/);
});
