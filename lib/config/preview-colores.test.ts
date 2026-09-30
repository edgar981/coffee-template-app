import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SECCIONES_TIENDA } from '@/components/admin/tienda-secciones';
import { resolverSiteContent, DEFAULTS, type TemaContent, type EsquemasContent, type BandaId } from './site-content-defaults';
import { PRESETS, mergePresetEnContent } from './themes';
import { RAICES_DEFECTO, derivarPaleta } from './palette-derive';
import { cssPaleta } from './palette-style';
import { cssFuentes } from './fuentes-style';
import { cssForma } from './forma-style';
import { esquemaStyle, varsDeTienda } from './esquema-style';

// EL CENSO MEDIDO (§ PANEL-PREVIEW-COLORES-REALES-1) — el owner reportó que casi todos los preview de
// `/admin/tienda` pintaban colores que NO correspondían a los de la página publicada (con CORTE
// aplicado). Este archivo compara, SECCIÓN POR SECCIÓN, las vars CSS que la vista previa del panel
// pintaría (`varsDeTienda`, § esquema-style.ts) contra las que la PÁGINA REAL pintaría —usando las
// MISMAS funciones que consumen `app/(storefront)/layout.tsx` (`cssPaleta`/`cssFuentes`/`cssForma`) y
// `app/(storefront)/page.tsx` (`esquemaStyle`, por banda)—, para CADA `SeccionVista` y CADA preset del
// catálogo (Nayoli/control incluido).
//
// ANTES DE ESTE SLICE, este censo habría fallado en CASI TODAS las secciones bajo cualquier tema
// NO-fábrica: `VistaTiendaEnVivo.tsx` sólo aplicaba las 8 vars de `esquemaStyleDeBanda` —nunca la
// paleta completa (con sus EJES), ni la fuente, ni la forma—, así que todo lo que un componente lee
// fuera de esas 8 caía SIEMPRE al literal de FÁBRICA de `app/globals.css` (la paleta de Nayoli), sea
// cual sea el tema real. Y `PaletaSeccion.tsx` (`FragmentoTienda`) componía la paleta completa a mano
// pero SIN `ejes` — byte-idéntico salvo bajo CORTE (el único preset que los declara).
//
// EL DISCRIMINADOR ES EL VALOR, NO LA PRESENCIA DE LA CLAVE: un test que sólo verificara "la vista
// previa también setea `--sf-banda`" habría pasado con el código viejo (`esquemaStyleDeBanda` SÍ
// corría) sin atrapar el defecto real (los otros ~30 tokens, wrong). Por eso se compara VALOR por
// VALOR con `assert.deepEqual` contra el mapa REAL completo.

/** Parsea el texto `:root{--a:b;--c:d}` de un `<style>` server-rendered a un mapa clave→valor. `null`
 *  (sin `<style>`, el caso fábrica de `cssPaleta`/`cssFuentes`/`cssForma`) → `{}`. */
function parseRoot(css: string | null): Record<string, string> {
  if (!css) return {};
  const cuerpo = css.replace(/^:root\{/, '').replace(/\}$/, '');
  const out: Record<string, string> = {};
  for (const par of cuerpo.split(';')) {
    if (!par) continue;
    const i = par.indexOf(':');
    out[par.slice(0, i)] = par.slice(i + 1);
  }
  return out;
}

/** El content resuelto de aplicar `clave` (o ninguno) — MISMO viaje que `aplicarPreset` persistiría
 *  (mismo helper que ya usa `admin-tienda-preset.test.ts`; no se importa de ahí — cada archivo de
 *  test es autocontenido, el patrón ya establecido en ese archivo). `clave: null` = el control
 *  (Nayoli, sin preset). */
function contenidoDePreset(clave: string | null) {
  const preset = clave ? PRESETS.find((p) => p.clave === clave) : null;
  if (clave && !preset) throw new Error(`preset desconocido: ${clave}`);
  return resolverSiteContent(preset ? mergePresetEnContent({}, preset) : {});
}

/** Las vars que la PÁGINA REAL del storefront pondría para `tema`/`esquemas`/`bandaId` — la MISMA
 *  composición que hace `app/(storefront)/layout.tsx` (root: `cssPaleta`+`cssFuentes`+`cssForma`) y
 *  `app/(storefront)/page.tsx` (por-banda: `esquemaStyle`), con las funciones REALES de producción —
 *  nunca una copia de su lógica. Fábrica (`cssPaleta` devuelve `null`, sin `<style>`) cae al literal
 *  de `globals.css`, que ES `derivarPaleta(RAICES_DEFECTO)` (§ RAICES_DEFECTO, palette-derive.ts) —
 *  se sustituye a mano porque esta función SÍ necesita el VALOR concreto (no puede confiar en la
 *  cascada de un `<style>` ausente, como sí puede la página real). */
function varsRealesDePagina(tema: TemaContent, esquemas: EsquemasContent, bandaId: BandaId | undefined): Record<string, string> {
  const ejes = { origenTexto: tema.origenTexto ?? undefined, origenAccion: tema.origenAccion ?? undefined };
  const paletaCss = cssPaleta(tema.fondo, tema.tinta, tema.acento, ejes);
  const paleta = paletaCss
    ? parseRoot(paletaCss)
    : Object.fromEntries(Object.entries(derivarPaleta(RAICES_DEFECTO)).map(([k, v]) => [`--sf-${k}`, v]));
  const fuente = parseRoot(cssFuentes(tema.fuentePar));
  const forma = parseRoot(cssForma(tema.forma));
  const banda = bandaId ? esquemaStyle(esquemas[bandaId], tema.fondo, tema.tinta, tema.acento, ejes) : {};
  return { ...paleta, ...fuente, ...forma, ...banda };
}

const CLAVES = [null, ...PRESETS.map((p) => p.clave)] as const;

// ─── LA RED — cada SeccionVista × cada preset (incluido Nayoli) ────────────────────────────────────

for (const clave of CLAVES) {
  const etiqueta = clave ?? 'Nayoli (control, sin preset)';
  const content = contenidoDePreset(clave);
  const { tema, esquemas } = content;

  for (const config of SECCIONES_TIENDA) {
    test(`${etiqueta} · ${config.seccion}: la vista previa (varsDeTienda) pinta las MISMAS vars que la página real`, () => {
      const real = varsRealesDePagina(tema, esquemas, config.bandaId);
      const preview = varsDeTienda(tema, esquemas, config.bandaId);
      assert.deepEqual(preview, real, `${etiqueta} · ${config.seccion}: el preview diverge de la página real`);
    });
  }
}

// ─── PaletaSeccion (FragmentoTienda) — la MISMA comparación, con raíces YA resueltas (nunca null) ──
//
// `FragmentoTienda` no recibe `tema.fondo/tinta/acento` nullable: recibe `raices: Form`, ya resuelto a
// `RAICES_DEFECTO` cuando es fábrica (§ `PaletaSeccion.cargar`/`raizValida`). El `temaSintetico` que
// arma internamente (§ PaletaSeccion.tsx) es justamente eso — se reproduce acá para afirmar que su
// resultado coincide con la página real, sin bandaId (esta pieza no vive dentro de una banda).

test('control + CADA preset: FragmentoTienda (PaletaSeccion) deriva las MISMAS vars que la página real', () => {
  for (const clave of CLAVES) {
    const { tema, esquemas } = contenidoDePreset(clave);
    const raices = tema.fondo ? { fondo: tema.fondo, tinta: tema.tinta!, acento: tema.acento! } : RAICES_DEFECTO;
    const temaSintetico: TemaContent = { ...tema, fondo: raices.fondo, tinta: raices.tinta, acento: raices.acento };
    const real = varsRealesDePagina(tema, esquemas, undefined);
    const preview = varsDeTienda(temaSintetico);
    assert.deepEqual(preview, real, `${clave ?? 'Nayoli'}: FragmentoTienda debe coincidir con la página real`);
  }
});

// ─── NAYOLI QUEDA BYTE-IDÉNTICA (§ requisito del spec) ─────────────────────────────────────────────

test('Nayoli (fábrica, sin preset): varsDeTienda produce EXACTAMENTE los 32 valores de derivarPaleta(RAICES_DEFECTO) — el preview no inventa un color que globals.css no tenga', () => {
  const preview = varsDeTienda(DEFAULTS.tema, DEFAULTS.esquemas);
  const esperado = Object.fromEntries(Object.entries(derivarPaleta(RAICES_DEFECTO)).map(([k, v]) => [`--sf-${k}`, v]));
  assert.deepEqual(preview, esperado);
});

// ─── EL DEFECTO QUE ESTO CIERRA — visto fallar contra el mecanismo VIEJO (sólo esquemaStyleDeBanda) ─
//
// Reproduce el cálculo que `VistaTiendaEnVivo.tsx` hacía ANTES de este slice (sólo las 8 vars de
// `esquemaStyleDeBanda`, sin paleta/fuente/forma) y confirma que bajo CORTE diverge del real en la
// mayoría de las secciones — la firma exacta del reporte del owner. No se re-importa el código viejo
// (ya no existe): se reconstruye la MISMA llamada que hacía, `esquemaStyle(...)` a secas.

test('EL DEFECTO QUE ESTO CIERRA: el mecanismo VIEJO (sólo esquemaStyle por banda) diverge de la página real bajo CORTE, en casi todas las secciones', () => {
  const { tema, esquemas } = contenidoDePreset('CORTE');
  const ejes = { origenTexto: tema.origenTexto ?? undefined, origenAccion: tema.origenAccion ?? undefined };
  let divergen = 0;
  for (const config of SECCIONES_TIENDA) {
    const real = varsRealesDePagina(tema, esquemas, config.bandaId);
    const viejo = config.bandaId ? esquemaStyle(esquemas[config.bandaId], tema.fondo, tema.tinta, tema.acento, ejes) : {};
    const iguales = Object.keys(real).length === Object.keys(viejo).length
      && Object.entries(real).every(([k, v]) => viejo[k] === v);
    if (!iguales) divergen++;
  }
  assert.ok(divergen >= SECCIONES_TIENDA.length - 1, `esperaba que casi todas (${SECCIONES_TIENDA.length} secciones) divergieran con el mecanismo viejo bajo CORTE; sólo ${divergen} lo hicieron`);
});
