import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULTS,
  REGISTRY,
  mezclarBorrador,
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

// ── mezclarBorrador (overlay por sección — la base del loader de borrador) ────────────

test('mezclarBorrador: una sección borroneada pisa la publicada; las otras quedan', () => {
  const content  = { hero: { titulo: 'Publicado' }, otra: { x: 1 } };
  const borrador = { hero: { titulo: 'Borrador' } };
  const m = mezclarBorrador(content, borrador);
  assert.deepEqual(m.hero, { titulo: 'Borrador' }); // pisada entera por el borrador
  assert.deepEqual(m.otra, { x: 1 });               // sin borrador → intacta (no se arrastra)
});

test('mezclarBorrador: sin borrador (null/undefined/{}) → idéntico a lo publicado', () => {
  const content = { hero: { titulo: 'X' } };
  for (const b of [null, undefined, {}]) {
    assert.deepEqual(mezclarBorrador(content, b), content);
  }
});

test('mezclarBorrador: borrador basura (string/array/número) → se ignora, queda lo publicado', () => {
  const content = { hero: { titulo: 'X' } };
  for (const b of ['x', [1], 42]) {
    assert.deepEqual(mezclarBorrador(content, b), content);
  }
});

test('mezclarBorrador PISA la sección entera, NO hace deep-merge de campos', () => {
  // El editor guarda secciones COMPLETAS, así que la sección del borrador es la verdad entera.
  const content  = { hero: { titulo: 'pub', subtitulo: 'sub pub' } };
  const borrador = { hero: { titulo: 'draft' } };
  assert.deepEqual(mezclarBorrador(content, borrador).hero, { titulo: 'draft' });
});

test('el loader compone mezclar→resolver: el hero del borrador se ve resuelto', () => {
  const content  = { hero: { titulo: 'Hero publicado', subtitulo: 'Sub pub' } };
  const borrador = { hero: { titulo: 'Hero borrador' } };
  const r = resolverSiteContent(mezclarBorrador(content, borrador));
  assert.equal(r.hero.titulo, 'Hero borrador');            // el borrador del hero, resuelto
  assert.equal(r.hero.subtitulo, DEFAULTS.hero.subtitulo); // borrador pisó la sección entera → subtitulo ausente → default
});

// ── BrandStory (2ª sección: h2 un campo, 2 párrafos, 4 imágenes fijas, ocultable) ─────

test('brandStory: sin nada guardado → todos los defaults', () => {
  assert.deepEqual(resolverSiteContent({}).brandStory, DEFAULTS.brandStory);
});

test('brandStory REQUERIDO vacío → default (titulo, parrafo1, las 4 imágenes)', () => {
  const r = resolverSiteContent({ brandStory: { titulo: '', parrafo1: '   ', imagen1: '', imagen3: '' } });
  assert.equal(r.brandStory.titulo, DEFAULTS.brandStory.titulo);
  assert.equal(r.brandStory.parrafo1, DEFAULTS.brandStory.parrafo1);
  assert.equal(r.brandStory.imagen1, DEFAULTS.brandStory.imagen1);
  assert.equal(r.brandStory.imagen3, DEFAULTS.brandStory.imagen3);
});

test('brandStory OPCIONAL presente-pero-vacío → "" (eyebrow y parrafo2 se omiten en el render)', () => {
  const r = resolverSiteContent({ brandStory: { eyebrow: '', parrafo2: '' } });
  assert.equal(r.brandStory.eyebrow, '');
  assert.equal(r.brandStory.parrafo2, '');
});

test('brandStory OPCIONAL ausente → default (el editor lo pre-llena)', () => {
  const r = resolverSiteContent({ brandStory: { titulo: 'x' } });
  assert.equal(r.brandStory.eyebrow, DEFAULTS.brandStory.eyebrow);
  assert.equal(r.brandStory.parrafo2, DEFAULTS.brandStory.parrafo2);
});

test('resolver una sección NO pisa la otra (hero y brandStory coexisten)', () => {
  const r = resolverSiteContent({ brandStory: { titulo: 'Otra historia' } });
  assert.equal(r.brandStory.titulo, 'Otra historia');
  assert.deepEqual(r.hero, DEFAULTS.hero); // el hero intacto
});

test('brandStory es OCULTABLE de verdad: visible:false lo oculta; visible:true/ausente lo muestra', () => {
  const def = REGISTRY.brandStory;
  assert.equal(def.ocultable, true); // el primer ocultable real (hero es false)
  assert.equal(seccionEsVisible(def, { visible: false }), false);
  assert.equal(seccionEsVisible(def, { visible: true }), true);
  assert.equal(seccionEsVisible(def, {}), true);
});

test('REGISTRY.brandStory.imagenes lista los 4 campos de imagen, y los 4 son requeridos', () => {
  // Tripwire para el borrado de blobs (commit 3): si alguien agrega/renombra una imagen y olvida
  // `imagenes`, el diff dejaría de cubrirla. Y las 4 deben ser requeridas (collage rígido).
  assert.deepEqual(REGISTRY.brandStory.imagenes, ['imagen1', 'imagen2', 'imagen3', 'imagen4']);
  for (const f of REGISTRY.brandStory.imagenes!) {
    assert.equal(REGISTRY.brandStory.campos[f], 'requerido');
  }
});

// ── SubscriptionCTA (3ª sección: solo texto, hasta 4 bullets opcionales, ocultable) ─────

test('subscriptionCTA: sin nada guardado → todos los defaults', () => {
  assert.deepEqual(resolverSiteContent({}).subscriptionCTA, DEFAULTS.subscriptionCTA);
});

test('subscriptionCTA REQUERIDO vacío → default (titulo, subtitulo, ctaLabel)', () => {
  const r = resolverSiteContent({ subscriptionCTA: { titulo: '', subtitulo: '   ', ctaLabel: '' } });
  assert.equal(r.subscriptionCTA.titulo, DEFAULTS.subscriptionCTA.titulo);
  assert.equal(r.subscriptionCTA.subtitulo, DEFAULTS.subscriptionCTA.subtitulo);
  assert.equal(r.subscriptionCTA.ctaLabel, DEFAULTS.subscriptionCTA.ctaLabel);
});

test('subscriptionCTA bullet OPCIONAL presente-pero-vacío → "" (el componente lo SALTA con .filter)', () => {
  // Vaciar el 2 y dejar el 3: el resolver guarda bullet2="" y bullet3 con texto; el .filter del
  // componente cierra la lista sin hueco (son "hasta 4 bullets", no "4 slots"). Acá se afirma la
  // mitad del resolver —el vacío queda ""—; el cierre sin hueco es del componente (commit 2, gate).
  const r = resolverSiteContent({ subscriptionCTA: { bullet2: '', bullet3: 'Tercero' } });
  assert.equal(r.subscriptionCTA.bullet2, '');       // presente-vacío → "" → se omite en el render
  assert.equal(r.subscriptionCTA.bullet3, 'Tercero'); // el que quedó, intacto
});

test('subscriptionCTA bullet/eyebrow OPCIONAL ausente → default (el editor lo pre-llena)', () => {
  const r = resolverSiteContent({ subscriptionCTA: { titulo: 'x' } });
  assert.equal(r.subscriptionCTA.eyebrow, DEFAULTS.subscriptionCTA.eyebrow);
  assert.equal(r.subscriptionCTA.bullet1, DEFAULTS.subscriptionCTA.bullet1);
});

test('resolver: subscriptionCTA NO pisa a hero ni a brandStory', () => {
  const r = resolverSiteContent({ subscriptionCTA: { titulo: 'Otro CTA' } });
  assert.equal(r.subscriptionCTA.titulo, 'Otro CTA');
  assert.deepEqual(r.hero, DEFAULTS.hero);
  assert.deepEqual(r.brandStory, DEFAULTS.brandStory);
});

test('subscriptionCTA es OCULTABLE y NO tiene imagenes (sección de solo texto)', () => {
  const def = REGISTRY.subscriptionCTA;
  assert.equal(def.ocultable, true);
  assert.equal(def.imagenes, undefined); // sin imágenes → no toca el borrado de blobs
  assert.equal(seccionEsVisible(def, { visible: false }), false);
  assert.equal(seccionEsVisible(def, { visible: true }), true);
});
