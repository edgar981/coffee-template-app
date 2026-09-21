import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import FeaturedProducts from '@/components/storefront/home/FeaturedProducts';
import FeaturedProductsCuadricula from '@/components/storefront/home/FeaturedProductsCuadricula';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { CartProvider } from '@/lib/cartStore';

import {
  DEFAULTS,
  VARIANTES_ESTRUCTURALES,
  resolverVariantesBandas,
  resolverSiteContent,
  type SiteContentData,
} from './site-content-defaults';
import { CORTE, PATIO, mergePresetEnContent, validarPreset, presetCompleto } from './themes';
import { contenidoConPresetDeVista } from './theme-mirador';

// SPOTLIGHT-CABLEADO-HOME-1 — conecta la banda SPOTLIGHT ya construida (§ SPOTLIGHT-BANDA-1) a la
// home como VARIANTE de `featured`, reusando el dispatcher que YA existía (`FeaturedProducts.tsx`,
// `cuadricula`/`grilla`) — sin banda nueva, sin `BANDA_IDS`, sin tocar `resolverOrden`/`page.tsx`
// (§ la RULING de SPOTLIGHT-BANDA-1, resuelta a favor de la variante). `Spotlight.tsx` y su modelo
// NO se reescriben acá — este archivo afirma el CABLEADO: que `resolverVariante` acepta la clave
// nueva, que el dispatcher monta el componente correcto, que CORTE la elige, y que la variante por
// defecto (Nayoli) queda byte-idéntica.
//
// LÍMITE DE ESTE CARRIL (heredado de spotlight-banda.test.ts): `Spotlight.tsx` fetchea el catálogo
// en un `useEffect` (`getCatalog().then(setCatalog)`), y `renderToStaticMarkup` NUNCA corre efectos
// — es un único paso de render síncrono. Así que en TODOS los renders de acá el catálogo interno de
// Spotlight queda en `[]`, y `productoSpotlight([], slug)` devuelve `null` (hide-on-empty, el mismo
// comportamiento que spotlight-banda.test.ts ya afirma en su mitad pura): Spotlight SIEMPRE rinde
// vacío en este carril, sea cual sea `spotlight.visible`. Por eso la prueba de "se montó Spotlight"
// no es "se ve el producto" (imposible de observar sin jsdom + un catálogo real, § CLAUDE.md, "el
// glob NO incluye *.test.tsx"): es que el texto de la lista plana ("Selección del mes") DESAPARECE
// —prueba que Cuadricula/Grilla NO montaron— más la lectura DIRECTA de la fuente que confirma que
// la clave despacha al import real de `Spotlight`, no a una tercera implementación.

function renderFeatured(content: SiteContentData): string {
  const arbol = React.createElement(CartProvider, {
    children: React.createElement(SiteContentProvider, { value: content, children: React.createElement(FeaturedProducts) }),
  });
  return renderToStaticMarkup(arbol);
}

function renderCuadriculaDirecto(content: SiteContentData): string {
  const arbol = React.createElement(CartProvider, {
    children: React.createElement(SiteContentProvider, { value: content, children: React.createElement(FeaturedProductsCuadricula) }),
  });
  return renderToStaticMarkup(arbol);
}

// ─── EL MODELO — `resolverVariante` acepta la clave nueva ──────────────────────────────────────

test('VARIANTES_ESTRUCTURALES.featured admite "spotlight" junto a cuadricula/grilla, canónica sin cambiar', () => {
  assert.deepEqual(VARIANTES_ESTRUCTURALES.featured, {
    claves: ['cuadricula', 'grilla', 'spotlight'],
    canonica: 'cuadricula',
  });
});

test('resolverVariantesBandas: "spotlight" SOBREVIVE la resolución — ya no es basura que se descarte', () => {
  assert.deepEqual(resolverVariantesBandas({ featured: 'spotlight' }), { featured: 'spotlight' });
});

test('resolverSiteContent({}): sin fila (Nayoli), featured sigue AUSENTE del mapa — la canónica no cambió', () => {
  assert.equal(resolverSiteContent({}).variantesBandas.featured, undefined);
});

// ─── CORTE elige "spotlight" ─────────────────────────────────────────────────────────────────────

test('CORTE pide featured·spotlight (ya no la malla "grilla")', () => {
  assert.equal(CORTE.variantes.featured, 'spotlight');
});

test('CORTE sigue validando COMPLETO con la variante nueva — "spotlight" ya está construida, no es un faltante', () => {
  assert.deepEqual(validarPreset(CORTE), []);
  assert.ok(presetCompleto(CORTE));
});

// ─── mergePresetEnContent enciende `spotlight.visible` SÓLO cuando la variante elegida lo es ──────
//
// Sin esto, CORTE aplicaría la variante 'spotlight' y `Spotlight.tsx` devolvería `null` de todos
// modos (`spotlight.visible` sigue en su default `false`, § site-content-defaults.ts — "nace OFF",
// sin tocar): el slot de `featured` quedaría "elegido" y en blanco a la vez.

test("mergePresetEnContent(_, CORTE): fuerza spotlight.visible=true — si no, el slot de featured quedaría vacío", () => {
  const despues = mergePresetEnContent({ ...DEFAULTS }, CORTE);
  const spotlight = despues.spotlight as Record<string, unknown>;
  assert.equal(spotlight.visible, true);
});

test('mergePresetEnContent(_, CORTE): preserva eyebrow/título/pin que el dueño ya hubiera puesto, sólo enciende `visible`', () => {
  const antes = { ...DEFAULTS, spotlight: { ...DEFAULTS.spotlight, eyebrow: 'Mi eyebrow', productoSlug: 'cafe-x' } };
  const despues = mergePresetEnContent(antes as unknown as Record<string, unknown>, CORTE);
  const spotlight = despues.spotlight as Record<string, unknown>;
  assert.equal(spotlight.visible, true);
  assert.equal(spotlight.eyebrow, 'Mi eyebrow');
  assert.equal(spotlight.productoSlug, 'cafe-x');
});

test('mergePresetEnContent NO toca spotlight.visible para un preset que NO elige la variante spotlight (PATIO sigue en "grilla")', () => {
  assert.equal(PATIO.variantes.featured, 'grilla');
  const despues = mergePresetEnContent({ ...DEFAULTS }, PATIO);
  assert.deepEqual(despues.spotlight, DEFAULTS.spotlight);
});

// ─── EL DESPACHADOR — `FeaturedProducts.tsx` monta Spotlight, nunca Cuadricula/Grilla, cuando la
// variante es "spotlight" ────────────────────────────────────────────────────────────────────────

test('featured·spotlight: el texto propio de la lista plana ("Selección del mes"/"Nuestro Catálogo") DESAPARECE — Cuadricula/Grilla no montaron', () => {
  const content = { ...DEFAULTS, variantesBandas: { featured: 'spotlight' } } as SiteContentData;
  const html = renderFeatured(content);
  assert.ok(!html.includes('Selección del mes'));
  assert.ok(!html.includes('Nuestro Catálogo'));
});

test('featured·spotlight con `spotlight.visible` forzado true (como lo dejaría CORTE) y catálogo vacío: sigue sin producto que mostrar, hide-on-empty (§ spotlight-banda.test.ts) — no un componente roto', () => {
  const content = {
    ...DEFAULTS,
    variantesBandas: { featured: 'spotlight' },
    spotlight: { ...DEFAULTS.spotlight, visible: true },
  } as SiteContentData;
  const html = renderFeatured(content);
  // Sin catálogo (el límite de este carril, § arriba) Spotlight rinde vacío — pero NUNCA el texto
  // de la lista plana, que es lo que probaría que el dispatcher se equivocó de componente.
  assert.ok(!html.includes('Selección del mes'));
});

test('la fuente de FeaturedProducts.tsx importa Spotlight y lo asigna a la clave "spotlight" del mapa de despacho — no una tercera implementación', () => {
  const srcPath = path.join(fileURLToPath(new URL('.', import.meta.url)), '../../components/storefront/home/FeaturedProducts.tsx');
  const src = readFileSync(srcPath, 'utf8');
  assert.match(src, /import Spotlight from ["']@\/components\/storefront\/home\/Spotlight["']/);
  assert.match(src, /spotlight:\s*Spotlight\s*,/);
});

// ─── LA INVARIANTE — Nayoli (canónica) queda BYTE-IDÉNTICA por render ──────────────────────────────

test('LA INVARIANTE: sin variante elegida, FeaturedProducts monta Cuadricula — "Selección del mes" aparece, byte-idéntico a montar Cuadricula sola', () => {
  const viaDespachador = renderFeatured(DEFAULTS as SiteContentData);
  const directo = renderCuadriculaDirecto(DEFAULTS as SiteContentData);
  assert.equal(viaDespachador, directo);
  assert.ok(viaDespachador.includes('Selección del mes'));
});

test('Nayoli real (resolverSiteContent({}), sin fila) rinde la banda de productos EXACTAMENTE igual que antes de este slice — byte a byte contra Cuadricula sola', () => {
  const content = resolverSiteContent({});
  const viaDespachador = renderFeatured(content);
  const directo = renderCuadriculaDirecto(content);
  assert.equal(viaDespachador, directo);
});

// ─── EL MIRADOR (`?tema=CORTE`) — la vista de sólo-lectura que ejerce la cadena completa ─────────

test('sin ?tema= (contenidoConPresetDeVista con clave undefined): Nayoli no cambia — misma referencia, misma banda de siempre', () => {
  const nayoli = resolverSiteContent({});
  const sinTema = contenidoConPresetDeVista(nayoli, undefined);
  assert.equal(sinTema, nayoli, 'sin ?tema=, el mirador devuelve EXACTAMENTE el content de entrada');
  assert.ok(renderFeatured(sinTema).includes('Selección del mes'));
});

test('?tema=CORTE sobre Nayoli: la banda de productos deja la lista plana y pasa a spotlight, con visible forzado', () => {
  const nayoli = resolverSiteContent({});
  const conCorte = contenidoConPresetDeVista(nayoli, 'CORTE');
  assert.equal(conCorte.variantesBandas.featured, 'spotlight');
  assert.equal(conCorte.spotlight.visible, true);

  const html = renderFeatured(conCorte);
  assert.ok(!html.includes('Selección del mes'), 'la lista plana de Nayoli ya no debe aparecer bajo CORTE');
  assert.ok(!html.includes('Nuestro Catálogo'));
});
