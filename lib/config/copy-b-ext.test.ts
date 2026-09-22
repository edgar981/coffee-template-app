import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Leaf, Coffee, Truck, Shield, RotateCcw, CheckCircle, BadgeCheck } from 'lucide-react';

import TrustBadges from '@/components/storefront/home/TrustBadges';
import { iconoBadge, NOMBRES_ICONO_BADGE } from '@/components/storefront/badge-iconos';
import { DEFAULTS, resolverSiteContent } from '@/lib/config/site-content-defaults';
import { COPY_NAYOLI, mergeCopyNayoliEnContent } from '@/prisma/sembrar-copy-nayoli';

// § CONTENIDO-CAFE-A-DATO-B-EXT-1 (owner, 2026-09-22). Extiende `copy-b.test.ts` (NO lo reemplaza:
// ese archivo sigue probando las cinco superficies de B-1 sin cambios) con los DOS últimos reductos
// café que quedaban fuera —cierra `CONTENIDO-CAFE-TIENDA-SLUG-TRUSTBADGES-1` y `CONTENIDO-CAFE-
// ICONO-COFFEE-1`, los dos open follow-ups de B-1—:
//
//   (A) `productoBadges` — los TRES badges de la ficha de producto, antes un array literal aparte
//       en `[slug]/page.tsx`, ahora sección DATO gemela de `trustBadges`.
//   (B) EL ÍCONO como DATO en las DOS superficies — `badgeNIcono`, un NOMBRE de un set cerrado
//       (`components/storefront/badge-iconos.ts`), no un componente lucide hardcodeado por posición.
//
// La MISMA invariante que B-1, ahora sobre las dos superficies nuevas:
//   1. Con los campos en su DEFAULT (sin fila / sin dato) el texto Y el ÍCONO son NEUTROS.
//   2. Con el dato café puesto (`mergeCopyNayoliEnContent({})`, la MISMA función que usa el sembrado
//      real) el texto Y el ÍCONO son los de Nayoli, byte por byte.
//
// La byte-identidad REAL de Nayoli la da el SEMBRADO (paso del owner, § prisma/sembrar-copy-
// nayoli.ts) — acá se simula el estado post-sembrado EN MEMORIA (`renderToStaticMarkup`, sin jsdom),
// nunca se toca una base ni un archivo de entorno.

const TERMINOS_PROHIBIDOS = /caf[eé]|nayoli|supat[aá]|cundinamarca|\bgrano|molid|tueste|tosta|finca|cafetal|greca|tanda|elaborad|prepara|fresco|material|artesanal/i;

function walkStrings(v: unknown, out: string[]): void {
  if (typeof v === 'string') { out.push(v); return; }
  if (v === null || typeof v !== 'object') return;
  if (Array.isArray(v)) { v.forEach((x) => walkStrings(x, out)); return; }
  for (const k of Object.keys(v)) walkStrings((v as Record<string, unknown>)[k], out);
}

test('TERMINOS_PROHIBIDOS: DEFAULTS.trustBadges (con íconos) y DEFAULTS.productoBadges son NEUTROS (sin café, sin Nayoli)', () => {
  const valores: string[] = [];
  walkStrings(DEFAULTS.trustBadges, valores);
  walkStrings(DEFAULTS.productoBadges, valores);
  const ofensores = valores.filter((v) => TERMINOS_PROHIBIDOS.test(v));
  assert.deepEqual(ofensores, [], `campos con café/Nayoli en el default neutro: ${ofensores.join(', ')}`);
});

// ─── EL SET CERRADO DE ÍCONOS — un nombre fuera del set cae al NEUTRO, nunca a error ─────────────

test('iconoBadge: cada NOMBRE del set cerrado resuelve al componente lucide correcto (mapa declarado UNA vez)', () => {
  assert.equal(iconoBadge('leaf'), Leaf);
  assert.equal(iconoBadge('coffee'), Coffee);
  assert.equal(iconoBadge('truck'), Truck);
  assert.equal(iconoBadge('shield'), Shield);
  assert.equal(iconoBadge('rotate'), RotateCcw);
  assert.equal(iconoBadge('check'), CheckCircle);
});

test('iconoBadge: el DEFAULT NEUTRO (`""`, el vacío de DEFAULTS) cae al ícono neutro, NUNCA a Coffee', () => {
  assert.equal(iconoBadge(''), BadgeCheck);
  assert.notEqual(iconoBadge(''), Coffee);
});

test('iconoBadge: un nombre FUERA del set (typo, basura, un ícono retirado) cae al neutro — no lanza, no hay error', () => {
  assert.equal(iconoBadge('taza-humeante'), BadgeCheck);
  assert.equal(iconoBadge('Coffee'), BadgeCheck); // el NOMBRE es 'coffee', no el nombre del componente
  assert.doesNotThrow(() => iconoBadge(undefined));
  assert.doesNotThrow(() => iconoBadge(null));
  assert.equal(iconoBadge(undefined), BadgeCheck);
  assert.equal(iconoBadge(null), BadgeCheck);
});

test('NOMBRES_ICONO_BADGE: el set cerrado son EXACTAMENTE los seis nombres que las dos superficies necesitan, ninguno más', () => {
  assert.deepEqual([...NOMBRES_ICONO_BADGE].sort(), ['check', 'coffee', 'leaf', 'rotate', 'shield', 'truck'].sort());
});

// ─── LA CAPA DE DATOS: resolverSiteContent, sin fila / con el sembrado simulado ───────────────────

test('resolverSiteContent SIN dato (sin fila): trustBadges y productoBadges caen al DEFAULT NEUTRO (texto e ícono)', () => {
  const content = resolverSiteContent(undefined);
  assert.deepEqual(content.trustBadges, DEFAULTS.trustBadges);
  assert.deepEqual(content.productoBadges, DEFAULTS.productoBadges);
  // El ícono NEUTRO explícito: los cuatro/tres badges resuelven a '' → iconoBadge('') → BadgeCheck.
  for (const icono of [content.trustBadges.badge1Icono, content.trustBadges.badge2Icono, content.trustBadges.badge3Icono, content.trustBadges.badge4Icono]) {
    assert.equal(icono, '');
  }
  for (const icono of [content.productoBadges.badge1Icono, content.productoBadges.badge2Icono, content.productoBadges.badge3Icono]) {
    assert.equal(icono, '');
  }
});

test('resolverSiteContent CON el sembrado simulado: trustBadges y productoBadges son el café de Nayoli, byte a byte (texto E ÍCONO)', () => {
  const sembrado = mergeCopyNayoliEnContent({});
  const content = resolverSiteContent(sembrado);
  assert.deepEqual(content.trustBadges, { visible: true, ...COPY_NAYOLI.trustBadges });
  assert.deepEqual(content.productoBadges, { visible: true, ...COPY_NAYOLI.productoBadges });
});

// ─── RENDER EN MEMORIA: TrustBadges — el ÍCONO efectivamente renderizado, no sólo el texto ────────

test('COMPONENTE TrustBadges: sin `content`, las CUATRO franjas rinden el ícono NEUTRO (badge-check), nunca `Coffee`', () => {
  const html = renderToStaticMarkup(React.createElement(TrustBadges));
  const apariciones = html.match(/lucide-[a-z-]+/g) ?? [];
  assert.deepEqual(apariciones, ['lucide-badge-check', 'lucide-badge-check', 'lucide-badge-check', 'lucide-badge-check']);
  assert.ok(!html.includes('lucide-coffee'), 'el default neutro no debe renderizar el ícono Coffee');
});

test('COMPONENTE TrustBadges: con el sembrado simulado, cada franja rinde SU ícono real de Nayoli, en orden badge1→4 (leaf, coffee, truck, shield)', () => {
  const content = resolverSiteContent(mergeCopyNayoliEnContent({})).trustBadges;
  const html = renderToStaticMarkup(React.createElement(TrustBadges, { content }));
  const apariciones = html.match(/lucide-[a-z-]+/g) ?? [];
  assert.deepEqual(apariciones, ['lucide-leaf', 'lucide-coffee', 'lucide-truck', 'lucide-shield']);
});

// ─── LA REPRODUCCIÓN de la ficha de producto (§ ALCANCE, como /tienda y /rastrear-pedido en
// copy-b.test.ts) — `[slug]/page.tsx` usa `use(params)` + `getCatalog()` (fetch real, sin mock de
// router ni de red instalado en este repo), así que no es renderizable bare. Se reproduce la MISMA
// expresión que el archivo usa para el bloque "Shipping Perks", copiada acá para afirmar su
// comportamiento por ejecución (no sólo por lectura) — se verifica de nuevo contra la fuente en el
// gate visual. ─────────────────────────────────────────────────────────────────────────────────
function renderShippingPerks(productoBadges: { badge1: string; badge1Icono: string; badge2: string; badge2Icono: string; badge3: string; badge3Icono: string }): string {
  return renderToStaticMarkup(
    React.createElement(
      'div',
      null,
      [
        { text: productoBadges.badge1, icono: productoBadges.badge1Icono },
        { text: productoBadges.badge2, icono: productoBadges.badge2Icono },
        { text: productoBadges.badge3, icono: productoBadges.badge3Icono },
      ].map(({ text, icono }) => {
        const Icon = iconoBadge(icono);
        return React.createElement('div', { key: text }, React.createElement(Icon), text);
      }),
    ),
  );
}

test('/tienda/[slug] (reproducción de la expresión): SIN sembrado, las TRES garantías son texto NEUTRO con ícono neutro', () => {
  const html = renderShippingPerks(DEFAULTS.productoBadges);
  assert.ok(html.includes('Envío disponible a todo el país'));
  assert.ok(html.includes('Garantía de cambios y devoluciones'));
  assert.ok(html.includes('Revisión de calidad antes de cada envío'));
  const apariciones = html.match(/lucide-[a-z-]+/g) ?? [];
  assert.deepEqual(apariciones, ['lucide-badge-check', 'lucide-badge-check', 'lucide-badge-check']);
});

test('/tienda/[slug] (reproducción de la expresión): CON el sembrado, las TRES garantías son el café de Nayoli byte a byte, íconos truck/rotate/check en orden', () => {
  const content = resolverSiteContent(mergeCopyNayoliEnContent({})).productoBadges;
  const html = renderShippingPerks(content);
  assert.ok(html.includes('Envío a todo Colombia · Gratis +$150.000'));
  assert.ok(html.includes('Garantía de frescura de 30 días'));
  assert.ok(html.includes('Tostado dentro de los 7 días previos al envío'));
  // `CheckCircle` (lucide-react 1.16.0) renderiza `lucide-circle-check-big` — el NOMBRE del dato
  // (`'check'`) es el que se declara en `NOMBRES_ICONO_BADGE`; la clase CSS es del componente y no
  // tiene por qué coincidir con el nombre del dato (medido, no supuesto).
  const apariciones = html.match(/lucide-[a-z-]+/g) ?? [];
  assert.deepEqual(apariciones, ['lucide-truck', 'lucide-rotate-ccw', 'lucide-circle-check-big']);
});

// ─── EL SEMBRADO: sigue IDEMPOTENTE con las DOS secciones nuevas, y GUARDA el conjunto completo ───

test('sembrado: mergeCopyNayoliEnContent sigue IDEMPOTENTE con productoBadges incluido — aplicarlo dos veces da el MISMO content', () => {
  const una = mergeCopyNayoliEnContent({});
  const dos = mergeCopyNayoliEnContent(una);
  assert.deepEqual(dos, una);
  assert.deepEqual(una.trustBadges, COPY_NAYOLI.trustBadges);
  assert.deepEqual(una.productoBadges, COPY_NAYOLI.productoBadges);
});

test('sembrado: mergeCopyNayoliEnContent PRESERVA cualquier otro campo de `productoBadges`/`trustBadges` ya existente (merge quirúrgico, no reemplazo)', () => {
  const previo = {
    hero: { titulo: 'Custom del cliente' },
    trustBadges: { visible: false, badge1: 'algo viejo', badge1Icono: 'rotate' },
    productoBadges: { visible: false },
  };
  const nuevo = mergeCopyNayoliEnContent(previo);
  assert.deepEqual(nuevo.hero, { titulo: 'Custom del cliente' }, 'otras secciones quedan intactas');
  assert.equal((nuevo.trustBadges as { visible: boolean }).visible, false, 'campos no-café de trustBadges se preservan');
  assert.equal((nuevo.productoBadges as { visible: boolean }).visible, false, 'campos no-café de productoBadges se preservan');
  assert.deepEqual(nuevo.trustBadges, { visible: false, ...COPY_NAYOLI.trustBadges }, 'sólo los 8 campos de trustBadges se pisan');
  assert.deepEqual(nuevo.productoBadges, { visible: false, ...COPY_NAYOLI.productoBadges }, 'sólo los 6 campos de productoBadges se pisan');
});

test('sembrado: COPY_NAYOLI trae el conjunto COMPLETO — 8 campos de trustBadges + 6 de productoBadges, sin uno vacío', () => {
  const trustBadgesVals = Object.values(COPY_NAYOLI.trustBadges);
  const productoBadgesVals = Object.values(COPY_NAYOLI.productoBadges);
  assert.equal(trustBadgesVals.length, 8);
  assert.equal(productoBadgesVals.length, 6);
  for (const v of [...trustBadgesVals, ...productoBadgesVals]) {
    assert.ok(typeof v === 'string' && v.trim() !== '', `valor vacío en COPY_NAYOLI: ${v}`);
  }
  // Los 4 + 3 nombres de ícono son miembros REALES del set cerrado (nunca basura sembrada a la base).
  const nombresIcono = [
    COPY_NAYOLI.trustBadges.badge1Icono, COPY_NAYOLI.trustBadges.badge2Icono,
    COPY_NAYOLI.trustBadges.badge3Icono, COPY_NAYOLI.trustBadges.badge4Icono,
    COPY_NAYOLI.productoBadges.badge1Icono, COPY_NAYOLI.productoBadges.badge2Icono, COPY_NAYOLI.productoBadges.badge3Icono,
  ];
  for (const n of nombresIcono) {
    assert.ok((NOMBRES_ICONO_BADGE as readonly string[]).includes(n), `"${n}" no es un miembro del set cerrado`);
  }
});
