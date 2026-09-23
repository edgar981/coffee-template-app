import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import TrustBadges from '@/components/storefront/home/TrustBadges';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';

import {
  BANDA_IDS,
  DEFAULTS,
  REGISTRY,
  resolverSiteContent,
  seccionEsVisible,
  type SiteContentData,
} from './site-content-defaults';

// CORTE-TRUSTBADGES-OCULTABLE-1 — la banda de insignias de confianza gana un interruptor de DATO:
// `content.trustBadges.visible`, default `true`. Antes de este slice la banda era ESTRUCTURAL sin
// sección (§ el docstring histórico de `BANDA_IDS`) y se montaba SIEMPRE, sin gate; el default
// `true` es lo que deja a Nayoli (y a cualquier tenant sin fila propia) exactamente como estaba.
//
// MISMO MECANISMO que origen/marquesina: `TrustBadges.tsx` lee `useSiteContent()` y
// `seccionEsVisible(REGISTRY.trustBadges, trustBadges)` decide si la sección devuelve `null`. SE
// APAGA, NO SE BORRA — el array `BADGES` (ícono + texto de cada insignia) sigue siendo ESTRUCTURA
// de código; esta sección no lo vuelve editable, sólo agrega el interruptor.

function renderTrustBadges(content: SiteContentData): string {
  return renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: content, children: React.createElement(TrustBadges) }),
  );
}

// ─── EL MODELO ──────────────────────────────────────────────────────────────────────────────────

test('trustBadges ES miembro de BANDA_IDS, 3ª posición, justo tras `marquesina` (ya lo era antes de este slice)', () => {
  assert.equal((BANDA_IDS as readonly string[]).includes('trustBadges'), true);
  assert.equal(BANDA_IDS[2], 'trustBadges');
});

test('DEFAULTS.trustBadges nace ON (visible:true) — byte-idéntico: la banda se montaba SIEMPRE antes de este slice, sin gate', () => {
  assert.equal(DEFAULTS.trustBadges.visible, true);
});

test('REGISTRY.trustBadges: ocultable, sin variantes/repeater/imagenes — el interruptor es el ÚNICO campo, las insignias siguen siendo código', () => {
  assert.equal(REGISTRY.trustBadges.ocultable, true);
  assert.equal(REGISTRY.trustBadges.variantes, undefined);
  assert.equal(REGISTRY.trustBadges.repeater, undefined);
  assert.equal(REGISTRY.trustBadges.imagenes, undefined);
  assert.deepEqual(REGISTRY.trustBadges.campos, {});
});

test('sin fila (Nayoli), trustBadges resuelve ON — DEFAULTS y el gate coinciden', () => {
  const resuelto = resolverSiteContent({});
  assert.deepEqual(resuelto.trustBadges, DEFAULTS.trustBadges);
  assert.equal(seccionEsVisible(REGISTRY.trustBadges, resuelto.trustBadges), true);
});

test('con `visible:false` guardado, la sección se apaga — la garantía de arriba es del DEFAULT, no de un `ocultable:false`', () => {
  const resuelto = resolverSiteContent({ trustBadges: { visible: false } });
  assert.equal(resuelto.trustBadges.visible, false);
  assert.equal(seccionEsVisible(REGISTRY.trustBadges, resuelto.trustBadges), false);
});

// ─── EL RENDER — `visible:false` apaga; `visible:true`/sin fila es BYTE-IDÉNTICO a HOY ────────────

test('visible:false → la banda devuelve null, ni un nodo', () => {
  const content = { ...DEFAULTS, trustBadges: { visible: false } } as SiteContentData;
  const html = renderTrustBadges(content);
  assert.equal(html, '');
});

test('sin fila (Nayoli, `resolverSiteContent({})`) → la banda rinde las CUATRO insignias, byte-idéntico a antes de este slice', () => {
  const html = renderTrustBadges(resolverSiteContent({}));
  assert.ok(html !== '');
  // Las 4 insignias del array `BADGES` (§ TrustBadges.tsx), con su texto exacto — la lista NO es
  // dato de esta sección, sigue viviendo en el componente; este test la trata como estructura
  // congelada, no como algo que esta sección resuelve.
  for (const texto of [
    'Origen 100% colombiano',
    'Tostado artesanal semanal',
    'Envío a todo el país',
    'Garantía de frescura',
  ]) {
    assert.ok(html.includes(texto), `falta la insignia "${texto}"`);
  }
  // La forma de la sección no cambió: el divisor decorativo, el fondo de banda con fallback a
  // `--sf-fondo`, y el grid de 4 columnas en escritorio.
  assert.ok(html.includes('sf-divisor-y'));
  assert.ok(html.includes('bg-[var(--sf-banda,var(--sf-fondo))]'));
  assert.ok(html.includes('lg:grid-cols-4'));
  // Exactamente 4 insignias — ni una repetida, ni una de más.
  const insignias = (html.match(/class="flex items-center gap-3"/g) || []).length;
  assert.equal(insignias, 4);
});

test('`visible:true` explícito (una fila que confirma el toggle) rinde IGUAL que sin fila — el interruptor no cambia el contenido', () => {
  const conFila = { ...DEFAULTS, trustBadges: { visible: true } } as SiteContentData;
  assert.equal(renderTrustBadges(conFila), renderTrustBadges(resolverSiteContent({})));
});

// ─── EL `style` (esquema por banda) sigue viajando igual, gated o no ───────────────────────────────

test('el `style` de esquema-por-banda se sigue aplicando cuando la sección está visible (el gate no lo intercepta)', () => {
  const content = { ...DEFAULTS, trustBadges: { visible: true } } as SiteContentData;
  const html = renderToStaticMarkup(
    React.createElement(SiteContentProvider, {
      value: content,
      children: React.createElement<{ style?: React.CSSProperties }>(TrustBadges, { style: { backgroundColor: 'red' } }),
    }),
  );
  assert.ok(html.includes('style="background-color:red"'));
});
