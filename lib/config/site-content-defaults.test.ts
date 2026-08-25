import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULTS,
  resolverSiteContent,
  seccionEsVisible,
  type SeccionDef,
} from './site-content-defaults';

// Capa 1 del loader SOFT del contenido: el resolver (default/omit por campo) y la
// visibilidad (visible + hide-on-empty). Sin base — lógica pura.

test('sin nada guardado → todos los defaults del hero', () => {
  const r = resolverSiteContent({});
  assert.deepEqual(r.hero, DEFAULTS.hero);
});

test('sin nada guardado y entrada basura (null / string / array) → defaults, no lanza', () => {
  for (const basura of [null, undefined, 'x', 42, [], { hero: 'no-obj' }]) {
    assert.deepEqual(resolverSiteContent(basura).hero, DEFAULTS.hero);
  }
});

test('REQUERIDO vacío → cae al default (el storefront nunca queda sin ese dato)', () => {
  const r = resolverSiteContent({ hero: { titulo: '', subtitulo: '   ' } });
  assert.equal(r.hero.titulo, DEFAULTS.hero.titulo);
  assert.equal(r.hero.subtitulo, DEFAULTS.hero.subtitulo);
});

test('REQUERIDO con valor → se respeta', () => {
  const r = resolverSiteContent({ hero: { titulo: 'Otro titular' } });
  assert.equal(r.hero.titulo, 'Otro titular');
});

test('REQUERIDO no-string (número) → tratado como vacío → default', () => {
  const r = resolverSiteContent({ hero: { titulo: 42 } });
  assert.equal(r.hero.titulo, DEFAULTS.hero.titulo);
});

test('OPCIONAL presente-pero-vacío → queda "" (el render lo omite)', () => {
  const r = resolverSiteContent({ hero: { eyebrow: '', ctaSecundarioLabel: '' } });
  assert.equal(r.hero.eyebrow, '');
  assert.equal(r.hero.ctaSecundarioLabel, '');
});

test('OPCIONAL ausente → default (el editor lo pre-llena la primera vez)', () => {
  const r = resolverSiteContent({ hero: { titulo: 'x' } });
  assert.equal(r.hero.eyebrow, DEFAULTS.hero.eyebrow);
});

test('visible sólo se sobreescribe con un booleano explícito', () => {
  assert.equal(resolverSiteContent({ hero: { visible: false } }).hero.visible, false);
  assert.equal(resolverSiteContent({ hero: { visible: 'no' } }).hero.visible, true); // basura → default
  assert.equal(resolverSiteContent({ hero: {} }).hero.visible, true);
});

// ── seccionEsVisible ─────────────────────────────────────────────────────────

test('el hero (ocultable:false) SIEMPRE es visible, aun con visible:false guardado', () => {
  const def: SeccionDef = { label: 'X',ocultable: false, campos: {} };
  assert.equal(seccionEsVisible(def, { visible: false }), true);
});

test('repeater: se auto-oculta con el array vacío (hide-on-empty), aun con visible:true', () => {
  const def: SeccionDef = { label: 'X',ocultable: true, repeater: { itemsKey: 'items' }, campos: {} };
  assert.equal(seccionEsVisible(def, { visible: true, items: [] }), false);
  assert.equal(seccionEsVisible(def, { visible: true, items: [{ x: 1 }] }), true);
});

test('repeater ocultable:false igual se oculta si el array está vacío (hide-on-empty gana)', () => {
  const def: SeccionDef = { label: 'X',ocultable: false, repeater: { itemsKey: 'items' }, campos: {} };
  assert.equal(seccionEsVisible(def, { items: [] }), false);
  assert.equal(seccionEsVisible(def, { items: [1] }), true);
});

test('sección ocultable no-repeater: visible:false → oculta; visible:true → muestra', () => {
  const def: SeccionDef = { label: 'X',ocultable: true, campos: {} };
  assert.equal(seccionEsVisible(def, { visible: false }), false);
  assert.equal(seccionEsVisible(def, { visible: true }), true);
});
