import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import StoreFooter from '@/components/storefront/StoreFooter';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { SiteSettingsProvider } from '@/components/storefront/SiteSettingsProvider';
import type { SiteSettings } from '@/lib/config/site-settings';

import {
  DEFAULTS,
  REGISTRY,
  BANDA_IDS,
  resolverSiteContent,
  columnasDeFooter,
  type SiteContentData,
  type FooterContent,
} from './site-content-defaults';
import { camposControladosPorPanel } from './panel-controles';

// § MUESTRARIO-FOOTER-TEMA-1. El pie de página deja de vivir 100% en código (`siteConfig.footerNav`/
// `legalNav`) y pasa a ser SECCIÓN del REGISTRY — MISMO precedente que `menu`: sección SIN ser BANDA
// (no entra a `BANDA_IDS`/`ORDEN_DEFAULT`, el pie se renderiza en el LAYOUT, en toda página) pero SÍ
// `SeccionKey` (campos, publica por el route genérico, control de panel).
//
// `FOOTER_HOY` reproduce EXACTAMENTE lo que `siteConfig.footerNav`/`legalNav` y el JSX hardcodeado
// de `StoreFooter.tsx` declaraban ANTES de este slice — la prueba de que el traslado a dato no
// cambió nada (Nayoli byte-idéntica).
const FOOTER_HOY: Omit<FooterContent, 'visible' | 'variante'> = {
  columnaTienda: 'Tienda',
  columnaAyuda: 'Ayuda',
  columnaEmpresa: 'Empresa',
  linkTienda: 'Todos los productos',
  linkSuscripciones: 'Suscripciones',
  linkRastrearPedido: 'Rastrear Pedido',
  linkPreguntasFrecuentes: 'Preguntas Frecuentes',
  linkNuestraHistoria: 'Nuestra Historia',
  // § MUESTRARIO-FOOTER-TARJETA-IMAGEN-1: la tarjeta de imagen opcional nace VACÍA — sin ella, el
  // pie de hoy (byte-idéntico).
  tarjetaImagen: '',
  tarjetaTexto: '',
  items: [],
};

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

function renderFooter(content: SiteContentData, settings: SiteSettings = SETTINGS_BASE): string {
  const arbol = React.createElement(SiteSettingsProvider, {
    value: settings,
    children: React.createElement(SiteContentProvider, { value: content, children: React.createElement(StoreFooter) }),
  });
  return renderToStaticMarkup(arbol);
}

const COLUMNAS_HOY = {
  tienda: [
    { label: 'Todos los productos', href: '/tienda' },
    { label: 'Suscripciones', href: '/suscripciones' },
  ],
  ayuda: [
    { label: 'Rastrear Pedido', href: '/rastrear-pedido' },
    { label: 'Preguntas Frecuentes', href: '/preguntas-frecuentes' },
  ],
  empresa: [
    { label: 'Nuestra Historia', href: '/nosotros' },
  ],
};

// ── EL PIE ES SECCIÓN, NO BANDA — mismo precedente que `menu` ──────────────────────────────────

test('footer NO está en BANDA_IDS — es sección del REGISTRY sin ser banda del home, como menu', () => {
  assert.ok(!(BANDA_IDS as readonly string[]).includes('footer'));
  assert.ok('menu' in REGISTRY); // el precedente
});

test('footer SÍ está en REGISTRY, con ocultable:false — chrome del layout, no se apaga entero', () => {
  assert.ok('footer' in REGISTRY);
  assert.equal(REGISTRY.footer.ocultable, false);
});

test('footer declara su repeater con itemsKey "items" (convención de todos los repeaters del archivo)', () => {
  assert.equal(REGISTRY.footer.repeater?.itemsKey, 'items');
});

// ── LOS DEFAULTS IGUALAN LO QUE `siteConfig.footerNav`/`legalNav` DECLARABA ─────────────────────

test('DEFAULTS.footer reproduce EXACTO lo que siteConfig declaraba antes de este slice', () => {
  const { visible: _v, variante: _va, ...resto } = DEFAULTS.footer;
  assert.deepEqual(resto, FOOTER_HOY);
});

test('DEFAULTS.footer.visible es true — el pie nunca nace apagado', () => {
  assert.equal(DEFAULTS.footer.visible, true);
});

// ── LA VARIANTE CANÓNICA ES LA DE HOY ────────────────────────────────────────────────────────────

test('REGISTRY.footer.variantes: la canónica es la composición de HOY (columnas lado a lado)', () => {
  assert.deepEqual(REGISTRY.footer.variantes?.claves, ['franjas', 'apilado']);
  assert.equal(REGISTRY.footer.variantes?.canonica, 'franjas');
});

test('DEFAULTS.footer.variante es la canónica', () => {
  assert.equal(DEFAULTS.footer.variante, REGISTRY.footer.variantes?.canonica);
});

// ── SIN FILA GUARDADA, EL RESOLVER DA BYTE-IDÉNTICO ─────────────────────────────────────────────

test('resolverSiteContent sin stored: footer resuelve EXACTO a DEFAULTS.footer (byte-idéntico sin fila)', () => {
  const out = resolverSiteContent(undefined);
  assert.deepEqual(out.footer, DEFAULTS.footer);
});

test('resolverSiteContent con un stored vacío: igual, byte-idéntico', () => {
  const out = resolverSiteContent({});
  assert.deepEqual(out.footer, DEFAULTS.footer);
});

// ── EL FILTRADO POR PÁGINA VISIBLE SIGUE VIVO (lógica, no dato) ─────────────────────────────────

function contentCon(overrides: Partial<{ suscripciones: boolean; nosotros: boolean; faq: boolean }>): SiteContentData {
  const base = resolverSiteContent(undefined);
  return {
    ...base,
    paginas: {
      nosotros: { visible: overrides.nosotros ?? true },
      suscripciones: { visible: overrides.suscripciones ?? true },
    },
    suscripcionFaq: {
      ...base.suscripcionFaq,
      items: overrides.faq === false ? [] : [{ question: 'q', answer: 'a' }],
    },
  };
}

test('columnasDeFooter con las tres páginas encendidas: las tres columnas, iguales a HOY', () => {
  const cols = columnasDeFooter(contentCon({}));
  assert.deepEqual(cols, COLUMNAS_HOY);
});

test('columnasDeFooter con suscripciones apagada: la columna Tienda pierde ese enlace, no queda vacía', () => {
  const cols = columnasDeFooter(contentCon({ suscripciones: false }));
  assert.deepEqual(cols.tienda, [{ label: 'Todos los productos', href: '/tienda' }]);
});

test('columnasDeFooter con la FAQ vacía (faqSuscripcionesVisible=false): Ayuda pierde ese enlace, no queda vacía', () => {
  const cols = columnasDeFooter(contentCon({ faq: false }));
  assert.deepEqual(cols.ayuda, [{ label: 'Rastrear Pedido', href: '/rastrear-pedido' }]);
});

test('columnasDeFooter con /nosotros apagada: Empresa SÍ puede quedar vacía (su único enlace es condicional)', () => {
  const cols = columnasDeFooter(contentCon({ nosotros: false }));
  assert.deepEqual(cols.empresa, []);
});

test('columnasDeFooter: ninguna de las columnas Tienda/Ayuda queda vacía nunca — cada una tiene un enlace incondicional', () => {
  const cols = columnasDeFooter(contentCon({ suscripciones: false, nosotros: false, faq: false }));
  assert.ok(cols.tienda.length >= 1);
  assert.ok(cols.ayuda.length >= 1);
});

// ── LA TARJETA DE IMAGEN OPCIONAL (§ MUESTRARIO-FOOTER-TARJETA-IMAGEN-1) ────────────────────────
// En el muestrario es el mapa con marcador; NO es una integración de mapas (Google Maps/Mapbox/un
// iframe serían un SERVICIO EXTERNO) — es una imagen que el dueño SUBE, como cualquier otra foto
// del sitio. Cierra la última pieza CONSTRUIBLE de MUESTRARIO-FOOTER-TEMA-1 (el newsletter queda
// pendiente de una decisión de producto del owner — requiere modelo, endpoint y registro de
// consentimiento, es FEATURE no tema).

test('REGISTRY.footer.imagenes nombra `tarjetaImagen` — si no, el borrado de blobs (imagenesDe) la pierde en silencio', () => {
  assert.deepEqual(REGISTRY.footer.imagenes, ['tarjetaImagen']);
});

test('REGISTRY.footer.campos: tarjetaImagen/tarjetaTexto son OPCIONALES (vacía = sin tarjeta, no un default fabricado)', () => {
  assert.equal(REGISTRY.footer.campos.tarjetaImagen, 'opcional');
  assert.equal(REGISTRY.footer.campos.tarjetaTexto, 'opcional');
});

test('DEFAULTS.footer.tarjetaImagen/.tarjetaTexto nacen VACÍOS (byte-idéntico para Nayoli)', () => {
  assert.equal(DEFAULTS.footer.tarjetaImagen, '');
  assert.equal(DEFAULTS.footer.tarjetaTexto, '');
});

test('footer.tarjetaImagen/.tarjetaTexto tienen CONTROL de panel (sin exención en PENDIENTE_PANEL)', () => {
  const controlados = camposControladosPorPanel();
  assert.ok(controlados.includes('footer.tarjetaImagen'));
  assert.ok(controlados.includes('footer.tarjetaTexto'));
});

// ── EL RENDER — SIN tarjeta: el pie de hoy, byte-idéntico (las DOS variantes) ───────────────────

test('SIN tarjetaImagen, variante "apilado" (DEFAULTS): sin <img> ni pie de foto de la tarjeta', () => {
  const content = { ...DEFAULTS, footer: { ...DEFAULTS.footer, variante: 'apilado' } } as SiteContentData;
  const html = renderFooter(content);
  assert.ok(!/data-nimg/.test(html), 'sin tarjetaImagen, next/image no debe montar ningún <img> de tarjeta');
});

test('SIN tarjetaImagen, variante "franjas" (la canónica, Nayoli): igual que siempre — sin <img> de tarjeta', () => {
  const html = renderFooter(DEFAULTS as unknown as SiteContentData);
  assert.ok(!/data-nimg/.test(html), 'la canónica nunca monta una imagen next/image de tarjeta');
});

// ── EL RENDER — CON tarjeta: SÓLO la variante "apilado" la muestra ──────────────────────────────

test('CON tarjetaImagen + tarjetaTexto, variante "apilado": rinde el <img> a sangre completa + el pie de texto', () => {
  const content = {
    ...DEFAULTS,
    footer: { ...DEFAULTS.footer, variante: 'apilado', tarjetaImagen: '/images/historia-4-v1.jpg', tarjetaTexto: 'San Adolfo, Huila' },
  } as SiteContentData;
  const html = renderFooter(content);
  // next/image reescribe el src a través de `/_next/image?url=...`; la ruta original sobrevive
  // url-encoded dentro de esa query.
  assert.ok(html.includes('url=%2Fimages%2Fhistoria-4-v1.jpg'), 'la tarjeta debe rendir el src de la imagen');
  assert.ok(html.includes('data-nimg="fill"'), 'la imagen debe usar `fill` — a sangre completa, no un tamaño fijo');
  assert.ok(html.includes('San Adolfo, Huila'), 'el pie de texto debe rendir');
});

test('CON tarjetaImagen, variante "franjas" (la canónica, Nayoli): NO rinde la tarjeta aunque el dato exista', () => {
  const content = {
    ...DEFAULTS,
    footer: { ...DEFAULTS.footer, variante: 'franjas', tarjetaImagen: '/images/historia-4-v1.jpg', tarjetaTexto: 'San Adolfo, Huila' },
  } as SiteContentData;
  const html = renderFooter(content);
  assert.ok(!/data-nimg/.test(html), 'la canónica no debe montar la imagen aunque tarjetaImagen tenga valor');
  assert.ok(!html.includes('San Adolfo, Huila'), 'la canónica no debe rendir el pie de texto aunque tarjetaTexto tenga valor');
});

test('CON tarjetaImagen SIN tarjetaTexto, variante "apilado": la imagen rinde, el pie de texto NO', () => {
  const content = {
    ...DEFAULTS,
    footer: { ...DEFAULTS.footer, variante: 'apilado', tarjetaImagen: '/images/historia-4-v1.jpg', tarjetaTexto: '' },
  } as SiteContentData;
  const html = renderFooter(content);
  assert.ok(/data-nimg/.test(html), 'con imagen, la imagen debe rendir aunque no haya pie de texto');
});

test('SIN tarjetaImagen, con tarjetaTexto SOLO ("apilado"): NO rinde — un pie de texto sin imagen no se muestra', () => {
  const content = {
    ...DEFAULTS,
    footer: { ...DEFAULTS.footer, variante: 'apilado', tarjetaImagen: '', tarjetaTexto: 'San Adolfo, Huila' },
  } as SiteContentData;
  const html = renderFooter(content);
  assert.ok(!/data-nimg/.test(html), 'sin imagen, no debe montarse ninguna imagen de tarjeta');
  assert.ok(!html.includes('San Adolfo, Huila'), 'un pie de texto sin imagen no debe rendir solo');
});

// ── LA CANÓNICA NO IMPORTA NI LEE LOS CAMPOS DE LA TARJETA EN ABSOLUTO ──────────────────────────
// Mismo patrón que `SubscriptionCTABloque` no lee `imagenFondo` (§ cta-banner-foto.test.ts): no hay
// un flag que consultar para "no mostrarla" — el código de la canónica simplemente no los nombra.
// `FooterColumnas` (no exportado) vive en el MISMO archivo que `FooterApilado`; el grep se acota a
// la función, no al archivo entero, para no dar un falso verde por la mención en `FooterApilado`.

test('FooterColumnas (la canónica) NO referencia tarjetaImagen/tarjetaTexto en su propio cuerpo', () => {
  const footerPath = path.join(fileURLToPath(new URL('.', import.meta.url)), '../../components/storefront/StoreFooter.tsx');
  const src = readFileSync(footerPath, 'utf8');
  const inicio = src.indexOf('function FooterColumnas');
  const fin = src.indexOf("\n// VARIANTE 'apilado'");
  assert.ok(inicio > -1 && fin > inicio, 'no se pudo acotar el cuerpo de FooterColumnas en StoreFooter.tsx');
  const cuerpo = src.slice(inicio, fin);
  assert.ok(!cuerpo.includes('tarjetaImagen'));
  assert.ok(!cuerpo.includes('tarjetaTexto'));
});
