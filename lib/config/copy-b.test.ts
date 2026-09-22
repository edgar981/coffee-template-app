import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import TrustBadges from '@/components/storefront/home/TrustBadges';
import NavSearch from '@/components/storefront/layout/NavSearch';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { DEFAULTS, resolverSiteContent } from '@/lib/config/site-content-defaults';
import {
  COPY_NAYOLI,
  mergeCopyNayoliEnContent,
  confirmacionValida,
  conexionVisible,
} from '@/prisma/sembrar-copy-nayoli';

// § CONTENIDO-CAFE-A-DATO-B-1 (opción B, owner 2026-09-21). La invariante que este archivo prueba:
//
//   1. Con los campos en su DEFAULT (sin fila / sin dato) los componentes rinden el copy NEUTRO.
//   2. Con el dato café PUESTO (simulando el post-sembrado: `mergeCopyNayoliEnContent({})` pasado
//      por `resolverSiteContent`, la MISMA función que usa el layout real) rinden el café de hoy,
//      byte por byte.
//
// La byte-identidad REAL de Nayoli la da el SEMBRADO —paso del owner, § prisma/sembrar-copy-
// nayoli.ts—, no este test: acá se simula el estado post-sembrado en memoria, nunca se toca una
// base ni un archivo de entorno.
//
// ALCANCE declarado: se renderiza EN MEMORIA (`renderToStaticMarkup`, sin jsdom) lo que es seguro
// de renderizar sin un mock de router de Next — `TrustBadges` (sin dependencias de Next) y
// `NavSearch` (su único prop de visibilidad, `isOpen`, es EXTERNO; no usa `useSearchParams`). Las
// otras TRES superficies (`/tienda`, `/rastrear-pedido`, `CartDrawer`) usan `useSearchParams()` o
// estado interno de contexto no inyectable desde afuera (`CartProvider.isOpen`) — renderizarlas
// bare exigiría un mock del router de Next que ninguna prueba de este repo instala hoy (el
// precedente, `lib/storefront/planes-suscripcion-componente.test.ts`, tampoco lo hace). Para esas
// tres, la invariante se prueba en la CAPA DE DATOS (`resolverSiteContent`/`resolverMicrocopy`,
// deep-equal contra los DEFAULTS neutros y contra `COPY_NAYOLI`) — la interpolación en el JSX de
// esos tres archivos es DIRECTA (`{microcopy.campo}` / `placeholder={microcopy.campo}`, sin lógica
// más que el condicional de `tiendaSubtitulo`, verificado aparte abajo), así que la data es lo que
// determina el byte renderizado. Limitación NOMBRADA, no omitida.

const TERMINOS_PROHIBIDOS = /caf[eé]|nayoli|supat[aá]|cundinamarca|\bgrano|molid|tueste|tosta|finca|cafetal|greca|tanda|elaborad|prepara|fresco|material|artesanal/i;

function walkStrings(v: unknown, out: string[]): void {
  if (typeof v === 'string') { out.push(v); return; }
  if (v === null || typeof v !== 'object') return;
  if (Array.isArray(v)) { v.forEach((x) => walkStrings(x, out)); return; }
  for (const k of Object.keys(v)) walkStrings((v as Record<string, unknown>)[k], out);
}

test('TERMINOS_PROHIBIDOS: DEFAULTS.trustBadges y DEFAULTS.microcopy son NEUTROS (sin café, sin Nayoli)', () => {
  const valores: string[] = [];
  walkStrings(DEFAULTS.trustBadges, valores);
  walkStrings(DEFAULTS.microcopy, valores);
  const ofensores = valores.filter((v) => TERMINOS_PROHIBIDOS.test(v));
  assert.deepEqual(ofensores, [], `campos con café/Nayoli en el default neutro: ${ofensores.join(', ')}`);
});

// ─── LA CAPA DE DATOS: resolverSiteContent, sin fila / con el sembrado simulado ───────────────────

test('resolverSiteContent SIN dato (sin fila): trustBadges y microcopy caen al DEFAULT NEUTRO', () => {
  const content = resolverSiteContent(undefined);
  assert.deepEqual(content.trustBadges, DEFAULTS.trustBadges);
  assert.deepEqual(content.microcopy, DEFAULTS.microcopy);
});

test('resolverSiteContent CON el sembrado simulado (mergeCopyNayoliEnContent({})): trustBadges y microcopy son el café de Nayoli, byte a byte', () => {
  const sembrado = mergeCopyNayoliEnContent({});
  const content = resolverSiteContent(sembrado);
  assert.deepEqual(content.trustBadges, { visible: true, ...COPY_NAYOLI.trustBadges });
  assert.deepEqual(content.microcopy, COPY_NAYOLI.microcopy);
});

// ─── RENDER EN MEMORIA: TrustBadges (sin provider — su content llega por PROP, § el componente) ──

test('COMPONENTE TrustBadges: sin `content` (el caso de PaletaSeccion, admin, fuera del árbol del storefront) cae al DEFAULT NEUTRO', () => {
  const html = renderToStaticMarkup(React.createElement(TrustBadges));
  for (const texto of Object.values(DEFAULTS.trustBadges)) {
    if (typeof texto === 'string') assert.ok(html.includes(texto), `falta "${texto}" en el render neutro`);
  }
  assert.ok(!TERMINOS_PROHIBIDOS.test(html.replace(/<[^>]+>/g, ' ')), 'el render neutro no debe mencionar café/Nayoli');
});

test('COMPONENTE TrustBadges: con el `content` del sembrado simulado, rinde el café de Nayoli byte a byte, en el orden de los 4 íconos', () => {
  const content = resolverSiteContent(mergeCopyNayoliEnContent({})).trustBadges;
  const html = renderToStaticMarkup(React.createElement(TrustBadges, { content }));
  assert.ok(html.includes('Origen 100% colombiano'));
  assert.ok(html.includes('Tostado artesanal semanal'));
  assert.ok(html.includes('Envío a todo el país'));
  assert.ok(html.includes('Garantía de frescura'));
  // orden: badge1..4 aparecen en el mismo orden que los íconos Leaf/Coffee/Truck/Shield
  const i1 = html.indexOf('Origen 100% colombiano');
  const i2 = html.indexOf('Tostado artesanal semanal');
  const i3 = html.indexOf('Envío a todo el país');
  const i4 = html.indexOf('Garantía de frescura');
  assert.ok(i1 < i2 && i2 < i3 && i3 < i4, 'las 4 franjas deben aparecer en orden badge1→badge2→badge3→badge4');
});

// ─── RENDER EN MEMORIA: NavSearch (dentro de SiteContentProvider — `isOpen` es prop externa) ──────

function renderNavSearch(content: ReturnType<typeof resolverSiteContent>): string {
  return renderToStaticMarkup(
    React.createElement(SiteContentProvider, {
      value: content,
      children: React.createElement(NavSearch, { isOpen: true, onClose: () => {} }),
    }),
  );
}

test('COMPONENTE NavSearch: SIN sembrado, el placeholder del buscador es NEUTRO', () => {
  const html = renderNavSearch(resolverSiteContent(undefined));
  assert.ok(html.includes('placeholder="Buscar productos, categoría..."'));
  assert.ok(!html.includes('Buscar café'));
});

test('COMPONENTE NavSearch: CON el sembrado simulado, el placeholder es el de Nayoli, byte a byte', () => {
  const html = renderNavSearch(resolverSiteContent(mergeCopyNayoliEnContent({})));
  assert.ok(html.includes('placeholder="Buscar café, origen, categoría..."'));
});

// ─── LA REPRODUCCIÓN de la interpolación de /tienda (§ ALCANCE, arriba) — no es el render real de
// la página (usa `useSearchParams()`, no renderizable bare sin mock del router); es la MISMA
// expresión que `app/(storefront)/tienda/page.tsx` usa para componer el subtítulo, copiada acá
// para afirmar su comportamiento — se verifica de nuevo contra la fuente en el gate visual.
const renderSubtituloTienda = (conteo: string, tiendaSubtitulo: string): string =>
  `${conteo}${tiendaSubtitulo ? ` · ${tiendaSubtitulo}` : ''}`;

test('/tienda (reproducción de la expresión): subtítulo NEUTRO vacío → SIN "· " colgando', () => {
  assert.equal(renderSubtituloTienda('12 productos', DEFAULTS.microcopy.tiendaSubtitulo), '12 productos');
});

test('/tienda (reproducción de la expresión): con el sembrado, el subtítulo es "· Origen colombiano" byte a byte, como hoy', () => {
  assert.equal(
    renderSubtituloTienda('12 productos', COPY_NAYOLI.microcopy.tiendaSubtitulo),
    '12 productos · Origen colombiano',
  );
});

// ─── EL SEMBRADO: la guarda de confirmación (pura) ─────────────────────────────────────────────

test('sembrado: confirmacionValida — coincidencia EXACTA confirma (recorta sólo bordes)', () => {
  assert.equal(confirmacionValida('Café Nayoli', 'Café Nayoli'), true);
  assert.equal(confirmacionValida('Café Nayoli', '  Café Nayoli  '), true);
});

test('sembrado: confirmacionValida — CUALQUIER otra cosa NO confirma (no escribe)', () => {
  assert.equal(confirmacionValida('Café Nayoli', 'otro nombre'), false);
  assert.equal(confirmacionValida('Café Nayoli', ''), false);
  assert.equal(confirmacionValida('Café Nayoli', '   '), false);
  assert.equal(confirmacionValida('Café Nayoli', 'y'), false);
  assert.equal(confirmacionValida('Café Nayoli', 's'), false);
  assert.equal(confirmacionValida('Café Nayoli', undefined), false);
  assert.equal(confirmacionValida('Café Nayoli', null), false);
  assert.equal(confirmacionValida('Café Nayoli', 'café nayoli'), false, 'el case importa: no es case-insensitive');
});

test('sembrado: conexionVisible extrae host/base y NUNCA credenciales', () => {
  const c = conexionVisible('postgresql://user:secreto123@ep-ejemplo.aws.neon.tech/neondb?sslmode=require');
  assert.deepEqual(c, { host: 'ep-ejemplo.aws.neon.tech', base: 'neondb' });
  assert.deepEqual(Object.keys(c!), ['host', 'base']);
  assert.ok(!JSON.stringify(c).includes('secreto123'));
});

test('sembrado: conexionVisible devuelve null ante una cadena ilegible (nunca imprime el valor crudo)', () => {
  assert.equal(conexionVisible('esto no es una URL'), null);
});

// ─── EL SEMBRADO: IDEMPOTENTE (dos aplicaciones = mismo estado) ────────────────────────────────

test('sembrado: mergeCopyNayoliEnContent es IDEMPOTENTE — aplicarlo dos veces da el MISMO content', () => {
  const una = mergeCopyNayoliEnContent({});
  const dos = mergeCopyNayoliEnContent(una);
  assert.deepEqual(dos, una);
  assert.deepEqual(una.trustBadges, COPY_NAYOLI.trustBadges);
  assert.deepEqual(una.microcopy, COPY_NAYOLI.microcopy);
});

test('sembrado: mergeCopyNayoliEnContent PRESERVA cualquier otra sección/campo de `content` (merge quirúrgico, no reemplazo)', () => {
  const previo = { hero: { titulo: 'Custom del cliente' }, trustBadges: { visible: false, badge1: 'algo viejo' } };
  const nuevo = mergeCopyNayoliEnContent(previo);
  assert.deepEqual(nuevo.hero, { titulo: 'Custom del cliente' }, 'otras secciones quedan intactas');
  assert.equal((nuevo.trustBadges as { visible: boolean }).visible, false, 'campos no-café de la sección se preservan');
  assert.deepEqual(nuevo.trustBadges, { visible: false, ...COPY_NAYOLI.trustBadges }, 'sólo los 4 textos se pisan');
});
