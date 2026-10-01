import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import MenuSeccion from '@/components/admin/MenuSeccion';
import PaletaSeccion, { FragmentoTienda, type Form } from '@/components/admin/PaletaSeccion';
import { SiteSettingsProvider } from '@/components/admin/SiteSettingsProvider';
import type { SiteSettings } from '@/lib/config/site-settings';
import { SECCIONES_TIENDA } from '@/components/admin/tienda-secciones';
import BrandStory from '@/components/storefront/home/BrandStory';
import Spotlight from '@/components/storefront/home/Spotlight';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { PreviewProvider } from '@/components/storefront/PreviewMode';
import { VistaTiendaContenido } from '@/components/admin/VistaTiendaEnVivo';

import { resolverSiteContent, DEFAULTS, BANDA_IDS, type SiteContentData } from './site-content-defaults';
import { PRESETS, mergePresetEnContent } from './themes';
import { RAICES_DEFECTO } from './palette-derive';
import { esquemaStyleDeBanda } from './esquema-style';

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

/** Las raíces/fuente/forma/ejes que `PaletaSeccion.cargar()` derivaría de `content.tema` — mismo
 *  mapeo que `raizValida`/`resolverFuentePar`/`resolverForma`/los dos `setOrigen*` en
 *  `PaletaSeccion.tsx` (§ PANEL-PREVIEW-COLORES-REALES-1): un preset SIEMPRE escribe las 3 raíces
 *  JUNTAS (nunca una suelta, § `mergePresetEnContent`), así que "fondo nulo" es el único caso
 *  fábrica — el control, sin preset. `ejes` es SÓLO LECTURA (PaletaSeccion no los edita, § el
 *  docstring de `FragmentoTienda`): de los 6 presets del catálogo, sólo CORTE los declara. */
function propsDeContenido(content: ReturnType<typeof contenidoDePreset>): Pick<Parameters<typeof FragmentoTienda>[0], 'raices' | 'fuentePar' | 'forma' | 'ejes'> {
  const { tema } = content;
  const raices: Form = tema.fondo ? { fondo: tema.fondo, tinta: tema.tinta!, acento: tema.acento! } : RAICES_DEFECTO;
  const ejes = { origenTexto: tema.origenTexto ?? undefined, origenAccion: tema.origenAccion ?? undefined };
  return { raices, fuentePar: tema.fuentePar, forma: tema.forma, ejes };
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

// ─── EL CENSO bandaId (§ HISTORIA-COMO-MUESTRARIO-1) — la vista previa pinta con el esquema REAL ──
//
// EL DEFECTO MEDIDO: `VistaTiendaEnVivo` montaba `<Comp />` SIN `style`, así que una banda con
// esquema asignado (`content.esquemas[bandaId]`) —p. ej. `brandStory` bajo CORTE, 'neutro'— caía
// SIEMPRE al fallback `--sf-tinta` de FÁBRICA (`app/globals.css`), el "lienzo de Nayoli" que el
// owner reportó viendo en el panel aunque el tenant activo fuera otro. El fix es `SeccionConfig.
// bandaId` (§ tienda-secciones.ts) + `esquemaStyleDeBanda` (§ esquema-style.ts) aplicados en
// `VistaTiendaEnVivo` — pero `VistaTiendaEnVivo` envuelve SIEMPRE en `EscalaDesktop`, que en SSR
// (sin ResizeObserver real) nunca monta sus children (`paneW` arranca en 0 y nunca sube) — el MISMO
// límite por el que este archivo ya prueba `FragmentoTienda` DIRECTO, sin `EscalaDesktop` (§ el
// comentario de cabecera, arriba). Por eso el censo se afirma en DOS PARTES que SÍ son SSR-seguras:
// el MAPEO (dato puro, sin React) y la APLICACIÓN del estilo sobre el componente REAL (sin
// EscalaDesktop de por medio) — la pieza de `VistaTiendaEnVivo` que queda sin ejercer por este
// límite es sólo el PASO de esas dos props, ya sin lógica propia que pueda romperse en silencio.

test('CENSO: toda SeccionVista de una banda del home declara su bandaId; las de /nosotros y /suscripciones NO — esas páginas nunca llaman a esquemaStyle', () => {
  const CON_BANDA_PROPIA: Record<string, string> = {
    hero: 'hero', marquesina: 'marquesina', trustBadges: 'trustBadges', brandStory: 'brandStory',
    origen: 'origen', presentaciones: 'presentaciones', subscriptionCTA: 'subscriptionCTA',
    testimonials: 'testimonials',
    spotlight: 'featured', // variante que ocupa el slot de la banda 'featured', no tiene bandaId propio
  };
  for (const config of SECCIONES_TIENDA) {
    const esperado = CON_BANDA_PROPIA[config.seccion];
    if (esperado) {
      assert.equal(config.bandaId, esperado, `${config.seccion} debe declarar bandaId:'${esperado}'`);
      assert.ok((BANDA_IDS as readonly string[]).includes(config.bandaId!), `${config.bandaId} debe ser un BandaId real de BANDA_IDS`);
    } else {
      assert.equal(config.bandaId, undefined, `${config.seccion} vive en /nosotros o /suscripciones — sin bandaId a propósito, § el censo`);
    }
  }
});

test('EL ESTILO APLICADO: BrandStory(style=esquemaStyleDeBanda(…)) pinta la banda con el ESQUEMA real de CORTE, no el fallback de fábrica — la pieza exacta que VistaTiendaEnVivo monta en <Comp style={…}>', () => {
  const content = contenidoDePreset('CORTE');
  const { tema, esquemas } = content;
  assert.equal(esquemas.brandStory, 'neutro', 'CORTE asigna neutro a brandStory (§ themes.ts) — si esto cambia, el resto del test no prueba lo que dice');

  const style = esquemaStyleDeBanda('brandStory', esquemas, tema);
  assert.ok(style['--sf-banda'], 'con esquema asignado, esquemaStyleDeBanda debe emitir --sf-banda');

  const html = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: content, children: React.createElement<{ style?: React.CSSProperties }>(BrandStory, { style: style as React.CSSProperties }) }),
  );
  assert.ok(
    html.includes(`--sf-banda:${style['--sf-banda']}`),
    'el <section> de BrandStory debe llevar el --sf-banda REAL de CORTE en su style inline, no el genérico',
  );

  // EL CONTRASTE — sin bandaId/esquemas/tema (el comportamiento de ANTES de este slice, y el de
  // cualquier sección sin banda), el mismo componente NO lleva ningún --sf-banda en su style: cae al
  // fallback de clase (`var(--sf-banda,var(--sf-tinta))`), que es justo el defecto que se cierra.
  const sinEsquema = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: DEFAULTS, children: React.createElement<{ style?: React.CSSProperties }>(BrandStory, { style: {} }) }),
  );
  assert.ok(!sinEsquema.includes('--sf-banda:'), 'sin esquema, el section no lleva --sf-banda inline — cae al fallback de clase, el defecto de antes');
});

// ─── ADMIN-TIENDA-CARTPROVIDER-PREVIEW-1 — el crash real: `/admin/tienda` tiraba "This page
// couldn't load" (`Uncaught Error: useCartStore must be used within CartProvider`) al abrir el
// muestrario. `Spotlight.tsx` llama `useCartStore()` SIN CONDICIÓN, antes de cualquier
// early-return de visibilidad/catálogo (§ el propio código, `Spotlight.tsx:52`), y ese hook hace
// `throw` sin un `CartProvider` ancestro (`lib/cartStore.tsx`) — `VistaTiendaEnVivo.tsx` montaba
// `<Comp>` sin uno.
//
// EL LÍMITE de este carril, heredado de `spotlight-cableado.test.ts` (§ su propio comentario de
// cabecera): `Spotlight`/`Marquesina` resuelven su `catalog` en un `useEffect`
// (`getCatalog().then(setCatalog)`), y `renderToStaticMarkup` NUNCA corre efectos — es un único
// paso de render síncrono. Así que en TODO este archivo el `catalog` interno de esos componentes
// queda SIEMPRE en `[]`, sea cual sea el contenido de `SiteContent` que se les pase: no hay forma
// honesta de "sembrar" un catálogo real sin mockear el módulo (`mock.module` exige
// `--experimental-test-module-mocks`, que `npm test` no lleva y que este slice no puede agregar
// sin tocar `package.json`, fuera de `touches:` — mismo límite que ya documentó
// `cromo-carrito.test.ts`) o instalar jsdom + `act()` (el repo no los tiene, § CLAUDE.md "los tests
// de COMPONENTE necesitan jsdom, que el repo no tiene"). Por eso "un catálogo NO vacío" se afirma
// en la ÚNICA capa que SÍ es alcanzable desde SSR: los CAMPOS de `SiteContent` que la sección
// declara (`spotlight.visible`/`.productoSlug`/`.otroTamanoSlug`/`.notaPrecio` no vacíos, § abajo)
// — no el array de productos que el fetch resolvería. Esto no es una laguna de cobertura para ESTE
// bug: el `throw` de `useCartStore()` ocurre ANTES de que el catálogo importe (medido: revienta
// igual con catálogo vacío Y con `spotlight.visible:false`, los DEFAULTS — § el asiento de este
// slice en DECISIONS.md), así que cualquier contenido de `SiteContent` —vacío o lleno— ejerce la
// misma línea de código riesgosa.

/** El content resuelto de un preset (o Nayoli), con `spotlight` FORZADO a una configuración
 *  "llena" — visible, con eyebrow/título/badge/pin/talla-alterna/nota de precio no vacíos — para
 *  acercarse lo más posible a "las ramas que dependen de productos" dentro del límite de arriba: el
 *  `producto` que `Spotlight` resuelve seguirá siendo `null` (catálogo interno `[]`), así que el
 *  componente igual retorna temprano después del hook — pero es EXACTAMENTE ahí, en el hook, donde
 *  vivía el crash, y este contenido es lo más "no vacío" que el nivel de `SiteContent` permite. */
function contenidoSpotlightLleno(clave: string | null): SiteContentData {
  const base = contenidoDePreset(clave);
  return {
    ...base,
    spotlight: {
      visible: true,
      eyebrow: 'Nuestro café',
      titulo: 'Un café que cuenta su origen',
      badge: 'Edición limitada',
      productoSlug: 'cafe-narino-1kg',
      // § DESTACADO-PANEL-COMPLETO-Y-BOTONES-PDP-1 (fuera de `touches:`, deviación mecánica): el
      // tercer puntero se sumó a `SpotlightContent` y este objeto literal lo necesita para seguir
      // compilando — no cambia lo que el test afirma (sigue siendo "spotlight lleno").
      presentacionSlug: 'cafe-narino-1kg-molido',
      otroTamanoSlug: 'cafe-narino-250g',
      notaPrecio: 'COP · impuestos incluidos',
    },
  };
}

// ─── LA RED — `VistaTiendaContenido` por CADA SECCIÓN de `SECCIONES_TIENDA`, bajo CADA preset ────
//
// Es el test que faltaba: el archivo YA probaba `FragmentoTienda` (la vista previa de PALETA) por
// preset, pero nunca `VistaTiendaEnVivo`/`VistaTiendaContenido` (la vista previa de CONTENIDO,
// § TiendaSeccionEditor.tsx) — que es justo donde vivía este crash. Itera las 15 `SeccionVista` con
// el MISMO contenido/props que `TiendaSeccionEditor` les pasaría (`bandaId`, `content.esquemas`,
// `content.tema`), así que cualquier sección futura que agregue un hook sin su provider lo dice acá,
// no sólo `spotlight`.

test('control (sin preset, Nayoli): VistaTiendaContenido no tira para NINGUNA de las 15 SeccionVista', () => {
  const content = contenidoDePreset(null);
  for (const config of SECCIONES_TIENDA) {
    assert.doesNotThrow(
      () => renderToStaticMarkup(
        React.createElement(VistaTiendaContenido, {
          seccion: config.seccion,
          valor: content[config.seccion],
          bandaId: config.bandaId,
          esquemas: content.esquemas,
          tema: content.tema,
        }),
      ),
      `VistaTiendaContenido(${config.seccion}) no debe tirar bajo Nayoli (sin preset)`,
    );
  }
});

for (const preset of PRESETS) {
  test(`preset ${preset.clave}: VistaTiendaContenido no tira para NINGUNA de las 15 SeccionVista (el editor de /admin/tienda sobrevive a aplicarlo)`, () => {
    const content = contenidoDePreset(preset.clave);
    for (const config of SECCIONES_TIENDA) {
      assert.doesNotThrow(
        () => renderToStaticMarkup(
          React.createElement(VistaTiendaContenido, {
            seccion: config.seccion,
            valor: content[config.seccion],
            bandaId: config.bandaId,
            esquemas: content.esquemas,
            tema: content.tema,
          }),
        ),
        `VistaTiendaContenido(${config.seccion}) no debe tirar bajo el preset ${preset.clave}`,
      );
    }
  });
}

test('control + CADA preset: VistaTiendaContenido(spotlight) con la sección FORZADA a "llena" (visible, con pin/talla/nota) no tira — la rama que dispara el crash real en uso', () => {
  for (const clave of [null, ...PRESETS.map(p => p.clave)]) {
    const content = contenidoSpotlightLleno(clave);
    assert.doesNotThrow(
      () => renderToStaticMarkup(
        React.createElement(VistaTiendaContenido, {
          seccion: 'spotlight',
          valor: content.spotlight,
          bandaId: 'featured',
          esquemas: content.esquemas,
          tema: content.tema,
        }),
      ),
      `spotlight lleno no debe tirar (contenido: ${clave ?? 'sin preset'})`,
    );
  }
});

// ─── EL REGRESO — sin CartProvider, Spotlight SÍ tira, con o sin catálogo/contenido ──────────────
//
// Deja escrita la firma EXACTA del error que el owner reportó ("This page couldn't load" +
// `Uncaught Error: useCartStore must be used within CartProvider"), directo contra `Spotlight` (sin
// pasar por `VistaTiendaContenido`, que ya lo arregla) — mismo patrón que la prueba equivalente de
// TrustBadges, arriba. `useCartStore()` se llama ANTES de cualquier early-return, así que tira con
// CUALQUIER contenido: DEFAULTS (catálogo/visibilidad vacíos) y el spotlight "lleno" de arriba.

test('EL DEFECTO QUE ESTO CIERRA: Spotlight SIN CartProvider tira, con SiteContent vacío Y con spotlight "lleno" — la firma EXACTA del crash que el owner reportó', () => {
  const casos: Array<[string, SiteContentData]> = [
    ['DEFAULTS (catálogo vacío, spotlight.visible:false)', DEFAULTS as SiteContentData],
    ['spotlight lleno (visible:true, pin/talla/nota puestos)', contenidoSpotlightLleno(null)],
  ];
  for (const [etiqueta, content] of casos) {
    assert.throws(
      () => renderToStaticMarkup(
        React.createElement(SiteContentProvider, {
          value: content,
          children: React.createElement(PreviewProvider, null, React.createElement(Spotlight, {})),
        }),
      ),
      /useCartStore must be used within CartProvider/,
      `Spotlight sin CartProvider debería tirar (${etiqueta})`,
    );
  }
});
