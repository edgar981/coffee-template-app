import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import MenuSeccion from '@/components/admin/MenuSeccion';
import PaletaSeccion, { FragmentoTienda, type Form } from '@/components/admin/PaletaSeccion';
import { SiteSettingsProvider } from '@/components/admin/SiteSettingsProvider';
import type { SiteSettings } from '@/lib/config/site-settings';

import { resolverSiteContent } from './site-content-defaults';
import { PRESETS, mergePresetEnContent } from './themes';
import { RAICES_DEFECTO } from './palette-derive';

// ADMIN-TIENDA-ROTO-CON-PRESET-1 — el owner reportó `/admin/tienda` tirando "This page couldn't
// load" tras aplicar un preset (CORTE) desde el muestrario. Medido (§ el asiento de este slice,
// DECISIONS.md): el causante es `PaletaSeccion.tsx` (`FragmentoTienda`) montando `<TrustBadges />`
// SIN `SiteContentProvider` — `TrustBadges` ganó `useSiteContent()` en `CORTE-TRUSTBADGES-
// OCULTABLE-1` (el commit inmediatamente anterior de esta rama), que YA documentó el landmine como
// follow-up (`CORTE-TRUSTBADGES-PALETA-PROVIDER-1`, DECISIONS.md) sin poder cerrarlo — `PaletaSeccion.
// tsx` no estaba en su `touches:`. Este archivo es el test que faltaba: cierra la CLASE (cualquier
// preset futuro que rompa el editor lo dice el gate), no sólo el síntoma de hoy.
//
// EXTENSIÓN `.ts`, NO `.test.tsx` (DESVÍO del `touches:` del spec, medido contra el propio repo, no
// inventado): el glob de `npm test` es `"lib/**/*.test.ts"` — NO incluye `.tsx` (§ CLAUDE.md, "El
// glob NO incluye *.test.tsx: los tests de COMPONENTE necesitan jsdom, que el repo no tiene"). Un
// archivo `.test.tsx` en `lib/config/` NO correría bajo `npm test`/`npm run gate` — exactamente el
// hueco que este slice existe para cerrar ("que el PRÓXIMO preset que rompa el editor lo diga el
// gate"). El patrón YA establecido por una docena de archivos vecinos (`origen-banda.test.ts`,
// `corte-hero-titular.test.ts`, `marquesina-banda.test.ts`, …) es `.test.ts` + `React.createElement`
// (sin JSX) + `renderToStaticMarkup` — SSR puro, sin jsdom. Se sigue ese patrón acá; la medición
// (el glob real) gana sobre el nombre de archivo que el spec dio (§ CLAUDE.md, "cuando una medición
// contradice la instrucción, la medición gana").
//
// EL LÍMITE MEDIDO — por qué sólo `FragmentoTienda` se prueba POR PRESET: `PaletaSeccion`,
// `MenuSeccion` y `TiendaPaginas` (el default export de los TRES) arrancan en `cargando:true` y sólo
// alcanzan el contenido resuelto DESPUÉS de un `fetch` en un `useEffect` — un `useEffect` que un
// render SSR (`renderToStaticMarkup`, sin jsdom) JAMÁS ejecuta. Renderizar `<PaletaSeccion/>` a secas
// para cada preset repetiría la MISMA aserción (el esqueleto de carga) siete veces sin ejercer una
// sola línea que dependa del contenido — no habría atrapado el bug de hoy, y no atraparía el
// próximo. La ÚNICA pieza de las tres que monta componentes REALES del storefront alimentados por
// contenido DERIVABLE de un preset es `FragmentoTienda` (recibe `raices`/`fuentePar`/`forma` por
// props, no por fetch) — así que es la única con este tipo de landmine posible, y la que se
// exportó (§ PaletaSeccion.tsx) para poder recibir esos props directo, sin pasar por el fetch.
//
// `MenuSeccion`/`PaletaSeccion` (default) SÍ se renderizan, una vez cada uno, como smoke test de
// MONTAJE (¿revienta el árbol ANTES de llegar a `cargando`? — cubre un throw a nivel de módulo o de
// un hook mal usado en el primer render) — NO por preset, porque su primer render no varía con el
// contenido. `TiendaPaginas` NO se renderiza: usa `useSearchParams()` (`next/navigation`), que fuera
// de un árbol de Next real devuelve `null` y hace throw en el primer `.get()` — el MISMO límite ya
// documentado para `StoreNav.tsx` en `cromo-tematizable.test.ts`/`menu-como-dato.test.ts` (§
// CLAUDE.md, "los tests de COMPONENTE necesitan jsdom, que el repo no tiene"). `TiendaPaginas`
// tampoco monta un solo componente real del storefront (delega en `TiendaSeccionEditor`, que ya
// envuelve sus vistas en vivo con `SiteContentProvider` vía `VistaTiendaEnVivo.tsx`, fuera de
// `touches:` de este slice) — no es del tipo de landmine que este slice existe para cerrar.

const SETTINGS: SiteSettings = {
  nombre: 'Tienda de prueba',
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

/** El content resuelto de aplicar `clave` (o ninguno) — el MISMO viaje que `aplicarPreset`
 *  persistiría y que `PaletaSeccion.cargar()` leería de vuelta por `GET /api/site-content`:
 *  `mergePresetEnContent` sobre un doc vacío, resuelto por `resolverSiteContent`. `clave: null` =
 *  el control (Nayoli, sin preset — `resolverSiteContent({})`). */
function contenidoDePreset(clave: string | null) {
  const preset = clave ? PRESETS.find(p => p.clave === clave) : null;
  if (clave && !preset) throw new Error(`preset desconocido: ${clave}`);
  return resolverSiteContent(preset ? mergePresetEnContent({}, preset) : {});
}

/** Las raíces/fuente/forma que `PaletaSeccion.cargar()` derivaría de `content.tema` — mismo mapeo
 *  que `raizValida`/`resolverFuentePar`/`resolverForma` en `PaletaSeccion.tsx`: un preset SIEMPRE
 *  escribe las 3 raíces JUNTAS (nunca una suelta, § `mergePresetEnContent`), así que "fondo nulo" es
 *  el único caso fábrica — el control, sin preset. */
function propsDeContenido(content: ReturnType<typeof contenidoDePreset>): Pick<Parameters<typeof FragmentoTienda>[0], 'raices' | 'fuentePar' | 'forma'> {
  const { tema } = content;
  const raices: Form = tema.fondo ? { fondo: tema.fondo, tinta: tema.tinta!, acento: tema.acento! } : RAICES_DEFECTO;
  return { raices, fuentePar: tema.fuentePar, forma: tema.forma };
}

// ─── `FragmentoTienda` por CADA preset del catálogo + el control — LA RED DE ESTA CLASE ──────────

test('control (sin preset, Nayoli): FragmentoTienda no tira', () => {
  const content = contenidoDePreset(null);
  const html = renderToStaticMarkup(
    React.createElement(FragmentoTienda, { nombre: 'Tienda de prueba', ...propsDeContenido(content) }),
  );
  assert.ok(html.length > 0, 'debe rendir markup, no una cadena vacía');
});

for (const preset of PRESETS) {
  test(`preset ${preset.clave}: FragmentoTienda no tira (el editor de /admin/tienda sobrevive a aplicarlo)`, () => {
    const content = contenidoDePreset(preset.clave);
    const html = renderToStaticMarkup(
      React.createElement(FragmentoTienda, { nombre: 'Tienda de prueba', ...propsDeContenido(content) }),
    );
    assert.ok(html.length > 0, 'debe rendir markup, no una cadena vacía');
    // La franja de garantías (`TrustBadges`) es justo la pieza que reventaba sin su provider local:
    // con el fix, su texto DEBE aparecer (default `visible:true`, byte a byte) sea cual sea el preset.
    assert.ok(html.includes('Origen 100% colombiano'), 'TrustBadges debe rendir su franja, no quedar afuera por un throw silencioso');
  });
}

// ─── EL REGRESO — sin el provider local, TrustBadges SÍ tira, con CUALQUIER contenido ────────────
//
// No es un defecto sensible al PRESET (el preset no cambia lo que `TrustBadges` necesita): es una
// pieza real del storefront exigiendo su contexto, montada fuera de él. Se afirma directo contra
// `TrustBadges`, sin pasar por `FragmentoTienda` (que ya lo arregla), para dejar escrita la firma
// exacta del error que `/admin/tienda` mostraba como "This page couldn't load".
test('EL DEFECTO QUE ESTO CIERRA: TrustBadges SIN SiteContentProvider tira, con o sin preset aplicado', async () => {
  const { default: TrustBadges } = await import('@/components/storefront/home/TrustBadges');
  for (const clave of [null, ...PRESETS.map(p => p.clave)]) {
    assert.throws(
      () => renderToStaticMarkup(React.createElement(TrustBadges)),
      /useSiteContent\(\) fuera de <SiteContentProvider>/,
      `TrustBadges debería tirar sin provider (contenido: ${clave ?? 'sin preset'})`,
    );
  }
});

// ─── Smoke test de MONTAJE — MenuSeccion y PaletaSeccion (default), UNA vez cada uno ──────────────
//
// No por preset (§ el límite medido arriba: su primer render no depende del contenido, sólo del
// `fetch` que SSR no ejecuta) — esto cubre un throw a nivel de import/módulo o de un hook mal usado
// ANTES de llegar a `cargando`, que SÍ variaría con cualquier cambio de código (no de contenido).

test('MenuSeccion monta sin tirar (estado de carga, sin fetch resuelto)', () => {
  const html = renderToStaticMarkup(React.createElement(MenuSeccion));
  assert.ok(html.includes('Cargando'), 'debe quedar en su esqueleto de carga, no tirar');
});

test('PaletaSeccion (default) monta sin tirar, con el SiteSettingsProvider que el layout del admin ya provee', () => {
  const arbol = React.createElement(SiteSettingsProvider, { value: SETTINGS, children: React.createElement(PaletaSeccion) });
  const html = renderToStaticMarkup(arbol);
  assert.ok(html.includes('Cargando'), 'debe quedar en su esqueleto de carga, no tirar');
});
