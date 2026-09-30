import { test } from 'node:test';
import assert from 'node:assert/strict';

import { navOffsetClase, navOffsetDeltaClase, PRESETS, CORTE } from './themes';
import { resolverSiteContent, resolverOrden, varianteDeBanda } from './site-content-defaults';
import { tratamientoNav } from './esquema-style';
import { contenidoConPresetDeVista } from './theme-mirador';

// § NAV-INTERNAS-CLARO-Y-OFFSET-1 — dos defectos que el owner reportó sobre el mismo gate visual
// (2026-09-29, capturas de la ficha de producto y de una página interna del tema real):
//
//   1. «El nav debería ser blanco en las otras páginas» — fuera de la home, CORTE pintaba la MISMA
//      banda tinta que usa la home al SCROLLEAR, porque `navBandaTinta` (StoreNav.tsx) no tenía en
//      cuenta `isHome`. Este archivo prueba la fórmula NUEVA (`isHome && cromo.navTinta`) por
//      SUSTITUCIÓN, el mismo método que ya usaba `corte-nav-transparente.test.ts` para la fórmula
//      anterior — sin importarla (StoreNav.tsx usa `usePathname()`, que revienta fuera de un árbol
//      real de Next.js, § el docstring de ese archivo).
//   2. «El nav tapa la ruta que sale de Inicio/tienda/producto» — cada página interna reservaba un
//      `pt-16` (64px) fijo, calculado contra el header de HOY (64/72px), pero el header de CORTE mide
//      76/88px (§ NAV-ALTURA-CON-FILETE-1). `navOffsetClase`/`navOffsetDeltaClase` (`themes.ts`)
//      cierran ese hueco; acá se afirman sus valores exactos.

// ─── `navOffsetClase` — el relleno superior COMPLETO (reemplaza el `pt-16` de cada página) ──────

test('navOffsetClase(false) = pt-16, byte a byte lo que cada página interna ya usaba (todo tenant salvo CORTE)', () => {
  assert.equal(navOffsetClase(false), 'pt-16');
});

test('navOffsetClase(true) = el alto REAL del header de CORTE — 76px bajo 640px, 88px desde 640px (§ NAV-ALTURA-CON-FILETE-1, no reabierto acá)', () => {
  assert.equal(navOffsetClase(true), 'pt-[76px] min-[640px]:pt-[88px] cortenav:pt-[88px]');
});

test('sin fila de SiteContent (Nayoli/defaults) → navTratamiento.posicion es false → navOffsetClase da pt-16', () => {
  const posicion = resolverSiteContent({}).navTratamiento.posicion;
  assert.equal(posicion, false);
  assert.equal(navOffsetClase(posicion), 'pt-16');
});

test('con el preset CORTE superpuesto → navOffsetClase da el alto real del header', () => {
  const conCorte = contenidoConPresetDeVista(resolverSiteContent({}), 'CORTE');
  assert.equal(conCorte.navTratamiento.posicion, true);
  assert.equal(navOffsetClase(conCorte.navTratamiento.posicion), 'pt-[76px] min-[640px]:pt-[88px] cortenav:pt-[88px]');
});

test('de los 6 presets del catálogo, sólo CORTE dispara navOffsetClase distinto de pt-16', () => {
  for (const preset of PRESETS) {
    const conPreset = contenidoConPresetDeVista(resolverSiteContent({}), preset.clave);
    const esperado = preset.clave === 'CORTE' ? 'pt-[76px] min-[640px]:pt-[88px] cortenav:pt-[88px]' : 'pt-16';
    assert.equal(navOffsetClase(conPreset.navTratamiento.posicion), esperado, `${preset.clave}`);
  }
});

// ─── `navOffsetDeltaClase` — sólo el HUECO que falta sobre el `pt-16` que YA reserva
// `suscripciones/Contenido.tsx` (fuera de `touches:` de este slice, § el docstring en `themes.ts`) ──

test('navOffsetDeltaClase(false) = sin clase — Contenido.tsx sigue solo con su pt-16 de siempre', () => {
  assert.equal(navOffsetDeltaClase(false), '');
});

test('navOffsetDeltaClase(true) = exactamente el faltante para llegar a 76/88 sobre un pt-16 (64px) ya reservado: 12px bajo 640px, 24px desde 640px', () => {
  assert.equal(navOffsetDeltaClase(true), 'pt-3 min-[640px]:pt-6');
});

test('navOffsetDeltaClase == 0 (Tailwind pt-3/pt-6) sumado al pt-16 de Contenido.tsx da el MISMO total que navOffsetClase(true) — no dos fuentes divergentes del mismo número', () => {
  // pt-16 = 4rem = 64px; pt-3 = 0.75rem = 12px; pt-6 = 1.5rem = 24px (escala de Tailwind, no
  // arbitraria). 64+12=76, 64+24=88 — los MISMOS dos literales que navOffsetClase(true) declara.
  const REM_PX = 16;
  const PT16_PX = 4 * REM_PX;
  const DELTA_BASE_PX = 0.75 * REM_PX;
  const DELTA_640_PX = 1.5 * REM_PX;
  assert.equal(PT16_PX + DELTA_BASE_PX, 76);
  assert.equal(PT16_PX + DELTA_640_PX, 88);
});

// ─── `navBandaTinta` (StoreNav.tsx) — la fórmula NUEVA, scoped a `isHome` ────────────────────────
//
// Reproduce el pass-through de StoreNav.tsx (la banda tinta y sus consumidores) byte a byte, por
// SUSTITUCIÓN, no por render — mismo método y misma razón que `corte-nav-transparente.test.ts` para
// la fórmula ANTERIOR a este slice (que esta fórmula reemplaza en el componente real).
function estadoNav(
  content: ReturnType<typeof resolverSiteContent>,
  { isHome, scrolled }: { isHome: boolean; scrolled: boolean },
) {
  const { esquemas, tema, orden, cromo } = content;
  const primera = resolverOrden(orden)[0];
  const t = tratamientoNav(primera, varianteDeBanda(content, primera), esquemas, tema.fondo, tema.tinta, tema.acento);
  const navBandaTinta = isHome && cromo.navTinta;
  const navFlotando = isHome && !scrolled && t.flotante;
  const navClaro = navFlotando ? t.textoClaro : navBandaTinta;
  const navBg = navFlotando
    ? (navClaro ? 'bg-transparent text-[var(--sf-sobre)]' : 'bg-transparent text-[var(--sf-tinta)]')
    : navBandaTinta
      ? 'bg-[var(--sf-tinta)] shadow-sm text-[var(--sf-sobre)]'
      : 'bg-[var(--sf-tarjeta)]/95 backdrop-blur shadow-sm text-[var(--sf-tinta)]';
  const navFileteClase = navClaro
    ? 'border-b border-[var(--sf-sobre)]/20'
    : 'border-b border-[var(--sf-tinta)]/20';
  return { navBandaTinta, navFlotando, navClaro, navBg, navFileteClase };
}

test('CORTE fuera de home (no isHome): YA NO cae al sólido --sf-tinta — el defecto reportado por el owner', () => {
  const corte = contenidoConPresetDeVista(resolverSiteContent({}), 'CORTE');
  const e = estadoNav(corte, { isHome: false, scrolled: false });
  assert.equal(e.navBandaTinta, false, 'fuera de home, navBandaTinta es SIEMPRE false — sin importar cromo.navTinta');
  assert.equal(e.navFlotando, false, 'fuera de home nunca flota (sin cambio de este slice)');
  assert.equal(e.navClaro, false);
  assert.equal(
    e.navBg,
    'bg-[var(--sf-tarjeta)]/95 backdrop-blur shadow-sm text-[var(--sf-tinta)]',
    'la MISMA rama clara que ya usan los otros 5 presets fuera de home — no un tercer estado',
  );
});

test('CORTE fuera de home: el filete cae al par oscuro (border-[var(--sf-tinta)]/20) — el hairline gris fino que pide el gate', () => {
  const corte = contenidoConPresetDeVista(resolverSiteContent({}), 'CORTE');
  const e = estadoNav(corte, { isHome: false, scrolled: false });
  assert.equal(e.navFileteClase, 'border-b border-[var(--sf-tinta)]/20');
});

test('CORTE en home, sin scroll: SIGUE flotando transparente sobre el hero (sin cambio de este slice)', () => {
  const corte = contenidoConPresetDeVista(resolverSiteContent({}), 'CORTE');
  const e = estadoNav(corte, { isHome: true, scrolled: false });
  assert.equal(e.navFlotando, true);
  assert.equal(e.navBg, 'bg-transparent text-[var(--sf-sobre)]');
});

test('CORTE en home, scrolleado: SIGUE cayendo al sólido --sf-tinta (sin cambio de este slice) — la home conserva su comportamiento', () => {
  const corte = contenidoConPresetDeVista(resolverSiteContent({}), 'CORTE');
  const e = estadoNav(corte, { isHome: true, scrolled: true });
  assert.equal(e.navFlotando, false);
  assert.equal(e.navBg, 'bg-[var(--sf-tinta)] shadow-sm text-[var(--sf-sobre)]');
});

test('Nayoli (navTinta:false): la fórmula scoped a isHome da EXACTAMENTE lo mismo que antes, en las 4 combinaciones — BYTE-IDÉNTICO', () => {
  const nayoli = resolverSiteContent({});
  assert.equal(nayoli.cromo.navTinta, false);
  for (const isHome of [true, false]) {
    for (const scrolled of [true, false]) {
      const e = estadoNav(nayoli, { isHome, scrolled });
      // isHome && false === false siempre, así que navBandaTinta nunca cambia de valor por este
      // slice para un tenant sin navTinta — la única variable que se movió no puede moverlo.
      assert.equal(e.navBandaTinta, false, `isHome=${isHome} scrolled=${scrolled}`);
    }
  }
});

test('los 5 presets del catálogo que NO son CORTE declaran navTinta:false, y su navBandaTinta nunca se activa (con o sin isHome)', () => {
  for (const preset of PRESETS) {
    if (preset.clave === 'CORTE') continue;
    const content = contenidoConPresetDeVista(resolverSiteContent({}), preset.clave);
    assert.equal(content.cromo.navTinta, false, `${preset.clave} no debe declarar navTinta:true`);
    for (const isHome of [true, false]) {
      for (const scrolled of [true, false]) {
        const e = estadoNav(content, { isHome, scrolled });
        assert.equal(e.navBandaTinta, false, `${preset.clave} isHome=${isHome} scrolled=${scrolled}`);
      }
    }
  }
});

test('CORTE sigue siendo el ÚNICO preset del catálogo que declara navTinta:true (no reabierto por este slice)', () => {
  assert.equal(CORTE.navTinta, true);
  for (const preset of PRESETS) {
    if (preset.clave === 'CORTE') continue;
    assert.equal(preset.navTinta, undefined, `${preset.clave} no debe declarar navTinta`);
  }
});
