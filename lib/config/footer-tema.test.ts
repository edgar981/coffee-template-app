import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULTS,
  REGISTRY,
  BANDA_IDS,
  resolverSiteContent,
  columnasDeFooter,
  type SiteContentData,
  type FooterContent,
} from './site-content-defaults';

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
  items: [],
};

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
