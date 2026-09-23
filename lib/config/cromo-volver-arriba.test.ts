import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import BackToTop from '@/components/storefront/BackToTop';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { CartProvider } from '@/lib/cartStore';

import { DEFAULTS, resolverSiteContent, resolverVolverArriba, type SiteContentData } from './site-content-defaults';
import { CORTE, PATIO, PRESETS, mergePresetEnContent, validarPreset, presetCompleto } from './themes';
import { contenidoConPresetDeVista } from './theme-mirador';

// CROMO-VOLVER-ARRIBA-1 — el botón flotante "volver arriba", gemelo tematizable del `.to-top` del
// prototipo (docs/prototipos/cafeone/css/app.css:340-353, js/app.js:356-365). Vive en su PROPIA meta
// (`content.volverArriba`, `VolverArribaContent`), NO dentro de `cromo` — ver el docstring de
// `VolverArribaContent` (site-content-defaults.ts) para el porqué: `cromo` ya tiene un contrato
// EXHAUSTIVO de 3 claves afirmado por `cromo-tematizable.test.ts` (fuera de `touches` de este
// slice), y esta capacidad es de otra naturaleza — decide si un COMPONENTE ENTERO se monta
// (`BackToTop.tsx`), no ajusta un chrome que ya está siempre montado.
//
// Este archivo afirma el modelo (DEFAULTS/resolver), el gate de byte-identidad (Nayoli no monta el
// botón), el cableado del preset (CORTE la enciende, los otros cinco no la tocan) y el render por
// `renderToStaticMarkup` (sin jsdom, § CLAUDE.md).

function renderBackToTop(content: SiteContentData): string {
  const arbol = React.createElement(SiteContentProvider, {
    value: content,
    children: React.createElement(CartProvider, { children: React.createElement(BackToTop) }),
  });
  return renderToStaticMarkup(arbol);
}

// ─── EL MODELO ──────────────────────────────────────────────────────────────────────────────────

test('DEFAULTS.volverArriba nace OFF (visible:false) — el botón no se monta solo', () => {
  assert.equal(DEFAULTS.volverArriba.visible, false);
});

test('resolverVolverArriba: SOFT — un valor que no es boolean no se respeta, cae al default', () => {
  const r = resolverVolverArriba({ visible: 'true' }, { visible: false });
  assert.equal(r.visible, false);
});

test('resolverVolverArriba: un boolean real guardado se respeta', () => {
  assert.deepEqual(resolverVolverArriba({ visible: true }, {}), { visible: true });
});

test('resolverVolverArriba: ausente en lo guardado cae al DEFAULT provisto (no siempre a false)', () => {
  assert.deepEqual(resolverVolverArriba({}, { visible: true }), { visible: true });
  assert.deepEqual(resolverVolverArriba(undefined, undefined), { visible: false });
});

test('sin fila (Nayoli), volverArriba resuelve exactamente al DEFAULT', () => {
  const resuelto = resolverSiteContent({});
  assert.deepEqual(resuelto.volverArriba, DEFAULTS.volverArriba);
});

// ─── EL RENDER — LA INVARIANTE: Nayoli queda BYTE-IDÉNTICA ─────────────────────────────────────

test('LA INVARIANTE: Nayoli (resolverSiteContent({}), sin fila) NO monta el botón — ni un nodo', () => {
  const html = renderBackToTop(resolverSiteContent({}));
  assert.equal(html, '');
});

test('con volverArriba.visible:false explícito, tampoco monta (no sólo el default implícito)', () => {
  const content = { ...DEFAULTS, volverArriba: { visible: false } } as SiteContentData;
  assert.equal(renderBackToTop(content), '');
});

test('con volverArriba.visible:true: el botón SE MONTA, con su aria-label y el color de ACCIÓN', () => {
  const content = { ...DEFAULTS, volverArriba: { visible: true } } as SiteContentData;
  const html = renderBackToTop(content);
  assert.ok(html !== '');
  assert.match(html, /<button[^>]*aria-label="Volver arriba"/);
  assert.ok(html.includes('--sf-accion'), 'el fondo debe leer el token de ACCIÓN (--sf-accion)');
  assert.ok(
    html.includes('--sf-tinta'),
    'el ícono debe leer el MISMO par (fondo accion + texto tinta) que ya visten los 5 CTA primarios del storefront',
  );
  assert.ok(html.includes('sf-pildora'), 'debe ser una PASTILLA, como el `.to-top` del prototipo');
});

// ─── EL PRESET — CORTE la enciende, y es el ÚNICO ──────────────────────────────────────────────

test('CORTE declara volverArribaVisible:true — sigue validando COMPLETO', () => {
  assert.equal(CORTE.volverArribaVisible, true);
  assert.deepEqual(validarPreset(CORTE), []);
  assert.ok(presetCompleto(CORTE));
});

test('CORTE es el ÚNICO preset del catálogo que declara volverArribaVisible', () => {
  for (const preset of PRESETS) {
    if (preset.clave === 'CORTE') continue;
    assert.equal(preset.volverArribaVisible, undefined, `${preset.clave} no debería declarar volverArribaVisible`);
  }
});

// ─── EL MERGE — sólo CORTE enciende; los demás dejan la meta en su default de HOY ──────────────

test('mergePresetEnContent(_, CORTE): escribe volverArriba.visible:true', () => {
  const despues = mergePresetEnContent({ ...DEFAULTS }, CORTE);
  const volverArriba = despues.volverArriba as Record<string, unknown>;
  assert.equal(volverArriba.visible, true);
});

test('mergePresetEnContent(_, PATIO): PATIO no declara el eje — la meta queda en su default de HOY (false)', () => {
  assert.equal(PATIO.volverArribaVisible, undefined);
  const despues = mergePresetEnContent({ ...DEFAULTS }, PATIO);
  const volverArriba = despues.volverArriba as Record<string, unknown>;
  assert.equal(volverArriba.visible, false);
});

test('mergePresetEnContent(_, CORTE) sobre los CINCO presets restantes: ninguno declara volverArribaVisible, así que ninguno enciende el botón', () => {
  for (const preset of PRESETS) {
    if (preset.clave === 'CORTE') continue;
    const despues = mergePresetEnContent({ ...DEFAULTS }, preset);
    const volverArriba = despues.volverArriba as Record<string, unknown>;
    assert.equal(volverArriba.visible, false, `${preset.clave} no debería encender volverArriba.visible`);
  }
});

// ─── EL MIRADOR (`?tema=CORTE`) — la vista de sólo-lectura que ejerce la cadena completa ─────────

test('sin ?tema= (mirador con clave undefined): Nayoli no cambia — el botón sigue sin montarse', () => {
  const nayoli = resolverSiteContent({});
  const sinTema = contenidoConPresetDeVista(nayoli, undefined);
  assert.equal(sinTema, nayoli, 'byte-idéntico: la misma referencia, ni un campo tocado');
  assert.equal(renderBackToTop(sinTema), '');
});

test('?tema=CORTE sobre Nayoli: volverArriba pasa a visible y el botón se monta con el color de ACCIÓN', () => {
  const nayoli = resolverSiteContent({});
  const conCorte = contenidoConPresetDeVista(nayoli, 'CORTE');
  assert.equal(conCorte.volverArriba.visible, true);

  const html = renderBackToTop(conCorte);
  assert.ok(html !== '');
  assert.match(html, /<button[^>]*aria-label="Volver arriba"/);
  assert.ok(html.includes('--sf-accion'));
});
