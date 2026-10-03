import { test } from 'node:test';
import assert from 'node:assert/strict';

import { navOffsetClase, PRESETS, CORTE } from './themes';
import { resolverSiteContent, resolverOrden, varianteDeBanda } from './site-content-defaults';
import { tratamientoNav } from './esquema-style';
import { contenidoConPresetDeVista } from './theme-mirador';
import { altoLogoNavMovilClase, AIRE_VERTICAL_LOGO_MOVIL_PX } from './marca-logo';

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
//      76/88px (§ NAV-ALTURA-CON-FILETE-1). `navOffsetClase` (`themes.ts`) cierra ese hueco; acá se
//      afirman sus valores exactos. (`navOffsetDeltaClase`, el parche temporal para
//      `suscripciones/Contenido.tsx` mientras ese archivo estaba fuera de `touches:`, SE RETIRÓ en
//      § CIERRE-NOCHE-RIEL-1 junto con sus tres tests — `Contenido.tsx` ya usa `navOffsetClase`
//      directo, como las demás páginas.)

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

// ─── `navBandaTinta` (StoreNav.tsx) — la fórmula NUEVA, scoped a `isHome` ────────────────────────
//
// Reproduce el pass-through de StoreNav.tsx (la banda tinta y sus consumidores) byte a byte, por
// SUSTITUCIÓN, no por render — mismo método y misma razón que `corte-nav-transparente.test.ts` para
// la fórmula ANTERIOR a este slice (que esta fórmula reemplaza en el componente real).
//
// § FOTOS-SIN-BORDE-LINEA-NAV-FLECHAS-PDP-1 — `navSombraClase` se sumó al pass-through: `shadow-sm`
// pintaba una SEGUNDA línea de borde-a-borde bajo el header sólido, redundante con `navFileteClase`
// (inset, con margen) para el ÚNICO preset que declara `navTratamiento.filete` (CORTE). Ver el
// docstring de `navBg` en `StoreNav.tsx` para el porqué completo (medido con pixel-scan contra la
// captura del gate, `onix-pdp-doble-linea.webp`).
function estadoNav(
  content: ReturnType<typeof resolverSiteContent>,
  { isHome, scrolled }: { isHome: boolean; scrolled: boolean },
) {
  const { esquemas, tema, orden, cromo, navTratamiento } = content;
  const primera = resolverOrden(orden)[0];
  const t = tratamientoNav(primera, varianteDeBanda(content, primera), esquemas, tema.fondo, tema.tinta, tema.acento);
  const navBandaTinta = isHome && cromo.navTinta;
  const navFlotando = isHome && !scrolled && t.flotante;
  const navClaro = navFlotando ? t.textoClaro : navBandaTinta;
  const navSombraClase = navTratamiento.filete ? '' : ' shadow-sm';
  const navBg = navFlotando
    ? (navClaro ? 'bg-transparent text-[var(--sf-sobre)]' : 'bg-transparent text-[var(--sf-tinta)]')
    : navBandaTinta
      ? `bg-[var(--sf-tinta)]${navSombraClase} text-[var(--sf-sobre)]`
      : `bg-[var(--sf-tarjeta)]/95 backdrop-blur${navSombraClase} text-[var(--sf-tinta)]`;
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
    'bg-[var(--sf-tarjeta)]/95 backdrop-blur text-[var(--sf-tinta)]',
    // MISMA rama clara que los otros 5 presets, SIN `shadow-sm` (§ FOTOS-SIN-BORDE-LINEA-NAV-
    // FLECHAS-PDP-1): CORTE es el único con `navTratamiento.filete`, así que pierde la sombra
    // vieja para no duplicar la línea que el filete (abajo) ya dibuja — los otros 5 la conservan.
    'la misma rama clara de los otros 5 presets, pero sin la sombra vieja (CORTE ya tiene el filete)',
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

test('CORTE en home, scrolleado: SIGUE cayendo al sólido --sf-tinta — pero SIN `shadow-sm` (§ FOTOS-SIN-BORDE-LINEA-NAV-FLECHAS-PDP-1, la home TAMPOCO se salva de la doble línea: el filete no depende de `isHome`)', () => {
  const corte = contenidoConPresetDeVista(resolverSiteContent({}), 'CORTE');
  const e = estadoNav(corte, { isHome: true, scrolled: true });
  assert.equal(e.navFlotando, false);
  assert.equal(e.navBg, 'bg-[var(--sf-tinta)] text-[var(--sf-sobre)]');
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

// ─── `navTratamiento.buscarMovil` (§ NAV-MOVIL-SIN-BUSCAR-1) ───────────────────────────────────────
//
// A diferencia de los siete campos de arriba, éste NO es un eje de preset: ningún preset del
// catálogo lo declara (`mergePresetEnContent`, `themes.ts`, ni lo toca), así que el default de
// `DEFAULTS.navTratamiento` es la única fuente, para TODO tenant, con o sin preset superpuesto.

test('sin fila de SiteContent (Nayoli/defaults) → navTratamiento.buscarMovil es true — se muestra, byte-idéntico a hoy', () => {
  assert.equal(resolverSiteContent({}).navTratamiento.buscarMovil, true);
});

test('HUECO MEDIDO (fuera de `touches:`, § el docstring de NavTratamientoContent.buscarMovil): el mirador `?tema=CORTE` pierde el campo — `mergePresetEnContent` (themes.ts) reconstruye `navTratamiento` entero SIN `buscarMovil`, así que acá queda `undefined`, no `true`', () => {
  // ESTO NO ES EL CAMINO REAL de un tenant: `app/(storefront)/page.tsx` sólo llama a esto bajo
  // `esDespliegueDemo()`, y el resultado se pasa DIRECTO al storefront SIN volver a pasar por
  // `resolverSiteContent` — por eso el hueco de `mergePresetEnContent` SÍ llega a filtrarse hasta
  // acá, a diferencia de `readSiteContent()` (§ `panel-encabezado.test.ts`, "default del preset"),
  // que SÍ resuelve de nuevo y cae al default `true`. Medido, no asumido — este test se vio fallar
  // esperando `true` antes de corregirlo a lo que el código realmente produce.
  const conCorte = contenidoConPresetDeVista(resolverSiteContent({}), 'CORTE');
  assert.equal(conCorte.navTratamiento.buscarMovil, undefined);
});

test('de los 6 presets del catálogo, ninguno declara navTratamientoBuscarMovil (no es un eje de preset)', () => {
  for (const preset of PRESETS) {
    assert.equal(
      (preset as unknown as Record<string, unknown>).navTratamientoBuscarMovil,
      undefined,
      `${preset.clave} no debería declarar navTratamientoBuscarMovil`,
    );
  }
});

// ─── `ocultarBuscarEnBarraMovil` (StoreNav.tsx) — reproducida por SUSTITUCIÓN, mismo método que
// `estadoNav` arriba: StoreNav.tsx NO se renderiza acá (§ el docstring de cabecera de este archivo).

function ocultarBuscarEnBarraMovil(variante: 'dropdown' | 'pantallaCompleta', buscarMovil: boolean): boolean {
  return variante === 'pantallaCompleta' && !buscarMovil;
}

test("'dropdown' (HOY, 5 de 6 presets): el buscar de la barra NUNCA se oculta, ni con buscarMovil:false — ese drawer no trae buscar propio", () => {
  assert.equal(ocultarBuscarEnBarraMovil('dropdown', true), false);
  assert.equal(ocultarBuscarEnBarraMovil('dropdown', false), false);
});

test("'pantallaCompleta' (CORTE): buscarMovil:true (default) → se muestra; buscarMovil:false → se oculta de la barra (sigue en el menú)", () => {
  assert.equal(ocultarBuscarEnBarraMovil('pantallaCompleta', true), false);
  assert.equal(ocultarBuscarEnBarraMovil('pantallaCompleta', false), true);
});

// ─── `claseBuscarBarraMovil` (StoreNav.tsx, § NAV-MOVIL-NOMBRE-CON-AIRE-1) — reproducida por
// SUSTITUCIÓN, mismo método que las de arriba.
//
// `invisible`, NO `hidden`: `display:none` retira la caja del botón del cálculo de flex de la fila
// del encabezado, así que el Logo (el único flex item con `min-w-0`, capaz de encoger) recibe el
// ancho que el ícono dejó de necesitar y su wordmark CRECE para llenarlo — el defecto que el owner
// reportó viendo la demo de Café Las Chamisas en el teléfono. `visibility:hidden` CONSERVA la caja
// en el flujo: el presupuesto total de la fila no cambia, así que el Logo recibe EXACTAMENTE la
// misma `disponible` que con el ícono VISIBLE y el wordmark queda del mismo tamaño — el hueco que
// el ícono dejó de PINTAR se ve como aire, inmediatamente antes del carrito.

function claseBuscarBarraMovil(ocultar: boolean): string {
  return ocultar ? ' invisible lg:visible' : '';
}

test('buscar VISIBLE (default, 5 de 6 presets + CORTE con buscarMovil:true): sin clase extra, byte-idéntico a hoy', () => {
  assert.equal(claseBuscarBarraMovil(false), '');
});

test('buscar OCULTO en el teléfono (CORTE con buscarMovil:false): invisible + lg:visible, NUNCA hidden — conserva su caja en el cálculo de flex para que el nombre no crezca', () => {
  assert.equal(claseBuscarBarraMovil(true), ' invisible lg:visible');
  assert.doesNotMatch(claseBuscarBarraMovil(true), /\bhidden\b/);
});

// ─── `altoLogoNavMovilClase` (marca-logo.ts, § NAV-LOGO-Y-NOMBRE-AJUSTE-1, § NAV-LOGO-MOVIL-CON-
// AIRE-1, § NAV-LOGO-TAMANOS-FINOS-1) NO PUEDE DIVERGIR del alto REAL del header que
// `navOffsetClase` ya afirma arriba (76/88px CORTE, pt-16=64px el resto) — MENOS el aire vertical
// (§ `AIRE_VERTICAL_LOGO_MOVIL_PX`, marca-logo.ts): las dos funciones describen el MISMO `<header>`
// desde dos ángulos distintos (padding-top de la página vs. alto del logo en `logoYNombre`) — un
// cambio futuro a `navFilaAltoClase` (StoreNav.tsx) que actualice una y no la otra queda atrapado
// acá, no sólo por lectura. Antes de § NAV-LOGO-MOVIL-CON-AIRE-1 el logo llenaba la barra BORDE A
// BORDE (mismo número que `navOffsetClase`); desde entonces es ese número MENOS
// `2×AIRE_VERTICAL_LOGO_MOVIL_PX` — § NAV-LOGO-TAMANOS-FINOS-1 subió el aire de 8px a 12px por lado
// (el pedido del owner, "un poco más chico"), sin tocar `navOffsetClase` ni el alto de la barra.

test('altoLogoNavMovilClase(false) = el alto de barra (64px, pt-16/h-16) MENOS 2×aire — 40px', () => {
  assert.equal(navOffsetClase(false), 'pt-16');
  assert.equal(altoLogoNavMovilClase(false), 'h-[40px]');
  assert.equal(40, 64 - 2 * AIRE_VERTICAL_LOGO_MOVIL_PX, 'la aritmética que el literal de arriba debe reflejar');
});

test('altoLogoNavMovilClase(true) = los dos altos de barra de CORTE (76/88px) MENOS 2×aire — 52/64px', () => {
  assert.equal(navOffsetClase(true), 'pt-[76px] min-[640px]:pt-[88px] cortenav:pt-[88px]');
  assert.equal(altoLogoNavMovilClase(true), 'h-[52px] min-[640px]:h-[64px]');
  assert.equal(52, 76 - 2 * AIRE_VERTICAL_LOGO_MOVIL_PX, 'la aritmética que el literal de arriba debe reflejar');
  assert.equal(64, 88 - 2 * AIRE_VERTICAL_LOGO_MOVIL_PX, 'la aritmética que el literal de arriba debe reflejar');
});
