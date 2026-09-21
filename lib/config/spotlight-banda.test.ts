import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BANDA_IDS,
  DEFAULTS,
  REGISTRY,
  resolverSiteContent,
  seccionEsVisible,
  productoSpotlight,
  productoOtraTalla,
} from './site-content-defaults';

// SPOTLIGHT (§ SPOTLIGHT-BANDA-1) — un solo producto PINEADO. Este archivo afirma la mitad PURA
// del feature (el modelo + el resolver del pin), no el render: `Spotlight.tsx`
// (components/storefront/home/) es un componente React ('use client', framer-motion, next/image)
// y este repo no tiene jsdom (§ CLAUDE.md, "el glob NO incluye *.test.tsx: los tests de COMPONENTE
// necesitan jsdom, que el repo no tiene") — así que su JSX no se ejercita acá. Lo que SÍ se afirma
// es lo que decide QUÉ se muestra antes de que el componente pinte un solo nodo:
// `productoSpotlight`/`productoOtraTalla` (el pin resuelto contra el catálogo) y el gate de
// visibilidad (`seccionEsVisible`) que el componente consulta primero.

const CATALOGO = [
  { slug: 'cafe-huila-250' },
  { slug: 'cafe-huila-500' },
  { slug: 'cafe-narino-250' },
];

// ─── EL PIN RINDE EL PRODUCTO VIVO ──────────────────────────────────────────────────────────────
test('productoSpotlight: el pin resuelve al producto vivo cuando el slug matchea', () => {
  assert.deepEqual(productoSpotlight(CATALOGO, 'cafe-narino-250'), { slug: 'cafe-narino-250' });
});

// ─── PIN A NADA — NO ROMPE ──────────────────────────────────────────────────────────────────────
test('productoSpotlight: PIN A NADA (slug que ya no matchea ningún producto — se borró) cae al PRIMERO del catálogo, no a un componente roto', () => {
  assert.deepEqual(productoSpotlight(CATALOGO, 'un-producto-que-ya-se-borro'), { slug: 'cafe-huila-250' });
});

test('productoSpotlight: pin VACÍO (nunca configurado) cae al PRIMERO del catálogo, igual que un pin roto', () => {
  assert.deepEqual(productoSpotlight(CATALOGO, ''), { slug: 'cafe-huila-250' });
});

// ─── CATÁLOGO VACÍO — AUTO-OCULTA, NO UN SPOTLIGHT VACÍO ───────────────────────────────────────
test('productoSpotlight: CATÁLOGO VACÍO devuelve null (hide-on-empty) aunque el pin sea válido — no hay fallback que tenga sentido', () => {
  assert.equal(productoSpotlight([], 'cafe-huila-250'), null);
});

test('productoSpotlight: CATÁLOGO VACÍO + pin vacío también da null — las dos causas de vacío no se confunden', () => {
  assert.equal(productoSpotlight([], ''), null);
});

// ─── TAMAÑO COMO ENLACE A LA OTRA TALLA (otro slug), no una variante agrupada (Backlog #62) ─────
test('productoOtraTalla: un slug que matchea devuelve ESE producto (el enlace a la otra talla)', () => {
  assert.deepEqual(productoOtraTalla(CATALOGO, 'cafe-huila-500'), { slug: 'cafe-huila-500' });
});

test('productoOtraTalla: slug VACÍO no cae a ningún fallback — null, el control simplemente se omite', () => {
  assert.equal(productoOtraTalla(CATALOGO, ''), null);
});

test('productoOtraTalla: slug que NO matchea tampoco cae a un fallback — null, preferir callar a un link roto (a diferencia de productoSpotlight)', () => {
  assert.equal(productoOtraTalla(CATALOGO, 'no-existe'), null);
});

// ─── BYTE-IDENTIDAD DE NAYOLI ────────────────────────────────────────────────────────────────────
// `spotlight` TODAVÍA no es miembro de `BANDA_IDS` (§ el bloqueo medido en DECISIONS.md,
// SPOTLIGHT-BANDA-1: sumarla rompe la compilación de `app/(storefront)/page.tsx`, fuera de
// `touches:`), así que hoy no hay forma de que la banda aparezca en el `orden` resuelto de NINGÚN
// tenant — Nayoli incluida. La afirmación de "byte-idéntica por render" se hace en la CAPA DE
// DATOS que un futuro `page.tsx` consultaría antes de pintar nada — mismo patrón que ya usó
// CROMO-MENU-COMO-DATO-1 (`itemsDeMenu`/`menuCtaHref`) para StoreNav.tsx, sin poder renderizar
// React fuera de un árbol de Next real.

test('spotlight TODAVÍA no es miembro de BANDA_IDS — el bloqueo medido de SPOTLIGHT-BANDA-1, no un olvido', () => {
  assert.equal((BANDA_IDS as readonly string[]).includes('spotlight'), false);
});

test('DEFAULTS.spotlight nace OFF (visible:false) con los cinco campos vacíos — la ÚNICA sección ocultable con este default, y a propósito', () => {
  assert.deepEqual(DEFAULTS.spotlight, {
    visible: false,
    eyebrow: '',
    titulo: '',
    badge: '',
    productoSlug: '',
    otroTamanoSlug: '',
  });
});

test('sin fila (Nayoli, y todo tenant que no la edite), spotlight resuelve OFF: si algún día se monta en `orden`, no se enciende sola', () => {
  const resuelto = resolverSiteContent({});
  assert.deepEqual(resuelto.spotlight, DEFAULTS.spotlight);
  assert.equal(seccionEsVisible(REGISTRY.spotlight, resuelto.spotlight), false);
});

test('con visible explícito en true, la sección deja de ocultarse — la garantía de arriba es del DEFAULT, no de un `ocultable:false`', () => {
  const resuelto = resolverSiteContent({ spotlight: { visible: true } });
  assert.equal(resuelto.spotlight.visible, true);
  assert.equal(seccionEsVisible(REGISTRY.spotlight, resuelto.spotlight), true);
});
