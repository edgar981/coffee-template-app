import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import RielSocial from '@/components/storefront/RielSocial';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { SiteSettingsProvider } from '@/components/storefront/SiteSettingsProvider';
import type { SiteSettings } from '@/lib/config/site-settings';

import { DEFAULTS, resolverSiteContent, resolverRielSocial, type SiteContentData } from './site-content-defaults';
import { CORTE, PATIO, PRESETS, mergePresetEnContent, validarPreset, presetCompleto } from './themes';
import { contenidoConPresetDeVista } from './theme-mirador';

// CROMO-RIEL-SOCIAL-1 — el riel social fijo a la izquierda, gemelo tematizable del `.rail` del
// prototipo (docs/prototipos/cafeone/css/app.css:326-338, index.html:109-115). Vive en su PROPIA
// meta (`content.rielSocial`, `RielSocialContent`), NI dentro de `cromo` NI dentro de `volverArriba`
// — ver el docstring de `RielSocialContent` (site-content-defaults.ts) para el porqué: MISMA razón
// que ya separó `volverArriba` de `cromo` (§ CROMO-VOLVER-ARRIBA-1), y `volverArriba` ya cerró SU
// PROPIO contrato de 1 clave (§ cromo-volver-arriba.test.ts, fuera de `touches:` de este slice).
//
// Este archivo afirma el modelo (DEFAULTS/resolver), el gate de byte-identidad (Nayoli no monta el
// riel), el cableado del preset (CORTE la enciende, los otros cinco no la tocan), y el render por
// `renderToStaticMarkup` (sin jsdom, § CLAUDE.md) — incluida la SEGUNDA gate: los links salen de
// `SiteSetting.redes` (§ MUESTRARIO-REDES-ADICIONALES-1), cada uno oculto cuando no está en la
// lista — reemplaza la lectura directa de `instagram`/`.whatsapp` de antes de ese slice.

const SETTINGS_BASE: SiteSettings = {
  nombre: 'Nayoli',
  tagline: '',
  descripcionFooter: '',
  whatsapp: '',
  instagram: '',
  emailRemitente: '',
  emailReplyTo: null,
  adminEmail: null,
  metodosPago: [],
  redes: [],
  metodoPasarelaDesalineado: null,
};

const SETTINGS_CON_LOS_DOS: SiteSettings = {
  ...SETTINGS_BASE,
  redes: [
    { tipo: 'instagram', valor: 'nayolicafe' },
    { tipo: 'whatsapp', valor: '573001234567' },
  ],
};

function renderRielSocial(content: SiteContentData, settings: SiteSettings = SETTINGS_BASE): string {
  const arbol = React.createElement(SiteSettingsProvider, {
    value: settings,
    children: React.createElement(SiteContentProvider, { value: content, children: React.createElement(RielSocial) }),
  });
  return renderToStaticMarkup(arbol);
}

// ─── EL MODELO ──────────────────────────────────────────────────────────────────────────────────

test('DEFAULTS.rielSocial nace OFF (visible:false) — el riel no se monta solo', () => {
  assert.equal(DEFAULTS.rielSocial.visible, false);
});

test('resolverRielSocial: SOFT — un valor que no es boolean no se respeta, cae al default', () => {
  const r = resolverRielSocial({ visible: 'true' }, { visible: false });
  assert.equal(r.visible, false);
});

test('resolverRielSocial: un boolean real guardado se respeta', () => {
  assert.deepEqual(resolverRielSocial({ visible: true }, {}), { visible: true });
});

test('resolverRielSocial: ausente en lo guardado cae al DEFAULT provisto (no siempre a false)', () => {
  assert.deepEqual(resolverRielSocial({}, { visible: true }), { visible: true });
  assert.deepEqual(resolverRielSocial(undefined, undefined), { visible: false });
});

test('sin fila (Nayoli), rielSocial resuelve exactamente al DEFAULT', () => {
  const resuelto = resolverSiteContent({});
  assert.deepEqual(resuelto.rielSocial, DEFAULTS.rielSocial);
});

// ─── EL RENDER — LA INVARIANTE: Nayoli queda BYTE-IDÉNTICA ─────────────────────────────────────

test('LA INVARIANTE: Nayoli (resolverSiteContent({}), sin fila) NO monta el riel — ni un nodo, aunque los DOS campos sociales existan', () => {
  const html = renderRielSocial(resolverSiteContent({}), SETTINGS_CON_LOS_DOS);
  assert.equal(html, '');
});

test('con rielSocial.visible:false explícito, tampoco monta (no sólo el default implícito)', () => {
  const content = { ...DEFAULTS, rielSocial: { visible: false } } as SiteContentData;
  assert.equal(renderRielSocial(content, SETTINGS_CON_LOS_DOS), '');
});

test('con rielSocial.visible:true PERO los DOS campos sociales vacíos: tampoco monta — una pastilla vacía no es chrome', () => {
  const content = { ...DEFAULTS, rielSocial: { visible: true } } as SiteContentData;
  assert.equal(renderRielSocial(content, SETTINGS_BASE), '');
});

test('con rielSocial.visible:true + SOLO instagram: UN botón, con la superficie del tema', () => {
  const content = { ...DEFAULTS, rielSocial: { visible: true } } as SiteContentData;
  const settings: SiteSettings = { ...SETTINGS_BASE, redes: [{ tipo: 'instagram', valor: 'nayolicafe' }] };
  const html = renderRielSocial(content, settings);
  assert.ok(html !== '');
  const botones = html.match(/<a\b/g) ?? [];
  assert.equal(botones.length, 1);
  assert.match(html, /aria-label="Instagram de Nayoli"/);
  assert.ok(!html.includes('WhatsApp de Nayoli'));
  assert.ok(html.includes('--sf-tinta'), 'la superficie del riel debe ser --sf-tinta');
  assert.ok(html.includes('--sf-sobre'), 'el ícono debe leer el sobre-tinta (--sf-sobre)');
});

test('con rielSocial.visible:true + SOLO whatsapp: UN botón, sin el de instagram', () => {
  const content = { ...DEFAULTS, rielSocial: { visible: true } } as SiteContentData;
  const settings: SiteSettings = { ...SETTINGS_BASE, redes: [{ tipo: 'whatsapp', valor: '573001234567' }] };
  const html = renderRielSocial(content, settings);
  assert.ok(html !== '');
  const botones = html.match(/<a\b/g) ?? [];
  assert.equal(botones.length, 1);
  assert.match(html, /aria-label="WhatsApp de Nayoli"/);
  assert.ok(!html.includes('Instagram de Nayoli'));
});

test('con rielSocial.visible:true + LOS DOS campos: DOS botones, superficie tinta + sobre-tinta', () => {
  const content = { ...DEFAULTS, rielSocial: { visible: true } } as SiteContentData;
  const html = renderRielSocial(content, SETTINGS_CON_LOS_DOS);
  assert.ok(html !== '');
  const botones = html.match(/<a\b/g) ?? [];
  assert.equal(botones.length, 2);
  assert.match(html, /aria-label="Instagram de Nayoli"/);
  assert.match(html, /aria-label="WhatsApp de Nayoli"/);
  assert.match(html, /<nav[^>]*aria-label="Redes sociales"/);
});

// ─── EL PRESET — CORTE la enciende, y es el ÚNICO ──────────────────────────────────────────────

test('CORTE declara rielSocialVisible:true — sigue validando COMPLETO', () => {
  assert.equal(CORTE.rielSocialVisible, true);
  assert.deepEqual(validarPreset(CORTE), []);
  assert.ok(presetCompleto(CORTE));
});

test('CORTE es el ÚNICO preset del catálogo que declara rielSocialVisible', () => {
  for (const preset of PRESETS) {
    if (preset.clave === 'CORTE') continue;
    assert.equal(preset.rielSocialVisible, undefined, `${preset.clave} no debería declarar rielSocialVisible`);
  }
});

// ─── EL MERGE — sólo CORTE enciende; los demás dejan la meta en su default de HOY ──────────────

test('mergePresetEnContent(_, CORTE): escribe rielSocial.visible:true', () => {
  const despues = mergePresetEnContent({ ...DEFAULTS }, CORTE);
  const rielSocial = despues.rielSocial as Record<string, unknown>;
  assert.equal(rielSocial.visible, true);
});

test('mergePresetEnContent(_, PATIO): PATIO no declara el eje — la meta queda en su default de HOY (false)', () => {
  assert.equal(PATIO.rielSocialVisible, undefined);
  const despues = mergePresetEnContent({ ...DEFAULTS }, PATIO);
  const rielSocial = despues.rielSocial as Record<string, unknown>;
  assert.equal(rielSocial.visible, false);
});

test('mergePresetEnContent(_, preset) sobre los CINCO presets restantes: ninguno declara rielSocialVisible, así que ninguno enciende el riel', () => {
  for (const preset of PRESETS) {
    if (preset.clave === 'CORTE') continue;
    const despues = mergePresetEnContent({ ...DEFAULTS }, preset);
    const rielSocial = despues.rielSocial as Record<string, unknown>;
    assert.equal(rielSocial.visible, false, `${preset.clave} no debería encender rielSocial.visible`);
  }
});

// ─── EL MIRADOR (`?tema=CORTE`) — la vista de sólo-lectura que ejerce la cadena completa ─────────

test('sin ?tema= (mirador con clave undefined): Nayoli no cambia — el riel sigue sin montarse', () => {
  const nayoli = resolverSiteContent({});
  const sinTema = contenidoConPresetDeVista(nayoli, undefined);
  assert.equal(sinTema, nayoli, 'byte-idéntico: la misma referencia, ni un campo tocado');
  assert.equal(renderRielSocial(sinTema, SETTINGS_CON_LOS_DOS), '');
});

test('?tema=CORTE sobre Nayoli: rielSocial pasa a visible y el riel se monta con la superficie tinta', () => {
  const nayoli = resolverSiteContent({});
  const conCorte = contenidoConPresetDeVista(nayoli, 'CORTE');
  assert.equal(conCorte.rielSocial.visible, true);

  const html = renderRielSocial(conCorte, SETTINGS_CON_LOS_DOS);
  assert.ok(html !== '');
  assert.match(html, /<nav[^>]*aria-label="Redes sociales"/);
  assert.ok(html.includes('--sf-tinta'));
});
