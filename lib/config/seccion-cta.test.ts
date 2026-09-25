import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULTS,
  REGISTRY,
  resolverSiteContent,
  resolverCtaSeccion,
  menuCtaHref,
  MENU_CTA_DESTINOS,
  type PaginasContent,
} from '@/lib/config/site-content-defaults';
import { siteContentEditableSchema } from '@/lib/config/site-content-schema';
import { SECCIONES_TIENDA } from '@/components/admin/tienda-secciones';
import { bloquesResueltos } from '@/lib/tienda/bloques';

// § MUESTRARIO-SECCION-CTA-1 — LA CAPACIDAD GENERAL: cualquier sección de contenido puede declarar
// su PROPIO botón opcional (etiqueta + destino de un SET CERRADO), no sólo hero/subscriptionCTA.
// `resolverCtaSeccion` es el resolvedor ÚNICO (`menuCtaHref` es hoy su primer caso particular);
// `presentaciones`/`brandStory` ganan un CTA de cabecera-o-cierre, y `subscriptionCTA` gana un
// SEGUNDO CTA (el primero, `ctaLabel`, sigue con href fijo a `/suscripciones`, sin cambio).

const PAGINAS_TODO_ENCENDIDO: PaginasContent = {
  nosotros: { visible: true },
  suscripciones: { visible: true },
};

// ── resolverCtaSeccion — el resolvedor puro, preferir callar a un link roto ─────────────────────

test('resolverCtaSeccion: label vacío → null, sin importar el destino', () => {
  assert.equal(resolverCtaSeccion('', '/tienda', PAGINAS_TODO_ENCENDIDO), null);
  assert.equal(resolverCtaSeccion('   ', '/tienda', PAGINAS_TODO_ENCENDIDO), null);
});

test('resolverCtaSeccion: label con destino vacío (CTA a medio configurar) → null', () => {
  assert.equal(resolverCtaSeccion('Comprar', '', PAGINAS_TODO_ENCENDIDO), null);
});

test('resolverCtaSeccion: label + destino del set cerrado → el href, para los TRES destinos', () => {
  for (const destino of MENU_CTA_DESTINOS) {
    assert.equal(resolverCtaSeccion('Ir', destino, PAGINAS_TODO_ENCENDIDO), destino);
  }
});

test('resolverCtaSeccion: destino FUERA del set cerrado (basura llegada por otra vía) → null, nunca un link roto', () => {
  assert.equal(resolverCtaSeccion('Comprar', 'https://wa.me/1234567890', PAGINAS_TODO_ENCENDIDO), null);
  assert.equal(resolverCtaSeccion('Comprar', '/checkout', PAGINAS_TODO_ENCENDIDO), null);
  assert.equal(resolverCtaSeccion('Comprar', '#origen', PAGINAS_TODO_ENCENDIDO), null);
});

test('resolverCtaSeccion: destino a una página APAGADA (suscripciones) → null aunque esté en el set cerrado', () => {
  const paginas: PaginasContent = { ...PAGINAS_TODO_ENCENDIDO, suscripciones: { visible: false } };
  assert.equal(resolverCtaSeccion('Suscríbete', '/suscripciones', paginas), null);
});

test('resolverCtaSeccion: destino a una página APAGADA (nosotros) → null', () => {
  const paginas: PaginasContent = { ...PAGINAS_TODO_ENCENDIDO, nosotros: { visible: false } };
  assert.equal(resolverCtaSeccion('Conócenos', '/nosotros', paginas), null);
});

test('resolverCtaSeccion: /tienda no tiene gate de página — sigue mostrándose con las otras dos apagadas', () => {
  const paginas: PaginasContent = { nosotros: { visible: false }, suscripciones: { visible: false } };
  assert.equal(resolverCtaSeccion('Comprar', '/tienda', paginas), '/tienda');
});

test('menuCtaHref sigue siendo un caso particular de resolverCtaSeccion, sin cambio de comportamiento', () => {
  const content = { ...DEFAULTS, menu: { ...DEFAULTS.menu, ctaLabel: 'Escríbenos', ctaDestino: '/tienda' } };
  assert.equal(menuCtaHref(content), resolverCtaSeccion(content.menu.ctaLabel, content.menu.ctaDestino, content.paginas));
  assert.equal(menuCtaHref(content), '/tienda');
});

// ── DEFAULTS/REGISTRY — vacío = sin botón, byte-idéntico ────────────────────────────────────────

test('DEFAULTS.presentaciones: el CTA de cabecera nace VACÍO (sin botón, byte-idéntico)', () => {
  assert.equal(DEFAULTS.presentaciones.ctaLabel, '');
  assert.equal(DEFAULTS.presentaciones.ctaDestino, '');
});

test('DEFAULTS.brandStory: el CTA de cierre nace VACÍO (sin botón, byte-idéntico)', () => {
  assert.equal(DEFAULTS.brandStory.ctaLabel, '');
  assert.equal(DEFAULTS.brandStory.ctaDestino, '');
});

test('DEFAULTS.subscriptionCTA: el SEGUNDO cta nace VACÍO; el PRIMERO (ctaLabel) no se tocó', () => {
  assert.equal(DEFAULTS.subscriptionCTA.ctaSecundarioLabel, '');
  assert.equal(DEFAULTS.subscriptionCTA.ctaSecundarioDestino, '');
  assert.equal(DEFAULTS.subscriptionCTA.ctaLabel, 'Ver los planes'); // sin cambio
});

test('REGISTRY: los tres campos del CTA de Presentaciones/Historia declarados OPCIONALES', () => {
  assert.equal(REGISTRY.presentaciones.campos.ctaLabel, 'opcional');
  assert.equal(REGISTRY.presentaciones.campos.ctaDestino, 'opcional');
  assert.equal(REGISTRY.brandStory.campos.ctaLabel, 'opcional');
  assert.equal(REGISTRY.brandStory.campos.ctaDestino, 'opcional');
});

test('REGISTRY.subscriptionCTA: el SEGUNDO cta declarado OPCIONAL; el primero sigue REQUERIDO, sin cambio', () => {
  assert.equal(REGISTRY.subscriptionCTA.campos.ctaSecundarioLabel, 'opcional');
  assert.equal(REGISTRY.subscriptionCTA.campos.ctaSecundarioDestino, 'opcional');
  assert.equal(REGISTRY.subscriptionCTA.campos.ctaLabel, 'requerido');
});

// ── resolverSiteContent — sin fila, sin botón; editando, el botón declarado ─────────────────────

test('resolverSiteContent({}): sin fila, ningún CTA de sección rinde botón (byte-idéntico a Nayoli)', () => {
  const r = resolverSiteContent({});
  assert.equal(resolverCtaSeccion(r.presentaciones.ctaLabel, r.presentaciones.ctaDestino, r.paginas), null);
  assert.equal(resolverCtaSeccion(r.brandStory.ctaLabel, r.brandStory.ctaDestino, r.paginas), null);
  assert.equal(resolverCtaSeccion(r.subscriptionCTA.ctaSecundarioLabel, r.subscriptionCTA.ctaSecundarioDestino, r.paginas), null);
});

test('resolverSiteContent: presentaciones con ctaLabel+ctaDestino editados → el CTA resuelve', () => {
  const r = resolverSiteContent({ presentaciones: { ctaLabel: 'Comprar', ctaDestino: '/tienda' } });
  assert.equal(r.presentaciones.ctaLabel, 'Comprar');
  assert.equal(resolverCtaSeccion(r.presentaciones.ctaLabel, r.presentaciones.ctaDestino, r.paginas), '/tienda');
});

test('resolverSiteContent: brandStory con ctaLabel+ctaDestino editados → el CTA resuelve', () => {
  const r = resolverSiteContent({ brandStory: { ctaLabel: 'Nuestra historia', ctaDestino: '/nosotros' } });
  assert.equal(resolverCtaSeccion(r.brandStory.ctaLabel, r.brandStory.ctaDestino, r.paginas), '/nosotros');
});

test('resolverSiteContent: subscriptionCTA con el SEGUNDO cta editado → resuelve; el primero no se afecta', () => {
  const r = resolverSiteContent({ subscriptionCTA: { ctaSecundarioLabel: 'Explorar', ctaSecundarioDestino: '/tienda' } });
  assert.equal(resolverCtaSeccion(r.subscriptionCTA.ctaSecundarioLabel, r.subscriptionCTA.ctaSecundarioDestino, r.paginas), '/tienda');
  assert.equal(r.subscriptionCTA.ctaLabel, 'Ver los planes');
});

// ── El schema editable — DESTINO sobre el SET CERRADO, mismo criterio que menuEditableSchema ────

test('presentaciones: ctaLabel/ctaDestino válidos sobreviven al parse', () => {
  const parsed = siteContentEditableSchema.parse({ presentaciones: { ctaLabel: 'Comprar', ctaDestino: '/tienda' } });
  assert.deepEqual(parsed.presentaciones, { ctaLabel: 'Comprar', ctaDestino: '/tienda' });
});

test('presentaciones: ctaDestino vacío ("") sobrevive — es el estado "CTA apagado"', () => {
  const parsed = siteContentEditableSchema.parse({ presentaciones: { ctaDestino: '' } });
  assert.equal(parsed.presentaciones!.ctaDestino, '');
});

test('presentaciones: un ctaDestino fuera del set cerrado se rechaza', () => {
  assert.throws(() => siteContentEditableSchema.parse({ presentaciones: { ctaDestino: 'https://wa.me/1234567890' } }));
  assert.throws(() => siteContentEditableSchema.parse({ presentaciones: { ctaDestino: '#origen' } }));
});

test('brandStory: ctaLabel/ctaDestino válidos sobreviven; fuera del set se rechaza', () => {
  const parsed = siteContentEditableSchema.parse({ brandStory: { ctaLabel: 'Nuestra historia', ctaDestino: '/nosotros' } });
  assert.deepEqual(parsed.brandStory, { ctaLabel: 'Nuestra historia', ctaDestino: '/nosotros' });
  assert.throws(() => siteContentEditableSchema.parse({ brandStory: { ctaDestino: 'producto.html' } }));
});

test('subscriptionCTA: el SEGUNDO cta válido sobrevive; fuera del set se rechaza; el primero no cambió de forma', () => {
  const parsed = siteContentEditableSchema.parse({
    subscriptionCTA: { ctaLabel: 'Ver los planes', ctaSecundarioLabel: 'Explorar', ctaSecundarioDestino: '/tienda' },
  });
  assert.deepEqual(parsed.subscriptionCTA, { ctaLabel: 'Ver los planes', ctaSecundarioLabel: 'Explorar', ctaSecundarioDestino: '/tienda' });
  assert.throws(() => siteContentEditableSchema.parse({ subscriptionCTA: { ctaSecundarioDestino: 'producto.html' } }));
});

// ── El control de panel — declarado Y RENDERIZADO (no sólo presente en config.campos) ───────────
// § el REGLA PERMANENTE del spec de este slice: un campo en `SeccionConfig.campos` que no aparece
// TAMBIÉN en un `bloques[]` se cuenta como "controlado" por el chequeo derivado (panel-controles.ts)
// pero NUNCA se renderiza en el editor — verificar sólo `config.campos` no basta.

function seccion(v: 'presentaciones' | 'brandStory' | 'subscriptionCTA') {
  const config = SECCIONES_TIENDA.find((s) => s.seccion === v);
  assert.ok(config, `${v} no está en SECCIONES_TIENDA`);
  return config!;
}

test('presentaciones: ctaLabel/ctaDestino están en config.campos Y en un bloque resuelto', () => {
  const config = seccion('presentaciones');
  const nombres = config.campos.map((c) => c.name);
  assert.ok(nombres.includes('ctaLabel'));
  assert.ok(nombres.includes('ctaDestino'));
  const bloques = bloquesResueltos(config);
  const enUnBloque = bloques.some((b) => b.tipo === 'seccion' && b.campos.some((c) => c.name === 'ctaLabel'))
    && bloques.some((b) => b.tipo === 'seccion' && b.campos.some((c) => c.name === 'ctaDestino'));
  assert.ok(enUnBloque, 'ctaLabel/ctaDestino declarados pero ausentes de todo bloque resuelto — no se renderizarían');
});

test('presentaciones: ctaDestino es un SELECT sobre el set cerrado, no texto libre', () => {
  const config = seccion('presentaciones');
  const campo = config.campos.find((c) => c.name === 'ctaDestino');
  assert.ok(campo?.opciones, 'ctaDestino debe declarar `opciones` (select nativo)');
  const valores = campo!.opciones!.map((o) => o.value);
  assert.deepEqual(valores, ['', ...MENU_CTA_DESTINOS]);
});

test('brandStory: ctaLabel/ctaDestino están en config.campos Y en un bloque resuelto', () => {
  const config = seccion('brandStory');
  const nombres = config.campos.map((c) => c.name);
  assert.ok(nombres.includes('ctaLabel'));
  assert.ok(nombres.includes('ctaDestino'));
  const bloques = bloquesResueltos(config);
  const enUnBloque = bloques.some((b) => b.tipo === 'seccion' && b.campos.some((c) => c.name === 'ctaLabel'))
    && bloques.some((b) => b.tipo === 'seccion' && b.campos.some((c) => c.name === 'ctaDestino'));
  assert.ok(enUnBloque, 'ctaLabel/ctaDestino declarados pero ausentes de todo bloque resuelto — no se renderizarían');
});

test('subscriptionCTA: el SEGUNDO cta está en config.campos Y en un bloque resuelto; el primero no se movió', () => {
  const config = seccion('subscriptionCTA');
  const nombres = config.campos.map((c) => c.name);
  assert.ok(nombres.includes('ctaSecundarioLabel'));
  assert.ok(nombres.includes('ctaSecundarioDestino'));
  assert.ok(nombres.includes('ctaLabel'));
  const bloques = bloquesResueltos(config);
  const enUnBloque = bloques.some((b) => b.tipo === 'seccion' && b.campos.some((c) => c.name === 'ctaSecundarioLabel'))
    && bloques.some((b) => b.tipo === 'seccion' && b.campos.some((c) => c.name === 'ctaSecundarioDestino'));
  assert.ok(enUnBloque, 'ctaSecundarioLabel/ctaSecundarioDestino declarados pero ausentes de todo bloque resuelto');
});
