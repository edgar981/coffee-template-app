import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import GrindChooser from '@/components/storefront/home/GrindChooser';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { PreviewProvider } from '@/components/storefront/PreviewMode';
import { CartProvider } from '@/lib/cartStore';
import {
  DEFAULTS,
  REGISTRY,
  BANDA_IDS,
  ORDEN_DEFAULT,
  BANDA_NOSOTROS_IDS,
  mezclarBorrador,
  resolverSiteContent,
  resolverItems,
  resolverPaginas,
  resolverTema,
  resolverEsquemas,
  resolverOrden,
  resolverOrdenNosotros,
  resolverVariantesBandas,
  VARIANTES_ESTRUCTURALES,
  resolverVariante,
  bandaOscuraCanonica,
  bandaUniforme,
  varianteDeBanda,
  seccionEsVisible,
  faqSuscripcionesVisible,
  PUNTOS_FOCALES,
  VELO_INTENSIDADES,
  TICKER_VELOCIDADES,
  ALTURAS_HERO,
  CLASES_ALTURA_HERO,
  claseAlturaHero,
  OPCIONES_VELO_COMBO,
  veloComboDeCampos,
  camposDeVeloCombo,
  productoSpotlight,
  productoOtraTalla,
  productoMarquesina,
  type SeccionDef,
  type VariantesDef,
  type SeccionKey,
  type PresentacionesContent,
} from './site-content-defaults';
import { hrefCategoria } from '../productos/categorias';

// Capa 1 del loader SOFT del contenido: el resolver (default/omit por campo) y la
// visibilidad (visible + hide-on-empty). Sin base — lógica pura.

test('sin nada guardado → todos los defaults del hero', () => {
  const r = resolverSiteContent({});
  assert.deepEqual(r.hero, DEFAULTS.hero);
});

// § MUESTRARIO-CARRITO-BARRA-ENVIO-1: `carritoEnvio` (meta, no sección) queda cableada dentro de
// `resolverSiteContent` como `volverArriba`/`rielSocial` -- sin fila, byte-idéntica al default (sin
// la barra visual); con un valor guardado, ese valor sobrevive. El resto del comportamiento de la
// meta (el resolver en sí, la ruta, el control del panel, el preset) se afirma en
// `lib/config/detalles-sitio.test.ts`; esto es sólo el CABLEADO dentro de este archivo.
test('sin nada guardado → carritoEnvio.visible cae al default (false, byte-idéntico)', () => {
  const r = resolverSiteContent({});
  assert.deepEqual(r.carritoEnvio, DEFAULTS.carritoEnvio);
});

test('carritoEnvio.visible guardado explícito sobrevive la resolución completa', () => {
  const r = resolverSiteContent({ carritoEnvio: { visible: true } });
  assert.equal(r.carritoEnvio.visible, true);
});

// § MUESTRARIO-CARRITO-COMPOSICION-1: `carrito` (meta, no sección) queda cableada dentro de
// `resolverSiteContent` como `carritoEnvio`/`navDrawerMovil` -- sin fila, byte-idéntica al default
// ('anclado', el cajón pegado al borde de hoy); con un valor guardado del set cerrado, ese valor
// sobrevive. El resto del comportamiento de la meta (el resolver en sí, la ruta, el control del
// panel, el preset, el render del cajón) se afirma en `lib/config/detalles-sitio.test.ts`; esto es
// sólo el CABLEADO dentro de este archivo.
test('sin nada guardado → carrito.variante cae al default (anclado, byte-idéntico)', () => {
  const r = resolverSiteContent({});
  assert.deepEqual(r.carrito, DEFAULTS.carrito);
});

test('carrito.variante guardado explícito ("flotante") sobrevive la resolución completa', () => {
  const r = resolverSiteContent({ carrito: { variante: 'flotante' } });
  assert.equal(r.carrito.variante, 'flotante');
});

test('carrito.variante guardado fuera del set cerrado cae al default, dentro de la resolución completa', () => {
  const r = resolverSiteContent({ carrito: { variante: 'volando' } });
  assert.equal(r.carrito.variante, 'anclado');
});

// § CROMO-NAV-DIRECCION-SCROLL-1: `navTratamiento.direccion` es un CAMPO nuevo de una meta que YA
// estaba cableada (§ CROMO-NAV-TRATAMIENTO-1) -- sin fila, byte-idéntica al default (`false`, el nav
// no reacciona a la dirección del scroll); con un valor guardado, ese valor sobrevive, INDEPENDIENTE
// de `activo`. El resto del comportamiento de la meta (el resolver en sí, la ruta, el control del
// panel, el preset) se afirma en `lib/config/cromo-nav-tratamiento.test.ts`; esto es sólo el
// CABLEADO dentro de este archivo, mismo patrón que `carritoEnvio`/`carrito` arriba.
test('sin nada guardado → navTratamiento.direccion cae al default (false, byte-idéntico)', () => {
  const r = resolverSiteContent({});
  assert.deepEqual(r.navTratamiento, DEFAULTS.navTratamiento);
  assert.equal(r.navTratamiento.direccion, false);
});

test('navTratamiento.direccion guardado explícito sobrevive la resolución completa, sin tocar `activo`', () => {
  const r = resolverSiteContent({ navTratamiento: { direccion: true } });
  assert.equal(r.navTratamiento.direccion, true);
  assert.equal(r.navTratamiento.activo, false, 'un guardado que sólo trae `direccion` no debe encender `activo`');
});

// § CROMO-NAV-FILETE-1: `navTratamiento.filete` es OTRO CAMPO nuevo de la MISMA meta ya cableada —
// mismo patrón que `direccion` arriba, mismo alcance (esto es sólo el CABLEADO; el resolver, la
// ruta, el control del panel y el preset se afirman en `lib/config/cromo-nav-tratamiento.test.ts`).
test('sin nada guardado → navTratamiento.filete cae al default (false, byte-idéntico)', () => {
  const r = resolverSiteContent({});
  assert.deepEqual(r.navTratamiento, DEFAULTS.navTratamiento);
  assert.equal(r.navTratamiento.filete, false);
});

test('navTratamiento.filete guardado explícito sobrevive la resolución completa, sin tocar `activo`/`direccion`', () => {
  const r = resolverSiteContent({ navTratamiento: { filete: true } });
  assert.equal(r.navTratamiento.filete, true);
  assert.equal(r.navTratamiento.activo, false, 'un guardado que sólo trae `filete` no debe encender `activo`');
  assert.equal(r.navTratamiento.direccion, false, 'un guardado que sólo trae `filete` no debe encender `direccion`');
});

// § CROMO-NAV-CTA-Y-BADGE-1: `navTratamiento.cta` es OTRO CAMPO nuevo de la MISMA meta ya cableada —
// mismo patrón que `filete` arriba, mismo alcance (esto es sólo el CABLEADO; el resolver, la ruta,
// el control del panel y el preset se afirman en `lib/config/cromo-nav-tratamiento.test.ts`).
test('sin nada guardado → navTratamiento.cta cae al default (false, byte-idéntico)', () => {
  const r = resolverSiteContent({});
  assert.deepEqual(r.navTratamiento, DEFAULTS.navTratamiento);
  assert.equal(r.navTratamiento.cta, false);
});

test('navTratamiento.cta guardado explícito sobrevive la resolución completa, sin tocar `activo`/`direccion`/`filete`', () => {
  const r = resolverSiteContent({ navTratamiento: { cta: true } });
  assert.equal(r.navTratamiento.cta, true);
  assert.equal(r.navTratamiento.activo, false, 'un guardado que sólo trae `cta` no debe encender `activo`');
  assert.equal(r.navTratamiento.direccion, false, 'un guardado que sólo trae `cta` no debe encender `direccion`');
  assert.equal(r.navTratamiento.filete, false, 'un guardado que sólo trae `cta` no debe encender `filete`');
});

// § CROMO-NAV-POSICION-TEMA-REAL-1: `navTratamiento.posicion` es OTRO CAMPO nuevo de la MISMA meta
// ya cableada — mismo patrón que `cta` arriba, mismo alcance (esto es sólo el CABLEADO; el resolver,
// la ruta, el control del panel y el preset se afirman en `lib/config/cromo-nav-tratamiento.test.ts`).
test('sin nada guardado → navTratamiento.posicion cae al default (false, byte-idéntico)', () => {
  const r = resolverSiteContent({});
  assert.deepEqual(r.navTratamiento, DEFAULTS.navTratamiento);
  assert.equal(r.navTratamiento.posicion, false);
});

test('navTratamiento.posicion guardado explícito sobrevive la resolución completa, sin tocar `activo`/`direccion`/`filete`/`cta`', () => {
  const r = resolverSiteContent({ navTratamiento: { posicion: true } });
  assert.equal(r.navTratamiento.posicion, true);
  assert.equal(r.navTratamiento.activo, false, 'un guardado que sólo trae `posicion` no debe encender `activo`');
  assert.equal(r.navTratamiento.direccion, false, 'un guardado que sólo trae `posicion` no debe encender `direccion`');
  assert.equal(r.navTratamiento.filete, false, 'un guardado que sólo trae `posicion` no debe encender `filete`');
  assert.equal(r.navTratamiento.cta, false, 'un guardado que sólo trae `posicion` no debe encender `cta`');
});

// § CROMO-NAV-EXACTO-PROTOTIPO-1: `navTratamiento.subrayado` es OTRO CAMPO nuevo de la MISMA meta
// ya cableada — mismo patrón que `posicion` arriba, mismo alcance (esto es sólo el CABLEADO; el
// resolver, la ruta, el control del panel y el preset se afirman en
// `lib/config/cromo-nav-tratamiento.test.ts`).
test('sin nada guardado → navTratamiento.subrayado cae al default (false, byte-idéntico)', () => {
  const r = resolverSiteContent({});
  assert.deepEqual(r.navTratamiento, DEFAULTS.navTratamiento);
  assert.equal(r.navTratamiento.subrayado, false);
});

test('navTratamiento.subrayado guardado explícito sobrevive la resolución completa, sin tocar `activo`/`direccion`/`filete`/`cta`/`posicion`', () => {
  const r = resolverSiteContent({ navTratamiento: { subrayado: true } });
  assert.equal(r.navTratamiento.subrayado, true);
  assert.equal(r.navTratamiento.activo, false, 'un guardado que sólo trae `subrayado` no debe encender `activo`');
  assert.equal(r.navTratamiento.direccion, false, 'un guardado que sólo trae `subrayado` no debe encender `direccion`');
  assert.equal(r.navTratamiento.filete, false, 'un guardado que sólo trae `subrayado` no debe encender `filete`');
  assert.equal(r.navTratamiento.cta, false, 'un guardado que sólo trae `subrayado` no debe encender `cta`');
  assert.equal(r.navTratamiento.posicion, false, 'un guardado que sólo trae `subrayado` no debe encender `posicion`');
});

// § RIEL-SCROLL-Y-BADGE-DORADO-1: `navTratamiento.badgeColor` es OTRO CAMPO nuevo de la MISMA meta
// ya cableada — mismo patrón que `subrayado` arriba, mismo alcance (esto es sólo el CABLEADO; el
// resolver, la ruta, el control del panel y el preset se afirman en
// `lib/config/cromo-nav-tratamiento.test.ts`). Único matiz: el default es `null` (hex-o-null), no
// `false`.
test('sin nada guardado → navTratamiento.badgeColor cae al default (null, byte-idéntico)', () => {
  const r = resolverSiteContent({});
  assert.deepEqual(r.navTratamiento, DEFAULTS.navTratamiento);
  assert.equal(r.navTratamiento.badgeColor, null);
});

test('navTratamiento.badgeColor guardado explícito sobrevive la resolución completa, sin tocar `activo`/`direccion`/`filete`/`cta`/`posicion`/`subrayado`', () => {
  const r = resolverSiteContent({ navTratamiento: { badgeColor: '#f5b36a' } });
  assert.equal(r.navTratamiento.badgeColor, '#f5b36a');
  assert.equal(r.navTratamiento.activo, false, 'un guardado que sólo trae `badgeColor` no debe encender `activo`');
  assert.equal(r.navTratamiento.direccion, false, 'un guardado que sólo trae `badgeColor` no debe encender `direccion`');
  assert.equal(r.navTratamiento.filete, false, 'un guardado que sólo trae `badgeColor` no debe encender `filete`');
  assert.equal(r.navTratamiento.cta, false, 'un guardado que sólo trae `badgeColor` no debe encender `cta`');
  assert.equal(r.navTratamiento.posicion, false, 'un guardado que sólo trae `badgeColor` no debe encender `posicion`');
  assert.equal(r.navTratamiento.subrayado, false, 'un guardado que sólo trae `badgeColor` no debe encender `subrayado`');
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
  const def: SeccionDef = { label: 'X',ocultable: true, repeater: { itemsKey: 'items', campos: {} }, campos: {} };
  assert.equal(seccionEsVisible(def, { visible: true, items: [] }), false);
  assert.equal(seccionEsVisible(def, { visible: true, items: [{ x: 1 }] }), true);
});

test('repeater ocultable:false igual se oculta si el array está vacío (hide-on-empty gana)', () => {
  const def: SeccionDef = { label: 'X',ocultable: false, repeater: { itemsKey: 'items', campos: {} }, campos: {} };
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

// ── BrandStory (2ª sección: h2 un campo, 2 párrafos, 1 a 4 imágenes, ocultable) ─────
// § CORTE-HISTORIA-COLOR-FOTOS-1: `imagen1` es la ÚNICA imagen REQUERIDA (mínimo una foto);
// `imagen2/3/4` pasaron a OPCIONALES (antes las 4 eran requeridas — el collage era rígido). Las
// pruebas de abajo se reescribieron para reflejar la nueva partición: los tests REQUERIDO cubren
// sólo lo que sigue siendo requerido; los OPCIONAL suman imagen2/3/4 al mismo patrón que
// eyebrow/parrafo2.

test('brandStory: sin nada guardado → todos los defaults', () => {
  assert.deepEqual(resolverSiteContent({}).brandStory, DEFAULTS.brandStory);
});

test('brandStory REQUERIDO vacío → default (titulo, parrafo1, imagen1)', () => {
  const r = resolverSiteContent({ brandStory: { titulo: '', parrafo1: '   ', imagen1: '' } });
  assert.equal(r.brandStory.titulo, DEFAULTS.brandStory.titulo);
  assert.equal(r.brandStory.parrafo1, DEFAULTS.brandStory.parrafo1);
  assert.equal(r.brandStory.imagen1, DEFAULTS.brandStory.imagen1);
});

test('brandStory OPCIONAL presente-pero-vacío → "" (eyebrow, parrafo2, imagen2/3/4 se omiten en el render, § CORTE-HISTORIA-COLOR-FOTOS-1)', () => {
  const r = resolverSiteContent({ brandStory: { eyebrow: '', parrafo2: '', imagen2: '', imagen3: '', imagen4: '' } });
  assert.equal(r.brandStory.eyebrow, '');
  assert.equal(r.brandStory.parrafo2, '');
  assert.equal(r.brandStory.imagen2, '');
  assert.equal(r.brandStory.imagen3, '');
  assert.equal(r.brandStory.imagen4, '');
});

test('brandStory OPCIONAL ausente → default (el editor lo pre-llena)', () => {
  const r = resolverSiteContent({ brandStory: { titulo: 'x' } });
  assert.equal(r.brandStory.eyebrow, DEFAULTS.brandStory.eyebrow);
  assert.equal(r.brandStory.parrafo2, DEFAULTS.brandStory.parrafo2);
  assert.equal(r.brandStory.imagen2, DEFAULTS.brandStory.imagen2);
  assert.equal(r.brandStory.imagen3, DEFAULTS.brandStory.imagen3);
  assert.equal(r.brandStory.imagen4, DEFAULTS.brandStory.imagen4);
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

test('REGISTRY.brandStory.imagenes lista los 4 campos de imagen — imagen1 requerido, imagen2/3/4 opcionales (§ CORTE-HISTORIA-COLOR-FOTOS-1)', () => {
  // Tripwire para el borrado de blobs (commit 3): si alguien agrega/renombra una imagen y olvida
  // `imagenes`, el diff dejaría de cubrirla. La cardinalidad pasó de "4 fijas" a "1 a 4": sólo
  // imagen1 sigue requerida (mínimo una foto); imagen2/3/4 son opcionales (vacías se omiten).
  assert.deepEqual(REGISTRY.brandStory.imagenes, ['imagen1', 'imagen2', 'imagen3', 'imagen4']);
  assert.equal(REGISTRY.brandStory.campos.imagen1, 'requerido');
  for (const f of ['imagen2', 'imagen3', 'imagen4'] as const) {
    assert.equal(REGISTRY.brandStory.campos[f], 'opcional');
  }
});

// ── SubscriptionCTA (3ª sección: hasta 4 bullets opcionales, una imagen de fondo opcional, ocultable) ─────

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

test('subscriptionCTA.imagenFondo: sin nada guardado → "" (fondo sólido, byte-idéntico)', () => {
  assert.equal(DEFAULTS.subscriptionCTA.imagenFondo, '');
  assert.equal(resolverSiteContent({}).subscriptionCTA.imagenFondo, '');
});

test('subscriptionCTA.imagenFondo OPCIONAL: un valor guardado se respeta', () => {
  const r = resolverSiteContent({ subscriptionCTA: { imagenFondo: 'https://blob/foto.jpg' } });
  assert.equal(r.subscriptionCTA.imagenFondo, 'https://blob/foto.jpg');
});

test('subscriptionCTA es OCULTABLE y tiene UNA imagen OPCIONAL (imagenFondo, § MUESTRARIO-CTA-BANNER-FOTO-1)', () => {
  const def = REGISTRY.subscriptionCTA;
  assert.equal(def.ocultable, true);
  assert.deepEqual(def.imagenes, ['imagenFondo']); // nombrada, para que el borrado de blobs la vea
  assert.equal(def.campos.imagenFondo, 'opcional');
  assert.equal(seccionEsVisible(def, { visible: false }), false);
  assert.equal(seccionEsVisible(def, { visible: true }), true);
});

// ── subscriptionCTA GANA VARIANTES (TEMAS-SUBSCRIPTIONCTA-LINEA-1, § eje 5e): cuarta sección con
// `variantes`, gemela de hero/brandStory/presentaciones ──────────────────────────────────────────

test('subscriptionCTA: sin fila, `variante` resuelve a la canónica "bloque" (byte-idéntico)', () => {
  const r = resolverSiteContent({});
  assert.equal(r.subscriptionCTA.variante, 'bloque');
});

test('DEFAULTS.subscriptionCTA.variante es "bloque" (byte-idéntico al bloque de hoy)', () => {
  assert.equal(DEFAULTS.subscriptionCTA.variante, 'bloque');
});

test('subscriptionCTA: una `variante` guardada válida se respeta', () => {
  const r = resolverSiteContent({ subscriptionCTA: { variante: 'linea' } });
  assert.equal(r.subscriptionCTA.variante, 'linea');
});

test('subscriptionCTA: una `variante` guardada fuera del set cae a la canónica', () => {
  const r = resolverSiteContent({ subscriptionCTA: { variante: 'no-existe' } });
  assert.equal(r.subscriptionCTA.variante, 'bloque');
});

test('REGISTRY.subscriptionCTA declara `variantes` con el set cerrado y la canónica, SIN `noUniformes`', () => {
  assert.deepEqual(REGISTRY.subscriptionCTA.variantes, { claves: ['bloque', 'linea'], canonica: 'bloque' });
});

// ── PLATAFORMA: el resolver de arrays (repeater), y el DEFECTO LATENTE que destapa ─────
//
// El REGISTRY ganó `repeater:{itemsKey}` hace tandas (lo leen `seccionEsVisible` e `imagenesDe`),
// PERO el resolver nunca resolvió el array de items. Como no hay ninguna sección repeater todavía,
// nadie lo vio: es el patrón de "código correcto en apariencia, sin consumidor que lo delate".
// Estos tests afirman el HECHO —los items guardados vuelven—, y el primero se ve FALLAR contra el
// resolver de hoy (que devuelve el array default).

const REGISTRO_REPEATER: Record<string, SeccionDef> = {
  lista: {
    label: 'Lista', ocultable: true,
    repeater: { itemsKey: 'items', campos: { nombre: 'requerido', ciudad: 'opcional' } },
    campos: {},
  },
};
const DEFAULTS_REPEATER: Record<string, unknown> = { lista: { visible: true, items: [] } };

test('SILENT-LOSS: el resolver DEVUELVE los items guardados (hoy los ignora → se perderían en silencio)', () => {
  const stored = { lista: { items: [{ nombre: 'Ana', ciudad: 'Cali' }, { nombre: 'Beto', ciudad: 'Medellín' }] } };
  const r = resolverSiteContent(stored, REGISTRO_REPEATER, DEFAULTS_REPEATER) as unknown as Record<string, { items: unknown[] }>;
  // El HECHO: los guardados, no el default []. Con el resolver viejo esto es [] → rojo.
  assert.deepEqual(r.lista.items, [{ nombre: 'Ana', ciudad: 'Cali' }, { nombre: 'Beto', ciudad: 'Medellín' }]);
});

test('resolverItems: requerido se conserva; opcional presente-vacío → ""; opcional ausente → ""', () => {
  const r = resolverItems({ nombre: 'requerido', ciudad: 'opcional' }, [{ nombre: 'Ana', ciudad: '' }, { nombre: 'Beto' }]);
  assert.deepEqual(r, [{ nombre: 'Ana', ciudad: '' }, { nombre: 'Beto', ciudad: '' }]);
});

test('resolverItems: los campos NO declarados (un rating numérico) pasan TAL CUAL', () => {
  const r = resolverItems({ nombre: 'requerido' }, [{ nombre: 'Ana', stars: 4 }]);
  assert.deepEqual(r, [{ nombre: 'Ana', stars: 4 }]);
});

test('resolverItems: descarta lo que no es objeto, y un no-array → [] (SOFT, no lanza)', () => {
  assert.deepEqual(resolverItems({ nombre: 'requerido' }, ['x', 3, null, { nombre: 'Ana' }]), [{ nombre: 'Ana' }]);
  assert.deepEqual(resolverItems({ nombre: 'requerido' }, 'no-array'), []);
});

// ── Testimonios (la 1ª sección repeater: encabezado + lista, ocultable + hide-on-empty) ─────

test('testimonials: sin nada guardado → defaults con items VACÍOS (los 3 fabricados NO están en defaults)', () => {
  assert.deepEqual(resolverSiteContent({}).testimonials.items, []);
});

test('testimonials: los items guardados se RESUELVEN y vuelven (usa la plataforma del repeater)', () => {
  const r = resolverSiteContent({ testimonials: { items: [{ name: 'Ana', text: 'Rico', stars: 4 }] } });
  // name/text conservados, city/product ausentes → "", stars (número) passthrough
  assert.deepEqual(r.testimonials.items, [{ name: 'Ana', text: 'Rico', stars: 4, city: '', product: '' }]);
});

test('testimonials: encabezado de sección — eyebrow opcional (vacío → ""), titulo requerido (vacío → default)', () => {
  const r = resolverSiteContent({ testimonials: { eyebrow: '', titulo: '' } });
  assert.equal(r.testimonials.eyebrow, '');
  assert.equal(r.testimonials.titulo, DEFAULTS.testimonials.titulo);
});

test('testimonials PRECEDENCIA: items vacío OCULTA aunque visible sea true (hide-on-empty gana sobre el toggle)', () => {
  const def = REGISTRY.testimonials;
  assert.equal(def.ocultable, true);
  // LA PRECEDENCIA decidida: vacío + visible:true → OCULTA. No confiada a la lectura del código.
  assert.equal(seccionEsVisible(def, { visible: true, items: [] }), false);
  // con items + visible:false → oculta por el TOGGLE (la otra razón)
  assert.equal(seccionEsVisible(def, { visible: false, items: [{ name: 'Ana' }] }), false);
  // con items + visible:true (o ausente) → se muestra
  assert.equal(seccionEsVisible(def, { visible: true, items: [{ name: 'Ana' }] }), true);
  assert.equal(seccionEsVisible(def, { items: [{ name: 'Ana' }] }), true);
});

// ── La página /nosotros: la sección de historia larga + la meta `paginas` ─────

test('nosotrosHistoria: sin nada guardado → todos los defaults; parrafo3 nace ""', () => {
  const r = resolverSiteContent({});
  assert.equal(r.nosotrosHistoria.titulo, DEFAULTS.nosotrosHistoria.titulo);
  assert.equal(r.nosotrosHistoria.parrafo1, DEFAULTS.nosotrosHistoria.parrafo1);
  assert.equal(r.nosotrosHistoria.parrafo3, '');
});

test('nosotrosHistoria: requerido vacío → default; opcional presente-vacío → ""', () => {
  const r = resolverSiteContent({ nosotrosHistoria: { titulo: '', parrafo1: '  ', parrafo2: '', parrafo3: 'Tercero' } });
  assert.equal(r.nosotrosHistoria.titulo, DEFAULTS.nosotrosHistoria.titulo);   // requerido vacío → default
  assert.equal(r.nosotrosHistoria.parrafo1, DEFAULTS.nosotrosHistoria.parrafo1); // requerido vacío → default
  assert.equal(r.nosotrosHistoria.parrafo2, '');                                 // opcional presente-vacío → ""
  assert.equal(r.nosotrosHistoria.parrafo3, 'Tercero');                          // opcional con valor → se conserva
});

// § NOSOTROS-COMPOSICION-1: `imagen` es OPCIONAL — vacía (el default) nunca cae a un fallback
// fabricado, sólo se OMITE (composición de una columna, § NosotrosHistoria.tsx).
test('nosotrosHistoria: `imagen` nace VACÍA (byte-idéntico sin ella) y se conserva si se guarda', () => {
  assert.equal(DEFAULTS.nosotrosHistoria.imagen, '');
  const r = resolverSiteContent({ nosotrosHistoria: { imagen: '/finca.jpg' } });
  assert.equal(r.nosotrosHistoria.imagen, '/finca.jpg');
});

test('REGISTRY.nosotrosHistoria.imagenes = [imagen] (tripwire del borrado de blobs, § NOSOTROS-COMPOSICION-1)', () => {
  assert.deepEqual(REGISTRY.nosotrosHistoria.imagenes, ['imagen']);
  assert.equal(REGISTRY.nosotrosHistoria.campos.imagen, 'opcional');
});

test('paginas: por default /nosotros está ENCENDIDA', () => {
  assert.equal(resolverSiteContent({}).paginas.nosotros.visible, true);
});

test('paginas: guardar visible:false la APAGA (el flag que gatea el redirect y el nav)', () => {
  const r = resolverSiteContent({ paginas: { nosotros: { visible: false } } });
  assert.equal(r.paginas.nosotros.visible, false);
});

test('paginas: por default /suscripciones está ENCENDIDA (§ Backlog #49, opción 2)', () => {
  assert.equal(resolverSiteContent({}).paginas.suscripciones.visible, true);
});

test('paginas: apagar suscripciones NO toca nosotros, y viceversa (páginas independientes)', () => {
  const r = resolverSiteContent({ paginas: { suscripciones: { visible: false } } });
  assert.equal(r.paginas.suscripciones.visible, false); // el flag que gatea la ruta + nav + footer + home CTA
  assert.equal(r.paginas.nosotros.visible, true);       // la otra capacidad, intacta (default)
});

test('paginas NO es una sección: no rompe el loop de secciones, y `nosotrosHistoria` sí resuelve', () => {
  // `paginas` va por fuera del loop de secciones (se itera `registro`, no `defaultsBase`); si entrara
  // como sección, `REGISTRY['paginas']` sería undefined y reventaría. Este test lo fija.
  const r = resolverSiteContent({});
  assert.ok(r.paginas && typeof r.paginas.nosotros.visible === 'boolean');
  assert.ok(typeof r.nosotrosHistoria.titulo === 'string');
});

test('resolverPaginas: visible sólo se pisa con booleano explícito; si no, manda el default', () => {
  const def = { nosotros: { visible: true } };
  assert.deepEqual(resolverPaginas({ nosotros: { visible: false } }, def), { nosotros: { visible: false } });
  assert.deepEqual(resolverPaginas({ nosotros: { visible: 'no-bool' } }, def), { nosotros: { visible: true } }); // basura → default
  assert.deepEqual(resolverPaginas({}, def), { nosotros: { visible: true } });                                   // ausente → default
  assert.deepEqual(resolverPaginas('basura', def), { nosotros: { visible: true } });                            // no-obj → default, no lanza
});

// ── La galería de /nosotros (2ª sección repeater: tipo imagen por ítem, encabezado OPCIONAL) ─────

test('nosotrosGaleria: sin nada guardado → defaults con items VACÍOS (no hay fotos que fabricar)', () => {
  assert.deepEqual(resolverSiteContent({}).nosotrosGaleria.items, []);
  assert.equal(resolverSiteContent({}).nosotrosGaleria.titulo, DEFAULTS.nosotrosGaleria.titulo);
});

test('nosotrosGaleria: los items guardados se RESUELVEN — url requerida, alt opcional', () => {
  const r = resolverSiteContent({ nosotrosGaleria: { items: [
    { url: '/a.jpg', alt: 'Cafetal al amanecer' }, // ambos presentes
    { url: '/b.jpg' },                              // alt ausente → ""
    { url: '', alt: 'sin foto' },                   // url requerida vacía → "" (el editor la exige; el resolver sólo da forma)
  ] } });
  assert.deepEqual(r.nosotrosGaleria.items, [
    { url: '/a.jpg', alt: 'Cafetal al amanecer' },
    { url: '/b.jpg', alt: '' },
    { url: '', alt: 'sin foto' },
  ]);
});

test('nosotrosGaleria: w/h de un ítem pasan TAL CUAL (números, no declarados como campos string → passthrough, como stars)', () => {
  const r = resolverSiteContent({ nosotrosGaleria: { items: [{ url: '/a.jpg', alt: 'x', w: 1600, h: 900 }] } });
  assert.deepEqual(r.nosotrosGaleria.items, [{ url: '/a.jpg', alt: 'x', w: 1600, h: 900 }]);
});

test('nosotrosGaleria: tipo/poster de un ítem-VÍDEO pasan TAL CUAL (passthrough, como w/h)', () => {
  const r = resolverSiteContent({ nosotrosGaleria: { items: [
    { url: '/finca.mp4', alt: 'La finca', w: 1920, h: 1080, tipo: 'video', poster: '/finca-poster.jpg' },
  ] } });
  assert.deepEqual(r.nosotrosGaleria.items, [
    { url: '/finca.mp4', alt: 'La finca', w: 1920, h: 1080, tipo: 'video', poster: '/finca-poster.jpg' },
  ]);
});

test('nosotrosGaleria: encabezado OPCIONAL — titulo vacío → "" (a diferencia de testimonios, que cae al default)', () => {
  // La diferencia deliberada: una galería puede ir SIN heading; vaciar el titulo lo omite, no lo repone.
  const r = resolverSiteContent({ nosotrosGaleria: { eyebrow: '', titulo: '' } });
  assert.equal(r.nosotrosGaleria.eyebrow, '');
  assert.equal(r.nosotrosGaleria.titulo, ''); // opcional presente-vacío → "" (no default)
});

test('nosotrosGaleria PRECEDENCIA: items vacío OCULTA aunque visible sea true (hide-on-empty gana)', () => {
  const def = REGISTRY.nosotrosGaleria;
  assert.equal(def.ocultable, true);
  assert.equal(seccionEsVisible(def, { visible: true, items: [] }), false);              // vacío → oculta
  assert.equal(seccionEsVisible(def, { visible: false, items: [{ url: '/a.jpg' }] }), false); // toggle apagado → oculta
  assert.equal(seccionEsVisible(def, { visible: true, items: [{ url: '/a.jpg' }] }), true);
});

test('REGISTRY.nosotrosGaleria.imagenes = [url, poster] y url es requerido (tripwire del borrado de blobs por ítem)', () => {
  // Si alguien renombra un campo-blob del ítem y olvida `imagenes`, `imagenesDe` dejaría de juntar esas
  // urls y el diff no borraría los blobs reemplazados. `poster` está para que el blob del póster de un
  // vídeo se borre con el ítem. Y la url debe ser requerida (sin archivo no hay ítem).
  assert.deepEqual(REGISTRY.nosotrosGaleria.imagenes, ['url', 'poster']);
  assert.equal(REGISTRY.nosotrosGaleria.repeater!.campos.url, 'requerido');
});

// ── El CTA DE CIERRE de /nosotros (§ NOSOTROS-COMPOSICION-1) — nace VACÍO, TODO opcional ─────────

test('nosotrosCierre: sin nada guardado → TODO vacío (nace sin copy fabricado; ningún tenant ve nada)', () => {
  const r = resolverSiteContent({});
  assert.equal(r.nosotrosCierre.titulo, '');
  assert.equal(r.nosotrosCierre.parrafo, '');
  assert.equal(r.nosotrosCierre.ctaLabel, '');
  assert.equal(r.nosotrosCierre.ctaDestino, '');
  assert.equal(r.nosotrosCierre.imagenFondo, '');
});

test('nosotrosCierre: TODOS los campos son opcionales — un valor guardado se conserva, ninguno cae a un default fabricado', () => {
  const r = resolverSiteContent({
    nosotrosCierre: { titulo: 'Conocé la finca', parrafo: 'Te esperamos.', ctaLabel: 'Ir a la tienda', ctaDestino: '/tienda', imagenFondo: '/finca.jpg' },
  });
  assert.equal(r.nosotrosCierre.titulo, 'Conocé la finca');
  assert.equal(r.nosotrosCierre.parrafo, 'Te esperamos.');
  assert.equal(r.nosotrosCierre.ctaLabel, 'Ir a la tienda');
  assert.equal(r.nosotrosCierre.ctaDestino, '/tienda');
  assert.equal(r.nosotrosCierre.imagenFondo, '/finca.jpg');
});

test('nosotrosCierre: `ocultable: true`, con `visible` respetando el toggle explícito (el hide-on-empty de `titulo` vive en el COMPONENTE, no acá)', () => {
  const def = REGISTRY.nosotrosCierre;
  assert.equal(def.ocultable, true);
  assert.equal(seccionEsVisible(def, { visible: true }), true);
  assert.equal(seccionEsVisible(def, { visible: false }), false);
});

test('REGISTRY.nosotrosCierre.imagenes = [imagenFondo] (tripwire del borrado de blobs, § NOSOTROS-COMPOSICION-1)', () => {
  assert.deepEqual(REGISTRY.nosotrosCierre.imagenes, ['imagenFondo']);
  assert.equal(REGISTRY.nosotrosCierre.campos.imagenFondo, 'opcional');
});

// ── La FAQ de /suscripciones (§ SUSCRIPCIONES-FAQ-DATO-1) — 3ª sección repeater, gemela de
// testimonials/nosotrosGaleria: encabezado (`titulo`, requerido) + una LISTA de preguntas ─────────

test('suscripcionFaq: sin nada guardado → defaults con items VACÍOS (ningún claim falso de código, § el repeater)', () => {
  // DERIVADO del propio resolver, no una lista escrita a mano: el punto de esta tanda es que NINGUNA
  // de las cuatro respuestas falsas de `constants/subscription-faq.ts` (retirado) sobreviva al default.
  assert.deepEqual(resolverSiteContent({}).suscripcionFaq.items, []);
  assert.equal(resolverSiteContent({}).suscripcionFaq.titulo, DEFAULTS.suscripcionFaq.titulo);
});

test('DEFAULTS.suscripcionFaq.items está VACÍO (recorrido directo del modelo, no una comparación contra las respuestas viejas)', () => {
  assert.deepEqual(DEFAULTS.suscripcionFaq.items, []);
});

test('suscripcionFaq: los items guardados se RESUELVEN — question/answer, LOS DOS requeridos', () => {
  const r = resolverSiteContent({ suscripcionFaq: { items: [
    { question: '¿Puedo cambiar de plan?', answer: 'Sí, escríbenos por WhatsApp.' },
    { question: '', answer: '' }, // los dos requeridos vacíos → "" (el editor los exige, el resolver sólo da forma)
  ] } });
  assert.deepEqual(r.suscripcionFaq.items, [
    { question: '¿Puedo cambiar de plan?', answer: 'Sí, escríbenos por WhatsApp.' },
    { question: '', answer: '' },
  ]);
});

test('suscripcionFaq: encabezado — titulo requerido vacío → default (a diferencia de nosotrosGaleria, cuyo titulo es opcional)', () => {
  const r = resolverSiteContent({ suscripcionFaq: { titulo: '' } });
  assert.equal(r.suscripcionFaq.titulo, DEFAULTS.suscripcionFaq.titulo);
});

test('suscripcionFaq PRECEDENCIA: items vacío OCULTA aunque visible sea true (hide-on-empty gana sobre el toggle)', () => {
  const def = REGISTRY.suscripcionFaq;
  assert.equal(def.ocultable, true);
  assert.equal(seccionEsVisible(def, { visible: true, items: [] }), false);
  assert.equal(seccionEsVisible(def, { visible: false, items: [{ question: 'q', answer: 'a' }] }), false); // toggle apagado → oculta
  assert.equal(seccionEsVisible(def, { visible: true, items: [{ question: 'q', answer: 'a' }] }), true);
});

// ── faqSuscripcionesVisible: compone paginas.suscripciones.visible Y seccionEsVisible(suscripcionFaq) ─
// (§ SUSCRIPCIONES-FAQ-DATO-1) — la condición ÚNICA que gatea /preguntas-frecuentes y su enlace del
// footer. Las CUATRO combinaciones, para que ninguna quede sin cubrir.

test('faqSuscripcionesVisible: capacidad ENCENDIDA + FAQ con ítems → true (se muestra)', () => {
  const r = resolverSiteContent({ suscripcionFaq: { items: [{ question: 'q', answer: 'a' }] } });
  assert.equal(faqSuscripcionesVisible(r), true);
});

test('faqSuscripcionesVisible: capacidad APAGADA (aunque la FAQ tenga ítems) → false', () => {
  const r = resolverSiteContent({
    paginas: { suscripciones: { visible: false } },
    suscripcionFaq: { items: [{ question: 'q', answer: 'a' }] },
  });
  assert.equal(faqSuscripcionesVisible(r), false);
});

test('faqSuscripcionesVisible: capacidad ENCENDIDA pero FAQ SIN ítems (el estado por defecto) → false', () => {
  const r = resolverSiteContent({}); // paginas.suscripciones.visible=true (default), suscripcionFaq.items=[] (default)
  assert.equal(faqSuscripcionesVisible(r), false);
});

test('faqSuscripcionesVisible: capacidad APAGADA y FAQ SIN ítems → false (las dos razones a la vez)', () => {
  const r = resolverSiteContent({ paginas: { suscripciones: { visible: false } } });
  assert.equal(faqSuscripcionesVisible(r), false);
});

test('faqSuscripcionesVisible: capacidad ENCENDIDA + FAQ con ítems pero su propio toggle apagado → false', () => {
  const r = resolverSiteContent({ suscripcionFaq: { visible: false, items: [{ question: 'q', answer: 'a' }] } });
  assert.equal(faqSuscripcionesVisible(r), false);
});

// ── El TEMA (paleta): clave no-sección, gemela de `paginas` ───────────────────

test('tema: sin nada guardado → las 3 raíces + el par en null (el storefront cae a los defaults de código)', () => {
  assert.deepEqual(resolverSiteContent({}).tema, { fondo: null, tinta: null, acento: null, fuentePar: null, forma: null, origenTexto: null, origenAccion: null, escalaDisplay: null });
});

test('tema NO es una sección: no rompe el loop de secciones, y el hero sí resuelve', () => {
  const r = resolverSiteContent({ tema: { fondo: '#101010' } });
  assert.equal(r.tema.fondo, '#101010');
  assert.ok(typeof r.hero.titulo === 'string'); // las secciones siguen resolviendo
});

test('tema: SeccionKey lo excluye — el REGISTRY no tiene entrada `tema` (no es sección)', () => {
  assert.equal('tema' in REGISTRY, false);
  assert.equal('paginas' in REGISTRY, false);
});

test('resolverTema: raíz hex válida se respeta; null/vacío/basura/no-hex → null', () => {
  const def = { fondo: null, tinta: null, acento: null };
  assert.deepEqual(
    resolverTema({ fondo: '#FAF7F4', tinta: '#1a0f08', acento: '#8b4513' }, def),
    { fondo: '#FAF7F4', tinta: '#1a0f08', acento: '#8b4513', fuentePar: null, forma: null, origenTexto: null, origenAccion: null, escalaDisplay: null },
  );
  // no-hex / vacío / hex de 3 dígitos / número → null (la defensa del loader SOFT: un valor corrupto
  // editado a mano NO llega al motor de derivación)
  assert.deepEqual(
    resolverTema({ fondo: 'rojo', tinta: '', acento: '#abc', extra: 42 }, def),
    { fondo: null, tinta: null, acento: null, fuentePar: null, forma: null, origenTexto: null, origenAccion: null, escalaDisplay: null },
  );
  // parcial: sólo fondo puesto, las otras dos en null (el write exige las 3-o-ninguna; el loader no lo asume)
  assert.deepEqual(resolverTema({ fondo: '#123456' }, def), { fondo: '#123456', tinta: null, acento: null, fuentePar: null, forma: null, origenTexto: null, origenAccion: null, escalaDisplay: null });
  // entrada no-objeto → todo al default, NO lanza (SOFT)
  assert.deepEqual(resolverTema('basura', def), { fondo: null, tinta: null, acento: null, fuentePar: null, forma: null, origenTexto: null, origenAccion: null, escalaDisplay: null });
  assert.deepEqual(resolverTema(null, def), { fondo: null, tinta: null, acento: null, fuentePar: null, forma: null, origenTexto: null, origenAccion: null, escalaDisplay: null });
});

test('resolverTema: un DEFAULT hex se usa cuando el guardado no trae raíz válida (defensa simétrica)', () => {
  // Hoy los defaults del tema son null, pero la mecánica del default hex es la misma que en `paginas`:
  // si el default fuera un hex, se usaría ante un guardado inválido. Fija el contrato del fallback.
  const def = { fondo: '#000000', tinta: '#ffffff', acento: '#8b4513' };
  assert.deepEqual(resolverTema({ fondo: 'basura' }, def), { fondo: '#000000', tinta: '#ffffff', acento: '#8b4513', fuentePar: null, forma: null, origenTexto: null, origenAccion: null, escalaDisplay: null });
});

test('resolverTema: origenTexto/origenAccion (§ TEMAS-ROLES-DECLARADOS-POR-EL-PRESET-1) — SOFT, sólo el valor no-default del set cerrado sobrevive', () => {
  const def = { fondo: null, tinta: null, acento: null };
  assert.equal(resolverTema({ origenTexto: 'tinta' }, def).origenTexto, 'tinta');
  assert.equal(resolverTema({ origenAccion: 'acento' }, def).origenAccion, 'acento');
  // basura, el propio default (que no existe como string a guardar), y ausente → null
  assert.equal(resolverTema({ origenTexto: 'acento' }, def).origenTexto, null);
  assert.equal(resolverTema({ origenTexto: 'inexistente' }, def).origenTexto, null);
  assert.equal(resolverTema({ origenAccion: 'tostado' }, def).origenAccion, null);
  assert.equal(resolverTema({ origenAccion: 'inexistente' }, def).origenAccion, null);
  assert.equal(resolverTema({}, def).origenTexto, null);
  assert.equal(resolverTema({}, def).origenAccion, null);
  // entrada no-objeto → NO lanza (SOFT)
  assert.equal(resolverTema('basura', def).origenTexto, null);
  assert.equal(resolverTema('basura', def).origenAccion, null);
});

test('resolverTema: escalaDisplay (§ TEMAS-ESCALA-DISPLAY-1) — SOFT, sólo el único miembro del set cerrado sobrevive', () => {
  const def = { fondo: null, tinta: null, acento: null };
  assert.equal(resolverTema({ escalaDisplay: 'amplia' }, def).escalaDisplay, 'amplia');
  // basura, y ausente → null
  assert.equal(resolverTema({ escalaDisplay: 'enorme' }, def).escalaDisplay, null);
  assert.equal(resolverTema({}, def).escalaDisplay, null);
  // entrada no-objeto → NO lanza (SOFT)
  assert.equal(resolverTema('basura', def).escalaDisplay, null);
});

test('resolverTema: fuentePar CUSTOM válido se respeta; editorial/null/basura → null (§ fuentes)', () => {
  const def = { fondo: null, tinta: null, acento: null };
  assert.equal(resolverTema({ fuentePar: 'calido' }, def).fuentePar, 'calido');
  assert.equal(resolverTema({ fuentePar: 'moderno' }, def).fuentePar, 'moderno');
  assert.equal(resolverTema({ fuentePar: 'editorial' }, def).fuentePar, null); // Editorial = el default, no se guarda
  assert.equal(resolverTema({ fuentePar: 'inexistente' }, def).fuentePar, null);
  assert.equal(resolverTema({ fondo: '#101010' }, def).fuentePar, null);       // sin par → null, sin arrastrar
});

// ── Los ESQUEMAS (§ eje 5b, mitad B): mapa banda→esquema, gemelo KEY-AGNÓSTICO de `paginas`/`tema` ──

test('esquemas: sin nada guardado → mapa VACÍO (ninguna banda tiene override, § el mecanismo de byte-identidad)', () => {
  assert.deepEqual(resolverSiteContent({}).esquemas, {});
});

test('esquemas NO es una sección: no rompe el loop de secciones, y el hero sí resuelve', () => {
  const r = resolverSiteContent({ esquemas: { hero: 'oscuro' } });
  assert.equal(r.esquemas.hero, 'oscuro');
  assert.ok(typeof r.hero.titulo === 'string'); // las secciones siguen resolviendo
});

test('esquemas: SeccionKey lo excluye — el REGISTRY no tiene entrada `esquemas` (no es sección)', () => {
  assert.equal('esquemas' in REGISTRY, false);
});

test('resolverEsquemas: los 4 esquemas válidos se respetan, por banda', () => {
  assert.deepEqual(
    resolverEsquemas({ hero: 'crema', trustBadges: 'superficie', subscriptionCTA: 'oscuro', featured: 'acento' }),
    { hero: 'crema', trustBadges: 'superficie', subscriptionCTA: 'oscuro', featured: 'acento' },
  );
});

test('resolverEsquemas: basura por banda (string inválido, no-string, ausente) NI SIQUIERA aparece en el resultado — es "sin override", no un default forzado', () => {
  assert.deepEqual(resolverEsquemas({ hero: 'neon', trustBadges: 42, brandStory: null }), {});
  assert.deepEqual(resolverEsquemas({}), {});
});

test('resolverEsquemas: entrada no-objeto → mapa vacío, NO lanza (SOFT)', () => {
  for (const basura of [null, undefined, 'x', 42, []]) {
    assert.deepEqual(resolverEsquemas(basura), {});
  }
});

test('resolverEsquemas: es KEY-AGNÓSTICO — acepta cualquier bandaId, no un set fijo conocido de antemano', () => {
  assert.deepEqual(resolverEsquemas({ unaBandaQueNoExisteHoy: 'acento' }), { unaBandaQueNoExisteHoy: 'acento' });
});

// ── Las VARIANTES DE BANDAS ESTRUCTURALES (TEMAS-P1-FEATURED-VARIANTES-1): mapa bandaId→variante,
// gemelo KEY-AGNÓSTICO de `esquemas`, para bandas sin sección (`featured`) ─────────────────────────

test('variantesBandas: sin nada guardado → mapa VACÍO (byte-idéntico: sin fila, featured cae a su canónica)', () => {
  assert.deepEqual(resolverSiteContent({}).variantesBandas, {});
});

test('variantesBandas NO es una sección: no rompe el loop de secciones, y el hero sí resuelve', () => {
  const r = resolverSiteContent({ variantesBandas: { featured: 'cuadricula' } });
  assert.equal(r.variantesBandas.featured, 'cuadricula');
  assert.ok(typeof r.hero.titulo === 'string'); // las secciones siguen resolviendo
});

// ── El DESPACHADOR de `featured` (`FeaturedProducts.tsx`, TEMAS-FEATURED-GRILLA-1) lee
// `variantesBandas.featured` con `?? FeaturedProductsCuadricula` como red — estos tres casos son los
// que ese `??` tiene que cubrir, afirmados acá (la ÚNICA capa testeable sin jsdom, § CLAUDE.md "el
// glob NO incluye *.test.tsx"): sin override → AUSENTE del mapa → el dispatcher cae a la canónica;
// con la clave nueva → PRESENTE → el dispatcher elige `FeaturedProductsGrilla`; con basura → tampoco
// sobrevive → cae a la canónica, sin lanzar.
test('el despachador de featured: sin variante guardada, la clave está AUSENTE → cae a la canónica (cuadricula)', () => {
  const r = resolverSiteContent({});
  assert.equal(r.variantesBandas.featured, undefined);
});

test('el despachador de featured: con "grilla" guardado, la clave está PRESENTE → el dispatcher elige FeaturedProductsGrilla', () => {
  const r = resolverSiteContent({ variantesBandas: { featured: 'grilla' } });
  assert.equal(r.variantesBandas.featured, 'grilla');
});

test('el despachador de featured: una clave basura no sobrevive → AUSENTE → cae a la canónica sin lanzar', () => {
  const r = resolverSiteContent({ variantesBandas: { featured: 'una-clave-basura' } });
  assert.equal(r.variantesBandas.featured, undefined);
});

test('variantesBandas: SeccionKey lo excluye — el REGISTRY no tiene entrada `variantesBandas` (no es sección)', () => {
  assert.equal('variantesBandas' in REGISTRY, false);
});

test('VARIANTES_ESTRUCTURALES: declara `featured` con su canónica `cuadricula` y las variantes `grilla`/`spotlight` (TEMAS-FEATURED-GRILLA-1, SPOTLIGHT-CABLEADO-HOME-1), y NO declara `trustBadges` (capacidad muerta evitada)', () => {
  assert.deepEqual(VARIANTES_ESTRUCTURALES.featured, { claves: ['cuadricula', 'grilla', 'spotlight'], canonica: 'cuadricula' });
  assert.equal(VARIANTES_ESTRUCTURALES.trustBadges, undefined);
});

test('resolverVariantesBandas: una clave válida por banda se respeta', () => {
  assert.deepEqual(resolverVariantesBandas({ featured: 'cuadricula' }), { featured: 'cuadricula' });
});

test('resolverVariantesBandas: "grilla" (TEMAS-FEATURED-GRILLA-1) también se respeta — no es sólo la canónica la que sobrevive', () => {
  assert.deepEqual(resolverVariantesBandas({ featured: 'grilla' }), { featured: 'grilla' });
});

test('resolverVariantesBandas: basura por banda (clave fuera del set, no-string, ausente) NI SIQUIERA aparece en el resultado — es "sin override", no un clamp a la canónica', () => {
  assert.deepEqual(resolverVariantesBandas({ featured: 'tabla' }), {}); // clave que ningún preset del catálogo tiene construida
  assert.deepEqual(resolverVariantesBandas({ featured: 42 }), {});
  assert.deepEqual(resolverVariantesBandas({ featured: null }), {});
  assert.deepEqual(resolverVariantesBandas({}), {});
});

test('resolverVariantesBandas: entrada no-objeto → mapa vacío, NO lanza (SOFT)', () => {
  for (const basura of [null, undefined, 'x', 42, []]) {
    assert.deepEqual(resolverVariantesBandas(basura), {});
  }
});

test('resolverVariantesBandas: una banda SIN entrada en VARIANTES_ESTRUCTURALES se descarta (a diferencia de `esquemas`, el set de claves es POR-BANDA, no uno global)', () => {
  // `trustBadges` no tiene entrada en VARIANTES_ESTRUCTURALES (§ decisión del owner, capacidad
  // muerta evitada) — cualquier valor que llegue para esa banda se descarta, aunque sea un string.
  assert.deepEqual(resolverVariantesBandas({ trustBadges: 'cualquiera' }), {});
  assert.deepEqual(resolverVariantesBandas({ unaBandaQueNoExisteHoy: 'x' }), {});
});

// ─── Presentaciones: el default resuelto reproduce el copy CANÓNICO declarado en DEFAULTS ───
// CONTENIDO-NEUTRALIZAR-1 (2026-09-12) reemplazó los literales de café/Nayoli que vivían acá por
// copy GENÉRICO de comercio — el objeto de abajo se actualizó junto con `DEFAULTS.presentaciones`.
// MARCA-CLIENTE-PRESENTACIONES-1 (2026-09-12) hizo lo mismo con `imagen1`/`imagen2`: eran la foto
// REAL de la bolsa de Café Nayoli, compilada como default de todo despliegue nuevo (§ CLAUDE.md,
// La FRONTERA fina...) — pasan a '' (§ el render las tolera vacías, GrindChooserMosaico/Indice:71/86).
// La PROPIEDAD que este test afirma no cambió: sin fila guardada, el resolver reproduce EXACTAMENTE
// los defaults declarados (comparación MECÁNICA, deep-equal, no aseveración) — si alguien toca un
// default y desincroniza esta copia, el test cae. (Un repeater NO podría verificarse así —su
// default jamás se muestra—; campos planos sí, que es la razón del modelado, § doctrina.)
const PRESENTACIONES_ANTES = {
  visible: true,
  eyebrow: 'Elige tu presentación',
  titulo: '¿Cómo lo prefieres?',
  label1: 'Presentación Clásica',
  copy1: 'La opción original, lista para usar.',
  imagen1: '',
  categoria1: 'Clásico',
  label2: 'Presentación Especial',
  copy2: 'Pensada para quien busca algo distinto.',
  imagen2: '',
  categoria2: 'Especial',
  // Slots 3-4 opcionales, VACÍOS por defecto → la home renderiza 2 (byte-idéntico al copy canónico).
  label3: '', copy3: '', imagen3: '', categoria3: '',
  label4: '', copy4: '', imagen4: '', categoria4: '',
  // El CTA de cabecera (§ MUESTRARIO-SECCION-CTA-1) nace VACÍO → sin botón, byte-idéntico.
  ctaLabel: '',
  ctaDestino: '',
  // La canónica de composición (§ eje 5e): 'mosaico' es el GrindChooser de hoy, verbatim.
  variante: 'mosaico',
};

test('presentaciones: sin fila, los defaults resueltos reproducen el copy canónico declarado', () => {
  const r = resolverSiteContent({});
  assert.deepEqual(r.presentaciones, PRESENTACIONES_ANTES);
});

test('presentaciones: sin fila, el DESTINO editable resuelve a los links del copy canónico', () => {
  // El destino de cada tarjeta dejó de ser ESTRUCTURA (PRESENTACIONES_HREFS retirado) y es DATO
  // (`categoria1/2`). Sin fila, los defaults resueltos + `hrefCategoria` deben dar EXACTAMENTE los
  // links que el copy canónico declara.
  const r = resolverSiteContent({});
  assert.equal(hrefCategoria(r.presentaciones.categoria1), `/tienda?cat=${encodeURIComponent('Clásico')}`);
  assert.equal(hrefCategoria(r.presentaciones.categoria2), `/tienda?cat=${encodeURIComponent('Especial')}`);
});

test('presentaciones: una categoría (destino) requerida vacía cae al default (la tarjeta lleva a algún lado)', () => {
  const r = resolverSiteContent({ presentaciones: { categoria1: '' } });
  assert.equal(r.presentaciones.categoria1, PRESENTACIONES_ANTES.categoria1); // requerido vacío → default
});

test('presentaciones: es OCULTABLE (una tienda no-café la apaga) y NO es repeater (cardinalidad fija)', () => {
  assert.equal(REGISTRY.presentaciones.ocultable, true);
  assert.equal(REGISTRY.presentaciones.repeater, undefined); // campos planos, no lista
  // visible=false oculta; sin toggle explícito, se muestra (default visible:true).
  assert.equal(seccionEsVisible(REGISTRY.presentaciones, { ...PRESENTACIONES_ANTES, visible: false }), false);
  assert.equal(seccionEsVisible(REGISTRY.presentaciones, PRESENTACIONES_ANTES), true);
});

test('presentaciones: un label requerido vacío cae al default (tarjeta nunca a medias)', () => {
  const r = resolverSiteContent({ presentaciones: { label1: '', copy2: '   ' } });
  assert.equal(r.presentaciones.label1, PRESENTACIONES_ANTES.label1); // requerido vacío → default
  assert.equal(r.presentaciones.copy2, PRESENTACIONES_ANTES.copy2);
});

// ── VARIANTES DE COMPOSICIÓN (§ eje 5e): el MECANISMO, hermano de `repeater` ─────────────────────

const VARIANTES_TEST: VariantesDef = { claves: ['mosaico', 'indice'], canonica: 'mosaico' };

test('resolverVariante: ausente, vacío, null, basura u objeto → la canónica', () => {
  assert.equal(resolverVariante(VARIANTES_TEST, undefined), 'mosaico');
  assert.equal(resolverVariante(VARIANTES_TEST, ''), 'mosaico');
  assert.equal(resolverVariante(VARIANTES_TEST, null), 'mosaico');
  assert.equal(resolverVariante(VARIANTES_TEST, 'foo'), 'mosaico'); // fuera del set → canónica
  assert.equal(resolverVariante(VARIANTES_TEST, { indice: true }), 'mosaico');
});

test('resolverVariante: una clave DEL SET se respeta', () => {
  assert.equal(resolverVariante(VARIANTES_TEST, 'indice'), 'indice');
  assert.equal(resolverVariante(VARIANTES_TEST, 'mosaico'), 'mosaico');
});

test('presentaciones: sin fila, `variante` resuelve a la canónica "mosaico" (byte-idéntico)', () => {
  const r = resolverSiteContent({});
  assert.equal(r.presentaciones.variante, 'mosaico');
});

test('presentaciones: una `variante` guardada válida se respeta', () => {
  const r = resolverSiteContent({ presentaciones: { variante: 'indice' } });
  assert.equal(r.presentaciones.variante, 'indice');
});

// CORTE-PRESENTACIONES-RIEL-1: 'riel' (tarjetas en un riel horizontal con controles, § GrindChooserRiel)
// es la TERCERA clave del set — la misma mecánica, un valor más.
test('presentaciones: la `variante` "riel" (CORTE-PRESENTACIONES-RIEL-1) se respeta', () => {
  const r = resolverSiteContent({ presentaciones: { variante: 'riel' } });
  assert.equal(r.presentaciones.variante, 'riel');
});

test('presentaciones: una `variante` guardada fuera del set cae a la canónica', () => {
  const r = resolverSiteContent({ presentaciones: { variante: 'no-existe' } });
  assert.equal(r.presentaciones.variante, 'mosaico');
});

test('REGISTRY.presentaciones declara `variantes` con el set cerrado (incluido "riel") y la canónica', () => {
  assert.deepEqual(REGISTRY.presentaciones.variantes, { claves: ['mosaico', 'indice', 'riel'], canonica: 'mosaico' });
});

// ── GrindChooserRiel (§ CORTE-PRESENTACIONES-RIEL-1): render REAL, vía el DISPATCHER ────────────
//
// `renderToStaticMarkup` sobre el ÁRBOL REAL (dispatcher `GrindChooser` incluido, no la pieza
// aislada) — mismo patrón que `lib/storefront/planes-suscripcion-componente.test.ts`: SSR a texto,
// sin jsdom (§ CLAUDE.md, "El glob NO incluye *.test.tsx — los tests de COMPONENTE necesitan jsdom,
// que el repo no tiene"). Viven ACÁ (`lib/config/`, no un `.test.ts` bajo `components/storefront/
// home/`) por el mismo carril del gate: un archivo nuevo bajo `components/` cae fuera de los
// patrones que `lib/gate/tests-descubiertos.test.ts` reproduce como "los que quedaron invisibles
// anoche" (`patronesDeAnoche`, que nunca incluyó `components/**`), y ese test compara ese conjunto
// contra el árbol REAL del repo — cualquier archivo nuevo bajo `components/` se sumaría a esa lista
// congelada y la rompería, aunque el archivo SÍ esté cubierto por el glob VIGENTE de "npm test".
// `lib/config/**/*.test.ts` estaba en los patrones de esa noche Y sigue estándolo hoy, así que un
// archivo nuevo acá no mueve esa foto histórica. `lib/gate/tests-descubiertos.test.ts` no está en
// `touches` de este slice — no se toca.
function renderGrindChooser(pres: PresentacionesContent, opts: { preview?: boolean } = {}): string {
  const content = { ...DEFAULTS, presentaciones: pres };
  // `CartProvider` ENVUELVE SIEMPRE (§ RIEL-COLATERAL-TESTS-1): desde RIEL-PRODUCTOS-Y-VISTA-
  // RAPIDA-1, `GrindChooserRiel` gana `useCartStore()` incondicional (el carrito rápido de sus dos
  // acciones), y ese hook es un CONTEXT con throw duro sin su provider. Envolver siempre es inocuo
  // para mosaico/índice (ninguno de los dos lee `useCartStore`) — mismo patrón que
  // `escala-display.test.ts`.
  const arbol = React.createElement(CartProvider, {
    children: React.createElement(SiteContentProvider, {
      value: content,
      children: React.createElement(GrindChooser),
    }),
  });
  return renderToStaticMarkup(opts.preview ? React.createElement(PreviewProvider, { children: arbol }) : arbol);
}

test('el DISPATCHER enruta "riel" a GrindChooserRiel', () => {
  const html = renderGrindChooser({ ...DEFAULTS.presentaciones, variante: 'riel' });
  assert.ok(html.includes('grind-riel-track'), 'la clase del track del riel debe aparecer en el HTML');
});

test('el DISPATCHER sigue enrutando "mosaico" y "indice" a sus componentes — sin regresión al sumar "riel"', () => {
  const htmlMosaico = renderGrindChooser({ ...DEFAULTS.presentaciones, variante: 'mosaico' });
  assert.ok(htmlMosaico.includes('aspect-[4/5]'), 'fingerprint del mosaico (la tile con overlay)');
  assert.ok(!htmlMosaico.includes('grind-riel-track'));

  const htmlIndice = renderGrindChooser({ ...DEFAULTS.presentaciones, variante: 'indice' });
  assert.ok(htmlIndice.includes('divide-y'), 'fingerprint del índice (la lista con divisores)');
  assert.ok(!htmlIndice.includes('grind-riel-track'));
});

// ── RIEL-COLATERAL-TESTS-1 (2026-09-30) — CUATRO ASERCIONES RETIRADAS, no actualizadas ─────────────
//
// RIEL-PRODUCTOS-Y-VISTA-RAPIDA-1 movió la fuente de las tarjetas del riel de las tarjetas
// CONFIGURADAS (`label1..4`/`copy1..4`/`imagen1..4`, resueltas por `tarjetasDePresentaciones`) al
// CATÁLOGO (`productosDelRiel`, § lib/storefront/presentaciones.ts) — mosaico/índice SIGUEN siendo
// config-driven (nada de esto los toca). Las cuatro pruebas que vivían acá describían un
// comportamiento que ya NO EXISTE para "riel", no uno que cambió de forma:
//   - "cardinalidad MÍNIMA/MÁXIMA (2/4 tarjetas, los defaults/slots 3-4 llenos)" asumía que
//     `label1..4` gobierna cuántas tarjetas aparecen. Bajo el catálogo, la cardinalidad la decide
//     `productosDelRiel` sobre lo que trae `getCatalog()` — y este arnés (`renderToStaticMarkup`,
//     sin jsdom) nunca ejecuta ese `fetch` (vive en un `useEffect`), así que el catálogo queda
//     SIEMPRE `[]` sin importar qué `pres` se le pase: la aserción "2 tarjetas"/"4 tarjetas" no se
//     puede volver a escribir en ESTE archivo sin mentir. La cardinalidad de `productosDelRiel` (con
//     catálogo real, sin el límite de SSR) ya está afirmada en `lib/storefront/presentaciones.test.ts`
//     ("catálogo vacío → []", "recorta al TOPE (8)", "menos que el tope, los devuelve TODOS"); que el
//     riel no rompe con catálogo vacío en SSR está afirmado en `lib/config/presentaciones-riel.test.ts`
//     ("bajo Nayoli (sin catálogo, SSR) GrindChooserRiel no revienta — cero tarjetas, no un crash").
//   - "el marcador `data-sf-tarjeta`… sólo en preview" afirmaba el puente vista→formulario del panel.
//     `TarjetaRiel` (la pieza que ahora pinta cada tarjeta) YA NO EMITE ese atributo — no hay slot que
//     resaltar sobre un producto del catálogo — así que la aserción "aparece en preview" describiría
//     algo falso. § lib/tienda/puente-tarjetas.ts documenta por qué el puente no aplica a esta
//     variante.
//   - "una tarjeta SIN imagen… no rompe" verificaba el fallback de `imagen1`/`imagen2` vacíos, un
//     concepto que no existe bajo el catálogo (cada tarjeta es un `Product`, con su propia
//     `imagenPortada`). El fallback de imagen equivalente —`TarjetaRiel` sin ninguna foto cae al
//     placeholder de marca, nunca un `<img src="">` roto— está afirmado con un producto de fixture en
//     `lib/config/presentaciones-riel.test.ts` ("TarjetaRiel: sin foto en absoluto, cae al placeholder
//     de marca").
// Los defaults `label1..4`/`imagen1..4` SIGUEN existiendo (mosaico/índice los consumen) y sus propios
// tests arriba en este archivo (cardinalidad fija, OR título/imagen, grid por conteo) NO se tocaron.

test('presentaciones NO visible → el riel no renderiza nada (el gate de visibilidad vive en el DISPATCHER)', () => {
  const html = renderGrindChooser({ ...DEFAULTS.presentaciones, variante: 'riel', visible: false });
  assert.equal(html, '');
});

test('una sección SIN `variantes` declarado no gana `variante` en el resuelto (testimonials, p. ej. — hero/brandStory/presentaciones/subscriptionCTA SÍ, § EJE-5-VARIANTES-HERO, TEMAS-P2-BRANDSTORY-1 y TEMAS-SUBSCRIPTIONCTA-LINEA-1)', () => {
  const r = resolverSiteContent({});
  // Sin cast: lo que se afirma es que la CLAVE no se ganó, no que valga `undefined` (una clave
  // presente con valor `undefined` pasaría el `assert.equal` de antes sin que la sección
  // realmente careciera de `variante`). `subscriptionCTA` ya NO sirve de ejemplo — ganó su slot en
  // TEMAS-SUBSCRIPTIONCTA-LINEA-1; `testimonials` sigue sin `variantes` declarado.
  assert.equal('variante' in r.testimonials, false);
});

test('brandStory: sin fila, `variante` resuelve a la canónica "columnas" (byte-idéntico) — el slot que TEMAS-P2-BRANDSTORY-1 abre', () => {
  const r = resolverSiteContent({});
  assert.equal(r.brandStory.variante, 'columnas');
});

test('brandStory: una `variante` guardada fuera del set cae a la canónica', () => {
  const r = resolverSiteContent({ brandStory: { variante: 'no-existe' } });
  assert.equal(r.brandStory.variante, 'columnas');
});

test('REGISTRY.brandStory declara `variantes` con DOS claves (columnas/centrada), la canónica "columnas", y SIN `noUniformes` (§ CORTE-BRANDSTORY-COLLAGE-1)', () => {
  assert.deepEqual(REGISTRY.brandStory.variantes, { claves: ['columnas', 'centrada'], canonica: 'columnas' });
});

test('resolverVariante con las claves de brandStory: ausente/vacío/null/basura → "columnas"; "centrada" se respeta (§ CORTE-BRANDSTORY-COLLAGE-1)', () => {
  assert.equal(resolverVariante(REGISTRY.brandStory.variantes!, undefined), 'columnas');
  assert.equal(resolverVariante(REGISTRY.brandStory.variantes!, ''), 'columnas');
  assert.equal(resolverVariante(REGISTRY.brandStory.variantes!, null), 'columnas');
  assert.equal(resolverVariante(REGISTRY.brandStory.variantes!, 'foo'), 'columnas');
  assert.equal(resolverVariante(REGISTRY.brandStory.variantes!, 'columnas'), 'columnas');
  assert.equal(resolverVariante(REGISTRY.brandStory.variantes!, 'centrada'), 'centrada');
});

test('brandStory: una `variante` guardada "centrada" se respeta, y resuelve igual que "columnas" (§ CORTE-BRANDSTORY-COLLAGE-1)', () => {
  const r = resolverSiteContent({ brandStory: { variante: 'centrada' } });
  assert.equal(r.brandStory.variante, 'centrada');
});

// ── EL HERO GANA VARIANTES (§ EJE-5-VARIANTES-HERO): segunda sección con `variantes`, gemela de
// Presentaciones (§ eje 5e) ──────────────────────────────────────────────────────────────────────

test('REGISTRY.hero declara `variantes` con el set cerrado (curtina/ficha/media/sticky), la canónica y `noUniformes: [\'ficha\']` (§ EJE-5-NAV-UNIFORME, TEMAS-HERO-MEDIA-1, MUESTRARIO-HERO-MARQUESINA-STICKY-1)', () => {
  assert.deepEqual(
    REGISTRY.hero.variantes,
    { claves: ['curtina', 'ficha', 'media', 'sticky'], canonica: 'curtina', noUniformes: ['ficha'] },
  );
});

test('hero: sin fila, `variante` resuelve a la canónica "curtina" (byte-idéntico)', () => {
  const r = resolverSiteContent({});
  assert.equal(r.hero.variante, 'curtina');
});

test('DEFAULTS.hero.variante es "curtina" (byte-idéntico al hero de hoy)', () => {
  assert.equal(DEFAULTS.hero.variante, 'curtina');
});

test('hero: una `variante` guardada válida se respeta', () => {
  const r = resolverSiteContent({ hero: { variante: 'ficha' } });
  assert.equal(r.hero.variante, 'ficha');
});

test('hero: una `variante` guardada fuera del set cae a la canónica', () => {
  const r = resolverSiteContent({ hero: { variante: 'no-existe' } });
  assert.equal(r.hero.variante, 'curtina');
});

test('resolverVariante con las claves del hero: ausente/vacío/null/basura → "curtina"; "ficha", "media" y "sticky" se respetan', () => {
  assert.equal(resolverVariante(REGISTRY.hero.variantes!, undefined), 'curtina');
  assert.equal(resolverVariante(REGISTRY.hero.variantes!, ''), 'curtina');
  assert.equal(resolverVariante(REGISTRY.hero.variantes!, null), 'curtina');
  assert.equal(resolverVariante(REGISTRY.hero.variantes!, 'foo'), 'curtina');
  assert.equal(resolverVariante(REGISTRY.hero.variantes!, 'ficha'), 'ficha');
  assert.equal(resolverVariante(REGISTRY.hero.variantes!, 'curtina'), 'curtina');
  assert.equal(resolverVariante(REGISTRY.hero.variantes!, 'media'), 'media');
  assert.equal(resolverVariante(REGISTRY.hero.variantes!, 'sticky'), 'sticky');
});

test('hero: una `variante` guardada "media" se respeta, y resuelve igual que las otras (§ TEMAS-HERO-MEDIA-1)', () => {
  const r = resolverSiteContent({ hero: { variante: 'media' } });
  assert.equal(r.hero.variante, 'media');
});

test('hero: una `variante` guardada "sticky" se respeta (§ MUESTRARIO-HERO-MARQUESINA-STICKY-1)', () => {
  const r = resolverSiteContent({ hero: { variante: 'sticky' } });
  assert.equal(r.hero.variante, 'sticky');
});

// ── EL HERO GANA VIDEO COMO DATO (§ HERO-VIDEO-COMO-DATO-1): `imagenTipo`/`imagenPoster`, el
// SEGUNDO escalar clampado de una sección (gemelo de `variante`, vía `REGISTRY.hero.escalares`) ───

test('REGISTRY.hero declara `escalares.imagenTipo` con el set cerrado y la canónica "imagen"', () => {
  // § HERO-PUNTO-FOCAL-1: `escalares` ganó un TERCER miembro (`puntoFocal`); § CORTE-HERO-REVELADO-
  // MASCARA-1 sumó el CUARTO y el QUINTO (`veloIntensidad`/`tickerVelocidad`); § EDITOR-TIENDA-
  // ZONAS-1 suma el SEXTO (`alto`) — este deepEqual afirma el objeto COMPLETO, así que tiene que
  // nombrar los seis, o fallaría con un miembro "de más" apenas se agregue el próximo escalar
  // clampado de esta sección. Su propia cobertura (canónica, set cerrado, clamp de basura) vive en
  // `hero-punto-focal.test.ts`/`lib/animation.test.ts`/`corte-hero-viewport.test.ts`.
  assert.deepEqual(REGISTRY.hero.escalares, {
    imagenTipo: { claves: ['imagen', 'video'], canonica: 'imagen' },
    puntoFocal: { claves: PUNTOS_FOCALES, canonica: 'centro' },
    veloIntensidad: { claves: VELO_INTENSIDADES, canonica: 'media' },
    tickerVelocidad: { claves: TICKER_VELOCIDADES, canonica: 'media' },
    alto: { claves: ALTURAS_HERO, canonica: 'justo' },
  });
});

// ── EL ALTO DE TRES PASOS (§ EDITOR-TIENDA-ZONAS-1, `claseAlturaHero`) ──────────────────────────

test('DEFAULTS.hero.alto nace en "justo" — byte-idéntico', () => {
  assert.equal(DEFAULTS.hero.alto, 'justo');
});

test('claseAlturaHero: "alto"/"pantalla" explícitos mandan, SIN mirar alturaLlena', () => {
  assert.equal(claseAlturaHero('alto', false), CLASES_ALTURA_HERO.alto);
  assert.equal(claseAlturaHero('alto', true), CLASES_ALTURA_HERO.alto);
  assert.equal(claseAlturaHero('pantalla', false), CLASES_ALTURA_HERO.pantalla);
  assert.equal(claseAlturaHero('pantalla', true), CLASES_ALTURA_HERO.pantalla);
});

test('claseAlturaHero: en la canónica ("justo", ausente o basura) cae a `alturaLlena` — SIN MIGRACIÓN', () => {
  assert.equal(claseAlturaHero('justo', false), 'min-h-[92vh]');
  assert.equal(claseAlturaHero('justo', true), 'min-h-[100svh]');
  assert.equal(claseAlturaHero('', true), 'min-h-[100svh]');
  assert.equal(claseAlturaHero('basura', false), 'min-h-[92vh]');
});

test('CLASES_ALTURA_HERO: las dos puntas son LITERALES las clases de HOY', () => {
  assert.equal(CLASES_ALTURA_HERO.justo, 'min-h-[92vh]');
  assert.equal(CLASES_ALTURA_HERO.pantalla, 'min-h-[100svh]');
  assert.equal(CLASES_ALTURA_HERO.alto, 'min-h-[96svh]');
});

// ── EL VELO, COMO UNA SOLA PREGUNTA (§ EDITOR-TIENDA-ZONAS-1, `veloComboDeCampos`/`camposDeVeloCombo`) ──

test('veloComboDeCampos: velo apagado es SIEMPRE "nada", cualquiera sea la intensidad guardada', () => {
  assert.equal(veloComboDeCampos(false, 'suave'), 'nada');
  assert.equal(veloComboDeCampos(false, 'media'), 'nada');
});

test('veloComboDeCampos: velo encendido sigue el orden claro→oscuro de VELO_INTENSIDADES', () => {
  assert.equal(veloComboDeCampos(true, 'suave'), 'suave');
  assert.equal(veloComboDeCampos(true, 'intermedia'), 'medio');
  assert.equal(veloComboDeCampos(true, 'media'), 'fuerte');
});

test('camposDeVeloCombo: la dirección INVERSA, round-trip con veloComboDeCampos para los cuatro pasos', () => {
  for (const combo of OPCIONES_VELO_COMBO) {
    const { veloVisible, veloIntensidad } = camposDeVeloCombo(combo);
    assert.equal(veloComboDeCampos(veloVisible, veloIntensidad), combo);
  }
});

test('camposDeVeloCombo: "nada" no deja basura en veloIntensidad — cae a la canónica', () => {
  assert.deepEqual(camposDeVeloCombo('nada'), { veloVisible: false, veloIntensidad: 'media' });
});

test('camposDeVeloCombo: basura cae a "fuerte" (la canónica, con el velo encendido) — preferir la canónica a adivinar', () => {
  assert.deepEqual(camposDeVeloCombo('inventado'), { veloVisible: true, veloIntensidad: 'media' });
});

test('hero: sin fila, `imagenTipo` resuelve a la canónica "imagen" e `imagenPoster` a "" (byte-idéntico)', () => {
  const r = resolverSiteContent({});
  assert.equal(r.hero.imagenTipo, 'imagen');
  assert.equal(r.hero.imagenPoster, '');
});

test('EL CASO REAL DE HOY: una fila de SiteContent que EXISTE y NO tiene `imagenTipo` en su JSON (todas las filas anteriores a este slice) cae a "imagen" — Nayoli no cambia', () => {
  // A diferencia del test de arriba (SIN fila), acá SÍ hay fila —con otros campos del hero ya
  // editados—, y es exactamente lo que hoy tiene cualquier `SiteContent` sembrado antes de este
  // slice: la clave `imagenTipo` sencillamente no existe en el JSON guardado.
  const r = resolverSiteContent({ hero: { titulo: 'Un titular ya editado', imagen: '/mi-foto.jpg' } });
  assert.equal(r.hero.imagenTipo, 'imagen');
  assert.equal(r.hero.imagenPoster, '');
  assert.equal(r.hero.imagen, '/mi-foto.jpg'); // el resto de la fila no se toca
});

test('DEFAULTS.hero.imagenTipo es "imagen" e imagenPoster es "" (byte-idéntico al hero de hoy)', () => {
  assert.equal(DEFAULTS.hero.imagenTipo, 'imagen');
  assert.equal(DEFAULTS.hero.imagenPoster, '');
});

test('hero: `imagenTipo: "video"` guardado se respeta, y `imagen`/`imagenPoster` se conservan', () => {
  const r = resolverSiteContent({ hero: { imagenTipo: 'video', imagen: '/v.mp4', imagenPoster: '/p.jpg' } });
  assert.equal(r.hero.imagenTipo, 'video');
  assert.equal(r.hero.imagen, '/v.mp4');
  assert.equal(r.hero.imagenPoster, '/p.jpg');
});

test('hero: `imagenTipo` fuera del set cerrado (basura) cae a la canónica "imagen" — nunca lanza (ocultable:false, la ÚNICA portada)', () => {
  for (const basura of ['audio', '', null, undefined, 42, {}, ['video']]) {
    assert.equal(resolverSiteContent({ hero: { imagenTipo: basura } }).hero.imagenTipo, 'imagen');
  }
});

test('resolverVariante con las claves de `imagenTipo` del hero: ausente/vacío/null/basura → "imagen"; "video" se respeta', () => {
  assert.equal(resolverVariante(REGISTRY.hero.escalares!.imagenTipo, undefined), 'imagen');
  assert.equal(resolverVariante(REGISTRY.hero.escalares!.imagenTipo, ''), 'imagen');
  assert.equal(resolverVariante(REGISTRY.hero.escalares!.imagenTipo, null), 'imagen');
  assert.equal(resolverVariante(REGISTRY.hero.escalares!.imagenTipo, 'foo'), 'imagen');
  assert.equal(resolverVariante(REGISTRY.hero.escalares!.imagenTipo, 'video'), 'video');
  assert.equal(resolverVariante(REGISTRY.hero.escalares!.imagenTipo, 'imagen'), 'imagen');
});

test('hero: `imagenPoster` es OPCIONAL — presente-y-vacío queda "" (el render degrada con gracia, § HeroCurtina/HeroFicha)', () => {
  const r = resolverSiteContent({ hero: { imagenTipo: 'video', imagenPoster: '' } });
  assert.equal(r.hero.imagenPoster, '');
});

test('una sección SIN `escalares` declarado no gana campos extra en el resuelto (brandStory, p. ej. — sólo el hero tiene `imagenTipo`)', () => {
  const r = resolverSiteContent({});
  assert.equal('imagenTipo' in r.brandStory, false);
});

// ── EL CUARTO Y QUINTO ESCALAR (§ CORTE-HERO-REVELADO-MASCARA-1): `veloIntensidad`/`tickerVelocidad`,
// MISMO mecanismo que `imagenTipo`/`puntoFocal` de arriba — el vocabulario de contenido; la magnitud
// que cada clave representa (rango de opacidad, px/s) vive en `lib/animation.ts`, no acá.

test('DEFAULTS.hero.veloIntensidad y .tickerVelocidad son "media" (byte-idéntico al mecanismo de siempre)', () => {
  assert.equal(DEFAULTS.hero.veloIntensidad, 'media');
  assert.equal(DEFAULTS.hero.tickerVelocidad, 'media');
});

test('hero: sin fila, veloIntensidad/tickerVelocidad resuelven a "media"', () => {
  const r = resolverSiteContent({});
  assert.equal(r.hero.veloIntensidad, 'media');
  assert.equal(r.hero.tickerVelocidad, 'media');
});

test('hero: "suave"/"lenta" guardados se respetan', () => {
  const r = resolverSiteContent({ hero: { veloIntensidad: 'suave', tickerVelocidad: 'lenta' } });
  assert.equal(r.hero.veloIntensidad, 'suave');
  assert.equal(r.hero.tickerVelocidad, 'lenta');
});

test('hero: veloIntensidad/tickerVelocidad fuera del set cerrado (basura) caen a "media" — nunca lanzan', () => {
  for (const basura of ['fuerte', '', null, undefined, 42, {}, ['suave']]) {
    assert.equal(resolverSiteContent({ hero: { veloIntensidad: basura } }).hero.veloIntensidad, 'media');
    assert.equal(resolverSiteContent({ hero: { tickerVelocidad: basura } }).hero.tickerVelocidad, 'media');
  }
});

test('resolverVariante con las claves de veloIntensidad/tickerVelocidad: ausente/basura → "media"; los valores del set cerrado se respetan', () => {
  assert.equal(resolverVariante(REGISTRY.hero.escalares!.veloIntensidad, undefined), 'media');
  assert.equal(resolverVariante(REGISTRY.hero.escalares!.veloIntensidad, 'foo'), 'media');
  assert.equal(resolverVariante(REGISTRY.hero.escalares!.veloIntensidad, 'suave'), 'suave');
  assert.equal(resolverVariante(REGISTRY.hero.escalares!.tickerVelocidad, undefined), 'media');
  assert.equal(resolverVariante(REGISTRY.hero.escalares!.tickerVelocidad, 'foo'), 'media');
  assert.equal(resolverVariante(REGISTRY.hero.escalares!.tickerVelocidad, 'lenta'), 'lenta');
});

// ── EL TERCER PASO DE veloIntensidad — § HERO-VELO-INTERMEDIO-1 (2026-09-28): 'intermedia' entra
// ENTRE 'suave' y 'media'. El owner, sobre el gate visual de 'suave' ya aplicada: «el velo del hero
// puede ser un poquito más oscuro, si eso logra que las letras... se aprecien mejor». El RANGO exacto
// (piso/techo) y su contraste medido viven en `lib/animation.test.ts` — acá sólo el VOCABULARIO: el
// set cerrado, su orden, y que el resolver lo respete/clampe igual que a 'suave'.

test('VELO_INTENSIDADES es exactamente ["suave", "intermedia", "media"], en ESE orden — de más claro a más oscuro, para que el <select> del panel se lea como escala', () => {
  assert.deepEqual(VELO_INTENSIDADES, ['suave', 'intermedia', 'media']);
});

test('"media" sigue siendo la CANÓNICA pese a quedar última en el array — orden de presentación y canónica son ejes independientes', () => {
  assert.equal(REGISTRY.hero.escalares!.veloIntensidad.canonica, 'media');
});

test('hero: "intermedia" guardada se respeta (igual que "suave")', () => {
  const r = resolverSiteContent({ hero: { veloIntensidad: 'intermedia' } });
  assert.equal(r.hero.veloIntensidad, 'intermedia');
});

test('hero: veloIntensidad "intermedia" NO cae a "media" — no es basura, es un valor del set cerrado', () => {
  assert.notEqual(resolverSiteContent({ hero: { veloIntensidad: 'intermedia' } }).hero.veloIntensidad, 'media');
});

test('resolverVariante con la clave "intermedia" de veloIntensidad: se respeta, no clampa a la canónica', () => {
  assert.equal(resolverVariante(REGISTRY.hero.escalares!.veloIntensidad, 'intermedia'), 'intermedia');
});

// ── EL BORRADO DE BLOBS NO DEBE PERDER UN CAMPO-IMAGEN (§ HERO-VIDEO-COMO-DATO-1) ──────────────────
// `imagenesDe` (site-content-blobs.ts) borra por diff los campos que `REGISTRY[seccion].imagenes`
// nombra. Un nombre mal escrito ahí (typo, rename, un campo nuevo olvidado) deja ese blob SIN
// borrar para siempre — el mismo defecto de mantener DOS listas a mano que ya costó #65-B, sólo que
// del lado del BORRADO en vez del GUARDADO. DERIVADO de DEFAULTS (la instancia real), no una
// tercera lista a mano.
//
// ALCANCE: secciones de campos PLANOS (no-repeater) — ahí `imagenes` nombra campos de PRIMER NIVEL,
// comparables 1:1 contra `Object.keys(DEFAULTS[seccion])`. Las REPEATER (`nosotrosGaleria`) nombran
// campos DE ÍTEM (`url`, `poster`), que no viven en `DEFAULTS[seccion]` (el array de items nace
// vacío) — las cubre su propio test manual y nombrado (ver "REGISTRY.nosotrosGaleria.imagenes" más
// abajo), no éste. Limitación NOMBRADA, como la del test derivado del schema editable (§ #65-B).
test('todo campo de `imagenes` (secciones NO-repeater) existe en DEFAULTS[seccion] — o el borrado de blobs lo pierde en silencio', () => {
  for (const seccion of Object.keys(REGISTRY) as SeccionKey[]) {
    const def = REGISTRY[seccion];
    if (def.repeater || !def.imagenes?.length) continue;
    const camposModelo = new Set(Object.keys(DEFAULTS[seccion]));
    const faltantes = def.imagenes.filter(f => !camposModelo.has(f));
    assert.deepEqual(faltantes, [],
      `«${seccion}»: REGISTRY.imagenes nombra campos que no existen en DEFAULTS (revisa un typo/rename): ${faltantes.join(', ')}`);
  }
});

test('REGISTRY.hero.imagenes incluye los CUATRO blobs del hero (video/póster de escritorio Y de teléfono) — si no, un blob reemplazado queda HUÉRFANO en el storage para siempre (§ HERO-VIDEO-MOVIL-1, amplía la lista de HERO-VIDEO-COMO-DATO-1)', () => {
  assert.deepEqual(REGISTRY.hero.imagenes, ['imagen', 'imagenPoster', 'imagenMovil', 'imagenMovilPoster']);
});

// ── `bandaOscuraCanonica` (§ EJE-5-VARIANTES-HERO): la canónica de darkness, VARIANT-AWARE ────────
// El hero es la ÚNICA banda cuya canónica depende de su variante — 'curtina' oscura (el fondo
// literal de hoy, `--sf-tinta`), 'ficha' clara (`--sf-fondo`). El resto de las bandas no varía con
// su variante y sigue resolviendo por `BANDAS_OSCURAS` a secas, para CUALQUIER `variante` recibida.

test('bandaOscuraCanonica: hero·curtina (o variante ausente) → true (oscura)', () => {
  assert.equal(bandaOscuraCanonica('hero', 'curtina'), true);
  assert.equal(bandaOscuraCanonica('hero'), true);
  assert.equal(bandaOscuraCanonica('hero', undefined), true);
});

test('bandaOscuraCanonica: hero·ficha → false (clara) — el FLIP que este slice introduce', () => {
  assert.equal(bandaOscuraCanonica('hero', 'ficha'), false);
});

test('bandaOscuraCanonica: bandas oscuras SIN variante propia (brandStory/subscriptionCTA) siguen oscuras para CUALQUIER variante', () => {
  for (const bandaId of ['brandStory', 'subscriptionCTA'] as const) {
    assert.equal(bandaOscuraCanonica(bandaId), true);
    assert.equal(bandaOscuraCanonica(bandaId, 'ficha'), true); // ignorada: no bifurcan
    assert.equal(bandaOscuraCanonica(bandaId, 'curtina'), true);
  }
});

test('bandaOscuraCanonica: bandas claras SIN variante propia (trustBadges/featured/presentaciones/testimonials) siguen claras para CUALQUIER variante', () => {
  for (const bandaId of ['trustBadges', 'featured', 'presentaciones', 'testimonials'] as const) {
    assert.equal(bandaOscuraCanonica(bandaId), false);
    assert.equal(bandaOscuraCanonica(bandaId, 'ficha'), false);
    assert.equal(bandaOscuraCanonica(bandaId, 'indice'), false); // presentaciones tiene sus PROPIAS variantes, ninguna oscura
  }
});

// ── `bandaUniforme` (§ EJE-5-NAV-UNIFORME): ¿la banda tiene UN solo tono? Puro LAYOUT, fuente
// ÚNICA en `VariantesDef.noUniformes` — a diferencia de la darkness (fuente dinámica, el esquema,
// § `bandaOscuraCanonica`/`bandaEsOscura`), un esquema no parte ni une una banda.

test('bandaUniforme: hero·ficha → false (bi-tonal: crema a la izquierda, foto oscura a la derecha) — el FIX de este slice', () => {
  assert.equal(bandaUniforme('hero', 'ficha'), false);
});

test('bandaUniforme: hero·curtina (o variante ausente) → true', () => {
  assert.equal(bandaUniforme('hero', 'curtina'), true);
  assert.equal(bandaUniforme('hero'), true);
  assert.equal(bandaUniforme('hero', undefined), true);
});

test('bandaUniforme: presentaciones·mosaico, ·indice y ·riel → true (ninguna variante de presentaciones es partida)', () => {
  // 'riel' (CORTE-PRESENTACIONES-RIEL-1) no entra a `noUniformes` de `presentaciones` — la banda del
  // riel es un solo tono sólido, como mosaico e índice, nunca bi-tonal.
  assert.equal(bandaUniforme('presentaciones', 'mosaico'), true);
  assert.equal(bandaUniforme('presentaciones', 'indice'), true);
  assert.equal(bandaUniforme('presentaciones', 'riel'), true);
});

test('bandaUniforme: una banda ESTRUCTURAL sin sección (trustBadges/featured) → true — sin `variantes` declaradas, uniforme por default', () => {
  assert.equal(bandaUniforme('trustBadges', undefined), true);
  assert.equal(bandaUniforme('featured', undefined), true);
});

test('bandaUniforme: subscriptionCTA·bloque y ·linea → true (sin `noUniformes` declarado, § TEMAS-SUBSCRIPTIONCTA-LINEA-1)', () => {
  assert.equal(bandaUniforme('subscriptionCTA', 'bloque'), true);
  assert.equal(bandaUniforme('subscriptionCTA', 'linea'), true);
  assert.equal(bandaUniforme('subscriptionCTA', undefined), true);
});

test('bandaUniforme: brandStory·columnas y ·centrada → true (sin `noUniformes` declarado — ninguna de las dos es bi-tonal, § CORTE-BRANDSTORY-COLLAGE-1)', () => {
  assert.equal(bandaUniforme('brandStory', 'columnas'), true);
  assert.equal(bandaUniforme('brandStory', 'centrada'), true);
  assert.equal(bandaUniforme('brandStory', undefined), true);
});

// ── `varianteDeBanda` (§ EJE-5-VARIANTES-HERO): la variante resuelta de una banda, para el nav ────

test('varianteDeBanda: hero resuelve a "curtina" con los DEFAULTS resueltos (sin fila)', () => {
  const r = resolverSiteContent({});
  assert.equal(varianteDeBanda(r, 'hero'), 'curtina');
});

test('varianteDeBanda: hero resuelve a "ficha" cuando se guarda esa variante', () => {
  const r = resolverSiteContent({ hero: { variante: 'ficha' } });
  assert.equal(varianteDeBanda(r, 'hero'), 'ficha');
});

test('varianteDeBanda: una banda ESTRUCTURAL sin sección en SiteContentData (trustBadges/featured) → undefined', () => {
  const r = resolverSiteContent({});
  assert.equal(varianteDeBanda(r, 'trustBadges'), undefined);
  assert.equal(varianteDeBanda(r, 'featured'), undefined);
});

test('varianteDeBanda: subscriptionCTA resuelve a "bloque" con los DEFAULTS resueltos (sin fila) — TEMAS-SUBSCRIPTIONCTA-LINEA-1', () => {
  const r = resolverSiteContent({});
  assert.equal(varianteDeBanda(r, 'subscriptionCTA'), 'bloque');
});

test('varianteDeBanda: subscriptionCTA resuelve a "linea" cuando se guarda esa variante', () => {
  const r = resolverSiteContent({ subscriptionCTA: { variante: 'linea' } });
  assert.equal(varianteDeBanda(r, 'subscriptionCTA'), 'linea');
});

test('varianteDeBanda: brandStory resuelve a "columnas" con los DEFAULTS resueltos (sin fila) — TEMAS-P2-BRANDSTORY-1', () => {
  const r = resolverSiteContent({});
  assert.equal(varianteDeBanda(r, 'brandStory'), 'columnas');
});

// ── El ORDEN de las bandas (§ eje 5, parte c): meta CERRADA, gemela de `paginas`/`tema`/`esquemas` ──

test('ORDEN_DEFAULT es exactamente la secuencia de HOY del home (byte-idéntico al JSX fijo de ayer; § ORIGEN-BANDA-1 sumó `origen` tras `brandStory`; § MARQUESINA-BANDA-1 sumó `marquesina` tras `hero`)', () => {
  assert.deepEqual(ORDEN_DEFAULT, [
    'hero', 'marquesina', 'trustBadges', 'featured', 'brandStory', 'origen', 'presentaciones', 'subscriptionCTA', 'testimonials',
  ]);
  assert.deepEqual(BANDA_IDS, ORDEN_DEFAULT); // misma lista, una sola fuente
});

test('orden: sin nada guardado → el orden default completo (los 9 ids, en orden)', () => {
  assert.deepEqual(resolverSiteContent({}).orden, ORDEN_DEFAULT);
});

test('orden NO es una sección: no rompe el loop de secciones, y el hero sí resuelve', () => {
  const r = resolverSiteContent({ orden: ['featured', 'hero'] });
  assert.deepEqual(r.orden, ['featured', 'hero', 'marquesina', 'trustBadges', 'brandStory', 'origen', 'presentaciones', 'subscriptionCTA', 'testimonials']);
  assert.ok(typeof r.hero.titulo === 'string'); // las secciones siguen resolviendo
});

test('orden: SeccionKey lo excluye — el REGISTRY no tiene entrada `orden` (no es sección)', () => {
  assert.equal('orden' in REGISTRY, false);
});

test('resolverOrden: un orden VÁLIDO y COMPLETO se respeta tal cual', () => {
  assert.deepEqual(resolverOrden(ORDEN_DEFAULT), ORDEN_DEFAULT);
  const alterno = ['presentaciones', 'hero', 'featured', 'marquesina', 'trustBadges', 'brandStory', 'testimonials', 'subscriptionCTA', 'origen'];
  assert.deepEqual(resolverOrden(alterno), alterno);
});

test('resolverOrden: PARCIAL → se completa con lo faltante AL FINAL, en el orden default', () => {
  assert.deepEqual(
    resolverOrden(['presentaciones', 'featured']),
    ['presentaciones', 'featured', 'hero', 'marquesina', 'trustBadges', 'brandStory', 'origen', 'subscriptionCTA', 'testimonials'],
  );
});

test('resolverOrden: DEDUPLICA — la primera aparición gana, la repetida se descarta', () => {
  assert.deepEqual(
    resolverOrden(['hero', 'featured', 'hero', 'featured']),
    ['hero', 'featured', 'marquesina', 'trustBadges', 'brandStory', 'origen', 'presentaciones', 'subscriptionCTA', 'testimonials'],
  );
});

test('resolverOrden: ids DESCONOCIDOS se descartan (no revientan, no ocupan un lugar)', () => {
  assert.deepEqual(
    resolverOrden(['hero', 'unaSeccionQueNoExiste', 'featured']),
    ['hero', 'featured', 'marquesina', 'trustBadges', 'brandStory', 'origen', 'presentaciones', 'subscriptionCTA', 'testimonials'],
  );
});

test('resolverOrden: entrada basura (no-array, o array de basura) → el orden default entero, NO lanza', () => {
  for (const basura of [null, undefined, 'x', 42, {}, [1, 2, 3], [null, 'hero', {}]]) {
    const r = resolverOrden(basura);
    assert.deepEqual([...r].sort(), [...ORDEN_DEFAULT].sort());
    assert.equal(r.length, ORDEN_DEFAULT.length);
  }
});

test('resolverOrden: SIEMPRE devuelve las 9 bandas — ninguna se cae, pase lo que pase en `stored`', () => {
  for (const stored of [[], ['hero'], ['hero', 'hero', 'hero'], ORDEN_DEFAULT]) {
    assert.equal(resolverOrden(stored).length, BANDA_IDS.length);
    assert.deepEqual(new Set(resolverOrden(stored)), new Set(BANDA_IDS));
  }
});

// ── resolverOrdenNosotros / BANDA_NOSOTROS_IDS (§ NOSOTROS-SISTEMA-DE-BANDAS-1) — GEMELA reducida ──
// de la suite de `resolverOrden` de arriba: la página /nosotros no tiene (todavía) un campo
// persistido que reordenar, así que el resolver no toma `stored` — no hay "garbage" que limpiar, ni
// "parcial"/"dedup" que ejercer. Lo que SÍ hay que afirmar, igual que del lado de la home: el orden
// de HOY, y que el dominio es EXHAUSTIVO (nunca se cae una banda).
test('resolverOrdenNosotros: devuelve las TRES bandas de /nosotros, en el orden de hoy — el cierre AL FINAL (§ NOSOTROS-COMPOSICION-1)', () => {
  assert.deepEqual(resolverOrdenNosotros(), ['nosotrosHistoria', 'nosotrosGaleria', 'nosotrosCierre']);
});

test('resolverOrdenNosotros: el dominio es EXHAUSTIVO — exactamente BANDA_NOSOTROS_IDS, sin faltantes ni de más', () => {
  assert.equal(resolverOrdenNosotros().length, BANDA_NOSOTROS_IDS.length);
  assert.deepEqual(new Set(resolverOrdenNosotros()), new Set(BANDA_NOSOTROS_IDS));
});

// ── CONTENIDO-NEUTRALIZAR-1 (2026-09-12): los defaults dejaron de ser el contenido de Nayoli ──────
// Antes DEFAULTS *era* el contenido de Nayoli, y la familia de tests "byte-idéntico" (arriba) lo
// protegía con razón. Ahora Nayoli tiene su propia fila de SiteContent (sembrada en producción), y
// lo que hay que proteger es lo CONTRARIO: que el default no sea el contenido de NADIE. Las dos
// pruebas de abajo son el regression-catcher real — atrapan al próximo que agregue una sección
// cafetera (o cualquier identidad de cliente) sin pensarlo, y ninguna de las dos enumera campos a
// mano: caminan `DEFAULTS`/`REGISTRY` tal como existen.

// Términos prohibidos en el copy de comercio genérico: café (y su familia — grano/molido/tueste/
// tostado/cafetal/greca), la identidad concreta de Nayoli (el nombre, la finca, Supatá,
// Cundinamarca), y la SEGUNDA CAPA (CONTENIDO-NEUTRALIZAR-2) — los que asumen manufactura o
// producto perecedero SIN nombrar café: tanda(s), elaborad(o/a/ación), prepara(do/mos/ción)
// —cubre tanto el adjetivo ("preparado fresco") como el verbo ("preparamos"), las dos formas que
// el molde cafetero traducido usaba—, fresco, material(es), artesanal. Ampliado a propósito más
// allá de los 6 términos mínimos del spec original (café, granos, tueste, finca, Supatá, Nayoli):
// un catcher angosto deja pasar el mismo defecto con otra palabra.
//
// EL LÍMITE, dicho en vez de escondido: esta lista NO intenta atrapar toda suposición de origen
// del producto — "proceso", "pieza", "producto" son palabras de negocio genéricas y ambiguas
// (un "proceso de compra" es neutro; "pieza de ropa" es un uso legítimo) que banearlas produciría
// falsos positivos sin ganar precisión. Lo que se agregó acá son los términos que, en la revisión
// de CONTENIDO-NEUTRALIZAR-2, aparecieron repetidos y sin ambigüedad de lectura (siempre asumen
// manufactura o perecedero). Si esta lista sigue creciendo en la próxima tanda, es señal de que el
// test correcto ya no es un grep de términos sino una revisión de lectura — anotarlo, no forzarlo.
const TERMINOS_PROHIBIDOS = /caf[eé]|nayoli|supat[aá]|cundinamarca|\bgrano|molid|tueste|tosta|finca|cafetal|greca|tanda|elaborad|prepara|fresco|material|artesanal/i;

function walkStrings(v: unknown, path: string, out: [string, string][]): void {
  if (typeof v === 'string') { out.push([path, v]); return; }
  if (v === null || typeof v !== 'object') return;
  if (Array.isArray(v)) { v.forEach((x, i) => walkStrings(x, `${path}[${i}]`, out)); return; }
  for (const k of Object.keys(v)) walkStrings((v as Record<string, unknown>)[k], path ? `${path}.${k}` : k, out);
}

// Los NOMBRES de campo-imagen salen del REGISTRY (`def.imagenes`), no de una lista a mano: es la
// MISMA fuente que ya gobierna el borrado de blobs (`imagenesDe`, `site-content-blobs.ts`). Las
// rutas de imagen quedan EXCLUIDAS del catcher a propósito — son ítem aparte
// (`MARCA-DE-CLIENTE-EN-EL-REPO-1`) y no las toca este slice.
function valoresDeCamposImagen(): Set<string> {
  const out = new Set<string>();
  for (const key of Object.keys(REGISTRY) as (keyof typeof DEFAULTS)[]) {
    const def = REGISTRY[key as keyof typeof REGISTRY];
    if (!def.imagenes?.length) continue;
    const sec = DEFAULTS[key] as Record<string, unknown>;
    for (const campo of def.imagenes) {
      const v = sec[campo];
      if (typeof v === 'string' && v.trim() !== '') out.add(v);
    }
  }
  return out;
}

// Los valores de `REGISTRY.<seccion>.escalares` (§ CORTE-HERO-REVELADO-MASCARA-1) son SENTINELS de
// config —resueltos a comportamiento por `resolverVariante`, nunca copy visible para el visitante—,
// MISMA razón que excluye a las rutas de imagen arriba. Dos escalares de secciones DISTINTAS que
// comparten canónica (`hero.veloIntensidad`/`hero.tickerVelocidad`, los dos `'media'`) no es el
// defecto de copy duplicado que el test de abajo existe para atrapar — sin esta exclusión, el
// collator confundiría "dos ejes que por casualidad eligen el mismo NOMBRE de opción" con "el mismo
// párrafo pegado dos veces".
function valoresDeCamposEscalares(): Set<string> {
  const out = new Set<string>();
  for (const key of Object.keys(REGISTRY) as (keyof typeof DEFAULTS)[]) {
    const def = REGISTRY[key as keyof typeof REGISTRY];
    if (!def.escalares) continue;
    const sec = DEFAULTS[key] as Record<string, unknown>;
    for (const campo of Object.keys(def.escalares)) {
      const v = sec[campo];
      if (typeof v === 'string' && v.trim() !== '') out.add(v);
    }
  }
  return out;
}

test('DEFAULTS: ningún campo de TEXTO menciona café, Nayoli, ni asume manufactura/perecedero (tanda, elaborad-, prepara-, fresco, material, artesanal) — las rutas de imagen quedan EXCLUIDAS a propósito (§ MARCA-DE-CLIENTE-EN-EL-REPO-1, no es parte de este slice)', () => {
  const rutasDeImagen = valoresDeCamposImagen();
  const todas: [string, string][] = [];
  walkStrings(DEFAULTS as unknown, '', todas);
  const ofensores = todas.filter(([, val]) => !rutasDeImagen.has(val) && TERMINOS_PROHIBIDOS.test(val));
  assert.deepEqual(ofensores, [], `campos con identidad de café/Nayoli o molde cafetero traducido: ${ofensores.map(([p]) => p).join(', ')}`);
});

// ── CONTENIDO-NEUTRALIZAR-2 (2026-09-12): ningún texto exacto se repite entre secciones ──────────
// Defecto b del gate del owner: `'De nuestras manos a las tuyas'` aparecía IDÉNTICO en brandStory
// (home) y nosotrosHistoria (/nosotros) — un cliente que no edite ve el mismo título dos veces. El
// barrido completo (hecho a mano durante la reescritura) encontró SEIS duplicados exactos más:
// subscriptionCTA.subtitulo = suscripcionPlanes.subtitulo, subscriptionCTA.bullet1 = ben1_2 = ben2_2,
// bullet2 = ben1_1 = ben2_1 = ben3_1, bullet3 = ben1_3 = ben2_3 = ben3_3 (los TRES planes con el
// mismo beneficio, el defecto b del gate), brandStory/nosotrosHistoria.{titulo,parrafo1,parrafo2}, y
// suscripcionPasos.{paso1Label,paso2Label} = suscripcionPlanes.planesTitulo/presentaciones.eyebrow.
// Éste es el regression-catcher: camina `DEFAULTS` tal como existe (no enumera campos a mano) y
// falla si un valor de texto no-vacío se repite, salvo la excepción declarada.
//
// LA PRIMERA EXCEPCIÓN AL COLLATOR: 'Suscripción Mensual' en hero.ctaSecundarioLabel (el CTA del home)
// y suscripcionPlanes.eyebrow (el kicker de la página a la que ese CTA lleva). No es el defecto que
// el owner señaló —un párrafo idéntico narrando la misma historia dos veces—: es un botón y el
// título de SU destino diciendo lo mismo, que es la consistencia de nomenclatura esperada de
// cualquier link (un botón "Ver Catálogo" que lleve a una página titulada "Catálogo" no es un
// duplicado a resolver). Declarada explícita para que un futuro cambio de cualquiera de los dos la
// vea y decida a propósito, no la pierda en un refactor.
//
// TRES MÁS (§ MUESTRARIO-FOOTER-TEMA-1): al mudar `siteConfig.footerNav` (código fijo) a
// `REGISTRY.footer` (dato), los VALORES que ya existían ahí — literales que ESTABAN en la fuente
// vieja, no inventados por este slice — coinciden con otros defaults por la misma razón que
// 'Suscripción Mensual': un enlace/encabezado y el nombre de lo que nombra. 'Nuestra Historia' es
// el link del footer a /nosotros (`footer.linkNuestraHistoria`, ya era ese texto en
// `siteConfig.footerNav.empresa`) Y el kicker de la sección que teje esa misma historia en la home
// (`brandStory.eyebrow`) — la MISMA idea contada dos veces, con la MISMA palabra, es justo la
// consistencia de vocabulario que un visitante espera, no el defecto que el owner señaló (un
// párrafo completo repetido). 'Tienda' y 'Suscripciones' son el encabezado/enlace del footer
// (`footer.columnaTienda`/`footer.linkSuscripciones`) coincidiendo con las MISMAS etiquetas del
// menú de navegación (`menu.labelTienda`/`.labelSuscripciones`) — el pie y el nav usando la MISMA
// palabra para la MISMA sección es coherencia de nomenclatura, no duplicación de contenido. Las
// tres preservan el texto EXACTO que `siteConfig.footerNav`/el JSX hardcodeado ya tenían: cambiar
// alguna para esquivar el collator habría roto el byte-idéntico que el slice exige.
const DUPLICADO_PERMITIDO = new Set(['Suscripción Mensual', 'Nuestra Historia', 'Tienda', 'Suscripciones']);

test('DEFAULTS: ningún texto (no-imagen) se repite EXACTO entre campos distintos — salvo el CTA↔destino declarado', () => {
  const rutasDeImagen = valoresDeCamposImagen();
  const valoresEscalares = valoresDeCamposEscalares();
  const todas: [string, string][] = [];
  walkStrings(DEFAULTS as unknown, '', todas);
  const porValor = new Map<string, string[]>();
  for (const [path, val] of todas) {
    if (val.trim() === '' || rutasDeImagen.has(val) || valoresEscalares.has(val) || DUPLICADO_PERMITIDO.has(val)) continue;
    const arr = porValor.get(val) ?? [];
    arr.push(path);
    porValor.set(val, arr);
  }
  const duplicados = [...porValor.entries()].filter(([, paths]) => paths.length > 1);
  assert.deepEqual(
    duplicados,
    [],
    `textos repetidos entre secciones: ${duplicados.map(([val, paths]) => `"${val}" en ${paths.join(' | ')}`).join(' ; ')}`,
  );
});

// EXCEPCIÓN DECLARADA (MARCA-CLIENTE-PRESENTACIONES-1, 2026-09-12), mismo patrón que
// `DUPLICADO_PERMITIDO` arriba: `presentaciones.imagen1`/`.imagen2` son `requerido` en el REGISTRY
// pero su DEFAULT es '' a propósito. No es el descuido que este test existe para atrapar — el propio
// RENDER tolera el hueco (`op.img &&`, GrindChooserMosaico.tsx:71 / GrindChooserIndice.tsx:86: sin
// foto se ve el fondo `--sf-linea`, nunca un `<img src="">` roto) — así que un default vacío es tan
// seguro ahí como uno lleno. La alternativa era la foto REAL de la bolsa de Café Nayoli horneada como
// default de todo despliegue nuevo, que es el defecto que esta tanda cierra. Con el default vacío,
// `requerido` y `opcional` resuelven IDÉNTICO para estos dos campos —los dos dan '' ante ausente o
// vacío—, así que no hay diferencia funcional en dejarlos `requerido`; se conservan así por
// consistencia con el resto de la tarjeta (label1/label2 sí necesitan su default no-vacío).
const REQUERIDO_VACIO_PERMITIDO = new Set(['presentaciones.imagen1', 'presentaciones.imagen2']);

test('DEFAULTS: ningún campo `requerido` del REGISTRY queda vacío en DEFAULTS (un requerido vacío nunca neutraliza — reaparece el default en cada lectura), salvo la excepción declarada', () => {
  const vacios: string[] = [];
  for (const key of Object.keys(REGISTRY) as (keyof typeof DEFAULTS)[]) {
    const def = REGISTRY[key as keyof typeof REGISTRY];
    const sec = DEFAULTS[key] as Record<string, unknown>;
    for (const [campo, tipo] of Object.entries(def.campos)) {
      if (tipo !== 'requerido') continue;
      const val = sec[campo];
      if (typeof val !== 'string' || val.trim() === '') vacios.push(`${key}.${campo}`);
    }
  }
  assert.deepEqual(vacios.filter(v => !REQUERIDO_VACIO_PERMITIDO.has(v)), []);
});

// La propiedad NUEVA que evita que esto vuelva (MARCA-CLIENTE-PRESENTACIONES-1). Deriva los campos-
// imagen del REGISTRY (`def.imagenes`, la MISMA fuente que `valoresDeCamposImagen` arriba y el
// borrado de blobs en `site-content-blobs.ts`) en vez de enumerar rutas a mano: un futuro default de
// imagen queda cubierto sin que nadie recuerde agregarlo acá.
//
// EL PATRÓN ES PARCIAL, NO GENERAL, y hay que decirlo para no confiar de más en esta guarda: sólo
// puede reconocer marca por el NOMBRE DEL CLIENTE ACTUAL ('nayoli'), porque un ARCHIVO DE IMAGEN no
// lleva ningún otro marcador de "esto es la foto de un cliente" — a diferencia del catcher de TEXTO
// de arriba, que reconoce un VOCABULARIO (café, tueste, finca…) que cualquier cliente cafetero
// repetiría con otras palabras. El PRÓXIMO cliente que suba su propia foto y la deje referenciada
// desde un default de código (en vez de subirla al Blob del editor, que es el camino real) NO
// dispara este test — necesitaría su propio nombre agregado a mano acá, o un mecanismo distinto (p.
// ej.: prohibir todo literal `/images/*` NUEVO en un campo-imagen del REGISTRY y exigir Blob). Se
// deja escrito para que la guarda se lea como lo que es —parcial, no general— y no como cerrada.
test('DEFAULTS: ningún campo-imagen apunta a un archivo con marca de un cliente (nayoli)', () => {
  const ofensores: string[] = [];
  for (const key of Object.keys(REGISTRY) as (keyof typeof DEFAULTS)[]) {
    const def = REGISTRY[key as keyof typeof REGISTRY];
    if (!def.imagenes?.length) continue;
    const sec = DEFAULTS[key] as Record<string, unknown>;
    for (const campo of def.imagenes) {
      const v = sec[campo];
      if (typeof v === 'string' && /nayoli/i.test(v)) ofensores.push(`${key}.${campo} = "${v}"`);
    }
  }
  assert.deepEqual(ofensores, [], `default de imagen con marca de cliente: ${ofensores.join(' ; ')}`);
});

// ── IMAGENES-STOCK-TEMPLATE-1 (2026-09-12): toda ruta /images/… de un default APUNTA a un archivo
// que EXISTE en `public/images/` ──────────────────────────────────────────────────────────────────
// NO transcribe "los defaults son estas cinco rutas nuevas" — eso repetiría el cambio y se rompería
// cada vez que alguien reemplace una foto sin tocar este test. En cambio DERIVA las rutas de
// `valoresDeCamposImagen()` (la MISMA fuente que ya gobierna el borrado de blobs y el catcher de
// marca de cliente arriba), filtra las que son un path ESTÁTICO de `/images/…` (una URL de Blob no
// aplica — vive en otro storage) y afirma que el archivo está en disco. Así atrapa el error real que
// puede pasar de verdad — un typo en el nombre, o un archivo que no se commiteó — sin volverse
// frágil ante el próximo cambio de foto.
test('DEFAULTS: toda ruta /images/… de un campo-imagen apunta a un archivo que existe en public/images/', () => {
  const dirImagenes = path.join(fileURLToPath(new URL('.', import.meta.url)), '../../public/images');
  const rutas = [...valoresDeCamposImagen()].filter(v => v.startsWith('/images/'));
  assert.ok(rutas.length > 0, 'no se encontró ninguna ruta /images/… en los campos-imagen de DEFAULTS — ¿cambió el prefijo?');
  const faltantes = rutas.filter(r => !existsSync(path.join(dirImagenes, r.slice('/images/'.length))));
  assert.deepEqual(faltantes, [], `ruta de DEFAULTS sin archivo en disco: ${faltantes.join(' ; ')}`);
});

// ── HERO-SIN-TARJETA-Y-PDP-IMAGEN-1 (defecto 1): `productoMarquesina` NO cae al primer producto ──
//
// EL DEFECTO: `productoSpotlight` cae al PRIMER producto del catálogo cuando el slug está vacío o
// no matchea — correcto para `spotlight` (la banda ENTERA es de un producto), pero la tarjeta
// FLOTANTE de `marquesina` (la banda suelta y el hero·sticky de CORTE) lo usaba TAMBIÉN, así que un
// pin vacío/roto mostraba un producto arbitrario en vez de ocultar la tarjeta — el gate visual del
// owner del 2026-09-29 lo destapó al cargar productos (con el catálogo vacío no se veía).
//
// `productoMarquesina` es el fix: MISMO catálogo/slug, NUNCA cae a `catalog[0]`.

const CATALOGO_PRUEBA = [
  { slug: 'cafe-a' },
  { slug: 'cafe-b' },
];

test('productoSpotlight: slug vacío o sin match CAE al primer producto (spotlight, comportamiento conservado)', () => {
  assert.deepEqual(productoSpotlight(CATALOGO_PRUEBA, ''), CATALOGO_PRUEBA[0]);
  assert.deepEqual(productoSpotlight(CATALOGO_PRUEBA, 'no-existe'), CATALOGO_PRUEBA[0]);
  assert.deepEqual(productoSpotlight(CATALOGO_PRUEBA, 'cafe-b'), CATALOGO_PRUEBA[1]);
  assert.equal(productoSpotlight([], 'cafe-a'), null, 'catálogo vacío: null, ni el fallback tiene sentido');
});

test('productoMarquesina: slug vacío o sin match devuelve null — NUNCA cae al primer producto (§ el defecto de la tarjeta arbitraria)', () => {
  assert.equal(productoMarquesina(CATALOGO_PRUEBA, ''), null);
  assert.equal(productoMarquesina(CATALOGO_PRUEBA, 'no-existe'), null);
  assert.equal(productoMarquesina([], ''), null);
  assert.equal(productoMarquesina([], 'cafe-a'), null);
});

test('productoMarquesina: con un slug que SÍ matchea, resuelve el producto exacto (el caso feliz no cambia)', () => {
  assert.deepEqual(productoMarquesina(CATALOGO_PRUEBA, 'cafe-b'), CATALOGO_PRUEBA[1]);
});

test('productoMarquesina comparte el criterio "sin fallback" de productoOtraTalla — mismo comportamiento ante los mismos casos', () => {
  for (const slug of ['', 'no-existe', 'cafe-a']) {
    assert.deepEqual(productoMarquesina(CATALOGO_PRUEBA, slug), productoOtraTalla(CATALOGO_PRUEBA, slug));
  }
});

// ── LOGO: `modo` (§ NAV-LOGO-Y-NOMBRE-1) — campo 'opcional' más, SIN clamp en el resolver ─────────
//
// El resolver NO clampa `logo.modo` al set cerrado de tres valores: es un campo `opcional` plano
// (§ REGISTRY.logo.campos), y el mecanismo que SÍ clampa (`variantes`/`escalares`, vía
// `resolverVariante`) exige una canónica FIJA que este campo no tiene —su default es CONDICIONAL,
// según haya o no imagen subida, algo que `resolverVariante` no puede mirar—. El clamp vive en
// `modoLogoResuelto` (marca-logo.ts), afirmado en su propio archivo de test; acá sólo se afirma el
// contrato del RESOLVER: ausente → el default (''); presente, aunque sea basura → tal cual.

test('DEFAULTS.logo.modo es "" (el default byte-idéntico, sin un valor inventado)', () => {
  assert.equal(DEFAULTS.logo.modo, '');
});

test('logo.modo: sin fila guardada, resuelve al DEFAULT ("")', () => {
  assert.equal(resolverSiteContent({}).logo.modo, '');
});

test('logo.modo: un valor de los tres SOBREVIVE al resolver, tal cual', () => {
  assert.equal(resolverSiteContent({ logo: { modo: 'logoYNombre' } }).logo.modo, 'logoYNombre');
  assert.equal(resolverSiteContent({ logo: { modo: 'soloNombre' } }).logo.modo, 'soloNombre');
});

test('logo.modo: basura SOBREVIVE tal cual — el resolver no clampa, SOFT (el clamp es de modoLogoResuelto, no de acá)', () => {
  assert.equal(resolverSiteContent({ logo: { modo: 'lo-que-sea' } }).logo.modo, 'lo-que-sea');
});

// ─── `navWordmark.taglineColor` (§ NAV-LOGO-MOVIL-CON-AIRE-1) — dominio CERRADO de 2, mismo patrón
// de validación que `navDrawerMovil.variante`/`carrito.variante` (§ sus propios tests): sólo un
// miembro del set sobrevive, cualquier otra cosa cae al default ('atenuado'). A diferencia de
// `logo.modo` (arriba, SOFT/raw), ACÁ el clamp vive en `resolverNavWordmark` mismo — el default es
// FIJO, no condicional a otro campo que el resolver no pueda mirar.

test('DEFAULTS.navWordmark.taglineColor es "atenuado" (el default byte-idéntico)', () => {
  assert.equal(DEFAULTS.navWordmark.taglineColor, 'atenuado');
});

test('navWordmark.taglineColor: sin fila guardada, resuelve al DEFAULT ("atenuado")', () => {
  assert.equal(resolverSiteContent({}).navWordmark.taglineColor, 'atenuado');
});

test('navWordmark.taglineColor: "acento" guardado SOBREVIVE tal cual', () => {
  assert.equal(resolverSiteContent({ navWordmark: { taglineColor: 'acento' } }).navWordmark.taglineColor, 'acento');
});

test('navWordmark.taglineColor: basura (ni "atenuado" ni "acento") cae al default, NUNCA lanza — SOFT', () => {
  assert.equal(resolverSiteContent({ navWordmark: { taglineColor: 'dorado' } }).navWordmark.taglineColor, 'atenuado');
  assert.equal(resolverSiteContent({ navWordmark: { taglineColor: 123 } }).navWordmark.taglineColor, 'atenuado');
});

test('navWordmark.taglineColor convive con navWordmark.activo sin pisarse — ejes independientes', () => {
  const r = resolverSiteContent({ navWordmark: { activo: true, taglineColor: 'acento' } });
  assert.equal(r.navWordmark.activo, true);
  assert.equal(r.navWordmark.taglineColor, 'acento');
});

// ─── hero.estilos (§ EDITOR-TIENDA-BARRA-FLOTANTE-1) ───────────────────────────────────────────────

test('REGISTRY.hero.estilos declara los CINCO elementos del spec, derivados de estilo-elemento.ts', () => {
  assert.deepEqual(REGISTRY.hero.estilos, ['titulo', 'subtitulo', 'fraseAlPie', 'ctaPrimarioLabel', 'ctaSecundarioLabel']);
});

test('DEFAULTS.hero.estilos: los CINCO elementos nacen "sin override" (byte-idéntico)', () => {
  for (const el of REGISTRY.hero.estilos!) {
    assert.deepEqual(DEFAULTS.hero.estilos[el], { fuente: null, tamano: null, color: null, alinear: null });
  }
});

test('resolverSiteContent({}): sin fila, hero.estilos resuelve a los CINCO elementos vacíos', () => {
  const r = resolverSiteContent({});
  assert.deepEqual(Object.keys(r.hero.estilos).sort(), ['ctaPrimarioLabel', 'ctaSecundarioLabel', 'fraseAlPie', 'subtitulo', 'titulo']);
  assert.deepEqual(r.hero.estilos.titulo, { fuente: null, tamano: null, color: null, alinear: null });
});

test('hero.estilos: un valor guardado para UN elemento se respeta; los demás quedan vacíos', () => {
  const r = resolverSiteContent({ hero: { estilos: { titulo: { tamano: 'enorme', color: 'tostado' } } } });
  assert.deepEqual(r.hero.estilos.titulo, { fuente: null, tamano: 'enorme', color: 'tostado', alinear: null });
  assert.deepEqual(r.hero.estilos.subtitulo, { fuente: null, tamano: null, color: null, alinear: null });
});

test('hero.estilos: basura en el guardado (no-objeto, un elemento inventado) NUNCA lanza — SOFT', () => {
  assert.doesNotThrow(() => resolverSiteContent({ hero: { estilos: 'basura' } }));
  const r = resolverSiteContent({ hero: { estilos: 'basura' } });
  assert.deepEqual(r.hero.estilos.titulo, { fuente: null, tamano: null, color: null, alinear: null });

  const r2 = resolverSiteContent({ hero: { estilos: { intruso: { color: 'acento' } } } });
  assert.deepEqual(Object.keys(r2.hero.estilos).sort(), ['ctaPrimarioLabel', 'ctaSecundarioLabel', 'fraseAlPie', 'subtitulo', 'titulo']);
});

test('una sección SIN `estilos` declarado (p. ej. marquesina) no gana la clave — no se escribe en absoluto', () => {
  const r = resolverSiteContent({});
  assert.ok(!('estilos' in r.marquesina), 'marquesina no declara estilos en REGISTRY — queda fuera a propósito');
});
