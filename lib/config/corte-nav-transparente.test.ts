import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Logo } from '@/components/storefront/Logo';
import {
  resolverSiteContent,
  resolverOrden,
  varianteDeBanda,
  bandaOscuraCanonica,
  bandaUniforme,
  type BandaId,
} from '@/lib/config/site-content-defaults';
import { tratamientoNav } from '@/lib/config/esquema-style';
import { PRESETS, CORTE } from '@/lib/config/themes';
import { contenidoConPresetDeVista } from '@/lib/config/theme-mirador';

// § CORTE-NAV-TRANSPARENTE-HERO-1. El target es el `.site-header`/`.is-solid` del prototipo
// (docs/prototipos/cafeone/css/app.css:172-191): flota TRANSPARENTE sobre el hero y sólo cae a
// SÓLIDO `--surface-inverse` (nuestra `--sf-tinta`) al scrollear — nunca "sólida siempre", que era
// la lectura anterior de `cromo.navTinta`.
//
// StoreNav.tsx NO se renderiza acá — usa `usePathname()` (`next/navigation`), que fuera de un
// árbol real de Next.js revienta en `pathname.startsWith(...)` (la MISMA frontera ya documentada en
// `cromo-tematizable.test.ts`/`cromo-nav-tratamiento.test.ts` para este mismo componente). Lo que se
// afirma acá es la CAPA DE DATOS que gobierna a StoreNav — el pass-through EXACTO de
// `navFlotando`/`navClaro`/`navBg` (líneas 76-83 hoy), duplicado literal como ya hacen esos dos
// archivos —, más el `Logo` real vía `renderToStaticMarkup` (SÍ renderizable: no depende de ningún
// contexto de ruteo), que es la mitad de StoreNav que SÍ se puede ejercer sin árbol de Next.

// Reproduce el pass-through de StoreNav.tsx (líneas 67-83) byte a byte. No es una reimplementación
// independiente: es el mismo cálculo que el componente hace, para poder afirmarlo sin `usePathname`.
function estadoNav(
  content: ReturnType<typeof resolverSiteContent>,
  { isHome, scrolled }: { isHome: boolean; scrolled: boolean },
) {
  const { esquemas, tema, orden, cromo } = content;
  const primera = resolverOrden(orden)[0];
  const t = tratamientoNav(primera, varianteDeBanda(content, primera), esquemas, tema.fondo, tema.tinta, tema.acento);
  const navBandaTinta = cromo.navTinta;
  const navFlotando = isHome && !scrolled && t.flotante;
  const navClaro = navFlotando ? t.textoClaro : navBandaTinta;
  const navBg = navFlotando
    ? (navClaro ? 'bg-transparent text-[var(--sf-sobre)]' : 'bg-transparent text-[var(--sf-tinta)]')
    : navBandaTinta
      ? 'bg-[var(--sf-tinta)] shadow-sm text-[var(--sf-sobre)]'
      : 'bg-[var(--sf-tarjeta)]/95 backdrop-blur shadow-sm text-[var(--sf-tinta)]';
  return { primera, t, navBandaTinta, navFlotando, navClaro, navBg };
}

// Fórmula VIEJA (previa a este slice), para probar byte-identidad con navTinta:false por
// SUSTITUCIÓN, no por inspección visual del diff.
function estadoNavViejo(
  content: ReturnType<typeof resolverSiteContent>,
  { isHome, scrolled }: { isHome: boolean; scrolled: boolean },
) {
  const { esquemas, tema, orden, cromo } = content;
  const primera = resolverOrden(orden)[0];
  const t = tratamientoNav(primera, varianteDeBanda(content, primera), esquemas, tema.fondo, tema.tinta, tema.acento);
  const navBandaTinta = cromo.navTinta;
  const navFlotando = !navBandaTinta && isHome && !scrolled && t.flotante;
  const navClaro = navBandaTinta || (navFlotando && t.textoClaro);
  const navBg = navBandaTinta
    ? 'bg-[var(--sf-tinta)] shadow-sm text-[var(--sf-sobre)]'
    : navFlotando
      ? (navClaro ? 'bg-transparent text-[var(--sf-sobre)]' : 'bg-transparent text-[var(--sf-tinta)]')
      : 'bg-[var(--sf-tarjeta)]/95 backdrop-blur shadow-sm text-[var(--sf-tinta)]';
  return { navFlotando, navClaro, navBg };
}

// ── PRECONDICIÓN medida: el hero de CORTE (variante 'media') es OSCURO y UNIFORME ────────────────
// El floating transparente sólo aplica sobre una banda uniforme (§ EJE-5-NAV-UNIFORME); el target
// del prototipo asume un hero oscuro a sangre. Si esto no diera true/true, el slice pararía acá.

test('PRECONDICIÓN: hero·media (CORTE) es oscuro y uniforme — el floating del prototipo aplica', () => {
  const corte = contenidoConPresetDeVista(resolverSiteContent({}), 'CORTE');
  assert.equal(corte.hero.variante, 'media', 'CORTE declara hero:"media" en variantes (§ themes.ts)');
  assert.equal(corte.esquemas.hero, undefined, 'CORTE no asigna esquema a la banda hero (§ themes.ts:esquemas)');
  assert.equal(bandaOscuraCanonica('hero' as BandaId, 'media'), true, 'hero·media es oscuro por canónica');
  assert.equal(bandaUniforme('hero' as BandaId, 'media'), true, 'hero·media es uniforme (sólo "ficha" no lo es)');
});

// ── CORTE: flota transparente sobre el hero, cae a SÓLIDO --sf-tinta al scrollear ────────────────

test('CORTE sin scroll, home: flota TRANSPARENTE con texto claro (no cae al tinta sólido)', () => {
  const corte = contenidoConPresetDeVista(resolverSiteContent({}), 'CORTE');
  const e = estadoNav(corte, { isHome: true, scrolled: false });
  assert.equal(e.navBandaTinta, true, 'CORTE declara cromo.navTinta:true');
  assert.equal(e.t.flotante, true, 'hero·media es uniforme → tratamientoNav permite flotar');
  assert.equal(e.t.textoClaro, true, 'hero·media es oscuro → texto claro');
  assert.equal(e.navFlotando, true, 'CORTE ya NO fuerza navFlotando=false — el prototipo flota sobre el hero');
  assert.equal(e.navClaro, true);
  assert.equal(e.navBg, 'bg-transparent text-[var(--sf-sobre)]', 'transparente, no --sf-tinta — el defecto que este slice cierra');
});

test('CORTE scrolleado: cae a SÓLIDO --sf-tinta (no a la tarjeta clara de los otros temas)', () => {
  const corte = contenidoConPresetDeVista(resolverSiteContent({}), 'CORTE');
  const e = estadoNav(corte, { isHome: true, scrolled: true });
  assert.equal(e.navFlotando, false);
  assert.equal(e.navClaro, true, 'el estado sólido de CORTE sigue siendo tinta → texto claro');
  assert.equal(e.navBg, 'bg-[var(--sf-tinta)] shadow-sm text-[var(--sf-sobre)]', 'sólido tinta, no la tarjeta clara de --sf-tarjeta');
});

test('CORTE fuera de home (no isHome): mismo sólido --sf-tinta que scrolleado — nunca flota fuera de home', () => {
  const corte = contenidoConPresetDeVista(resolverSiteContent({}), 'CORTE');
  const e = estadoNav(corte, { isHome: false, scrolled: false });
  assert.equal(e.navFlotando, false);
  assert.equal(e.navBg, 'bg-[var(--sf-tinta)] shadow-sm text-[var(--sf-sobre)]');
});

// ── navTinta:false (todo tenant salvo CORTE): BYTE-IDÉNTICO al comportamiento de hoy ─────────────

test('Nayoli (sin preset, navTinta:false): la fórmula nueva da EXACTAMENTE lo mismo que la fórmula vieja', () => {
  const nayoli = resolverSiteContent({});
  assert.equal(nayoli.cromo.navTinta, false);
  for (const isHome of [true, false]) {
    for (const scrolled of [true, false]) {
      const nuevo = estadoNav(nayoli, { isHome, scrolled });
      const viejo = estadoNavViejo(nayoli, { isHome, scrolled });
      assert.deepEqual(
        { navFlotando: nuevo.navFlotando, navClaro: nuevo.navClaro, navBg: nuevo.navBg },
        viejo,
        `isHome=${isHome} scrolled=${scrolled}`,
      );
    }
  }
});

test('los 5 presets del catálogo que NO son CORTE declaran navTinta:false, y su fórmula no cambia', () => {
  for (const preset of PRESETS) {
    if (preset.clave === 'CORTE') continue;
    const content = contenidoConPresetDeVista(resolverSiteContent({}), preset.clave);
    assert.equal(content.cromo.navTinta, false, `${preset.clave} no debe declarar navTinta:true`);
    for (const isHome of [true, false]) {
      for (const scrolled of [true, false]) {
        const nuevo = estadoNav(content, { isHome, scrolled });
        const viejo = estadoNavViejo(content, { isHome, scrolled });
        assert.deepEqual(
          { navFlotando: nuevo.navFlotando, navClaro: nuevo.navClaro, navBg: nuevo.navBg },
          viejo,
          `${preset.clave} isHome=${isHome} scrolled=${scrolled}`,
        );
      }
    }
  }
});

test('CORTE sigue siendo el ÚNICO preset del catálogo que declara navTinta:true', () => {
  assert.equal(CORTE.navTinta, true);
  for (const preset of PRESETS) {
    if (preset.clave === 'CORTE') continue;
    assert.equal(preset.navTinta, undefined, `${preset.clave} no debe declarar navTinta`);
  }
});

// ── El Logo real (renderToStaticMarkup) — la mitad de StoreNav que sí se puede renderizar ────────
// `variant={navClaro ? 'dark' : 'light'}` (StoreNav.tsx) es el pass-through que decide el color del
// wordmark; se ejerce acá contra el Logo REAL, no una re-implementación de su CSS.

test('Logo: navClaro=true (CORTE flotando sobre el hero) → variant="dark" → wordmark claro sobre tinta', () => {
  const corte = contenidoConPresetDeVista(resolverSiteContent({}), 'CORTE');
  const { navClaro } = estadoNav(corte, { isHome: true, scrolled: false });
  const html = renderToStaticMarkup(
    React.createElement(Logo, { nombre: 'Corte', variant: navClaro ? 'dark' : 'light' }),
  );
  assert.ok(html.includes('--sf-sobre-tinta'), 'variant="dark" pinta con el par claro-sobre-tinta');
  assert.ok(!html.includes('text-[var(--sf-tinta)]'), 'no debe usar el wordmark oscuro mientras flota claro');
});

test('Logo: navClaro=true (CORTE ya sólido --sf-tinta al scrollear) → variant sigue "dark" — el sólido de CORTE es tinta, no tarjeta clara', () => {
  const corte = contenidoConPresetDeVista(resolverSiteContent({}), 'CORTE');
  const { navClaro } = estadoNav(corte, { isHome: true, scrolled: true });
  const html = renderToStaticMarkup(
    React.createElement(Logo, { nombre: 'Corte', variant: navClaro ? 'dark' : 'light' }),
  );
  assert.ok(html.includes('--sf-sobre-tinta'), 'sólido --sf-tinta sigue pidiendo el wordmark claro');
});

test('Logo: Nayoli scrolleado (navClaro=false, sólido tarjeta clara) → variant="light" → wordmark oscuro', () => {
  const nayoli = resolverSiteContent({});
  const { navClaro } = estadoNav(nayoli, { isHome: true, scrolled: true });
  assert.equal(navClaro, false);
  const html = renderToStaticMarkup(
    React.createElement(Logo, { nombre: 'Café Nayoli', variant: navClaro ? 'dark' : 'light' }),
  );
  assert.ok(html.includes('text-[var(--sf-tinta)]'), 'variant="light" pinta el wordmark con --sf-tinta (oscuro)');
});
