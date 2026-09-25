import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULTS, resolverSiteContent, resolverNavDrawerMovil, type NavDrawerMovilContent } from './site-content-defaults';
import { CORTE, PRESETS, PATIO, mergePresetEnContent, validarPreset, presetCompleto } from './themes';
import { contenidoConPresetDeVista } from './theme-mirador';
import { siteContentEditableSchema } from './site-content-schema';

// MUESTRARIO-DRAWER-MOVIL-TEMA-1 — el drawer de navegación MÓVIL gana su propio eje de VARIANTE:
// el dropdown angosto de HOY (`motion.div` bajo el header, sin cabecera propia ni escalonado) o la
// composición de PANTALLA COMPLETA del prototipo (`.mobile-nav`, cabecera con wordmark+cerrar, links
// con entrada escalonada por `--i`). Vive en su PROPIA meta (`content.navDrawerMovil`,
// `NavDrawerMovilContent`), NO como un campo de `cromo`/`navTratamiento`/`navWordmark`: esos tres
// ejes declaran EXPLÍCITAMENTE (en sus propios docstrings, y en el comentario del bloque "Mobile
// Menu" de `StoreNav.tsx`) que NO gobiernan el drawer móvil — acotan al header DESKTOP fijo/al
// `.nav-link` siempre visible. `lib/config/cromo-tematizable.test.ts` (FUERA de `touches:` de este
// slice) confirma por EJECUCIÓN que `cromo` sigue siendo EXACTAMENTE 3 claves pese al eje nuevo. Ver
// el docstring de `NavDrawerMovilContent` (`site-content-defaults.ts`) para el razonamiento completo.
//
// A DIFERENCIA de `navTratamiento`/`navWordmark` (un booleano), acá el valor es una VARIANTE de un
// set CERRADO de 2 (`'dropdown'`/`'pantallaCompleta'`) — mismo patrón de validación que
// `origenTexto`/`origenAccion` de `resolverTema`, no un booleano ON/OFF: las dos composiciones son
// FORMAS ENTERAS distintas del mismo elemento, no un ajuste sobre una forma que ya existe.
//
// StoreNav.tsx NO se renderiza acá — usa `usePathname()` (`next/navigation`), que fuera de un árbol
// real de Next.js devuelve `null` y no `'/'`, y revienta en `pathname.startsWith(...)` (la MISMA
// frontera que ya documentan `cromo-tematizable.test.ts`/`cromo-nav-tratamiento.test.ts`). Lo que se
// afirma acá es la CAPA DE DATOS que gobierna a StoreNav: el despacho
// `navDrawerMovil.variante === 'pantallaCompleta'` es un pass-through directo sobre el campo que este
// archivo sí puede verificar por lectura.

const DRAWER_MOVIL_HOY: NavDrawerMovilContent = { variante: 'dropdown' };

// ── resolverNavDrawerMovil — dominio CERRADO de 1 clave (un set de 2 valores), gemelo de
//    resolverNavTratamiento/resolverNavWordmark, con la validación de resolverTema (set cerrado) ──

test('resolverNavDrawerMovil: sin guardado (undefined/null/basura) → variante:"dropdown" (el HOY)', () => {
  assert.deepEqual(resolverNavDrawerMovil(undefined, {}), DRAWER_MOVIL_HOY);
  assert.deepEqual(resolverNavDrawerMovil(null, {}), DRAWER_MOVIL_HOY);
  assert.deepEqual(resolverNavDrawerMovil('basura', {}), DRAWER_MOVIL_HOY);
  assert.deepEqual(resolverNavDrawerMovil({}, {}), DRAWER_MOVIL_HOY);
});

test('resolverNavDrawerMovil: un valor fuera del set cerrado (string ajeno) cae al default', () => {
  const r = resolverNavDrawerMovil({ variante: 'sidebar' }, {});
  assert.equal(r.variante, 'dropdown');
});

test('resolverNavDrawerMovil: un tipo equivocado (number donde va string) cae al default', () => {
  const r = resolverNavDrawerMovil({ variante: 42 }, {});
  assert.equal(r.variante, 'dropdown');
});

test('resolverNavDrawerMovil: un valor del set cerrado guardado se respeta', () => {
  assert.deepEqual(resolverNavDrawerMovil({ variante: 'pantallaCompleta' }, {}), { variante: 'pantallaCompleta' });
});

test('resolverNavDrawerMovil: sin guardado, un DEFAULT explícito del set cerrado manda (defensa simétrica, como resolverCromo)', () => {
  const def = { variante: 'pantallaCompleta' };
  assert.deepEqual(resolverNavDrawerMovil(undefined, def), def);
  assert.deepEqual(resolverNavDrawerMovil({}, def), def);
  // guardado presente con el TIPO/SET correcto sigue ganando sobre el default
  assert.deepEqual(resolverNavDrawerMovil({ variante: 'dropdown' }, def), { variante: 'dropdown' });
});

test('resolverNavDrawerMovil: un DEFAULT fuera del set cerrado (basura) cae al "dropdown" fijo, no a la basura', () => {
  const def = { variante: 'sidebar' };
  assert.deepEqual(resolverNavDrawerMovil(undefined, def), { variante: 'dropdown' });
});

// ── resolverSiteContent / DEFAULTS — sin fila, byte-idéntico ────────────────────────────────────

test('DEFAULTS.navDrawerMovil (el literal de site-content-defaults.ts) === el navDrawerMovil de HOY', () => {
  assert.deepEqual(DEFAULTS.navDrawerMovil, DRAWER_MOVIL_HOY);
});

test('resolverSiteContent({}).navDrawerMovil === el navDrawerMovil de HOY (Nayoli, sin fila)', () => {
  assert.deepEqual(resolverSiteContent({}).navDrawerMovil, DRAWER_MOVIL_HOY);
});

// ── El catálogo de presets: AUSENTE = hoy exacto; sólo CORTE lo declara ─────────────────────────

test('CORTE declara navDrawerMovilVariante:"pantallaCompleta"; los otros 5 presets del catálogo NO lo declaran (ausente, no "dropdown")', () => {
  assert.equal(CORTE.navDrawerMovilVariante, 'pantallaCompleta');
  for (const preset of PRESETS) {
    if (preset.clave === 'CORTE') continue;
    assert.equal(preset.navDrawerMovilVariante, undefined, `${preset.clave} no debe declarar navDrawerMovilVariante`);
  }
});

test('validarPreset(CORTE) sigue devolviendo [] (completo) — el eje nuevo es opcional, no rompe la completitud', () => {
  assert.deepEqual(validarPreset(CORTE), []);
  assert.ok(presetCompleto(CORTE));
});

test('mergePresetEnContent: CORTE escribe `content.navDrawerMovil.variante:"pantallaCompleta"`', () => {
  const out = mergePresetEnContent(DEFAULTS as unknown as Record<string, unknown>, CORTE);
  assert.deepEqual(out.navDrawerMovil, { variante: 'pantallaCompleta' });
});

test('mergePresetEnContent: PATIO no declara el eje — la meta queda en su default de HOY ("dropdown")', () => {
  assert.equal(PATIO.navDrawerMovilVariante, undefined);
  const out = mergePresetEnContent(DEFAULTS as unknown as Record<string, unknown>, PATIO);
  assert.deepEqual(out.navDrawerMovil, { variante: 'dropdown' });
});

test('mergePresetEnContent: los otros 5 presets escriben `content.navDrawerMovil` = el de HOY, byte-idéntico', () => {
  for (const preset of PRESETS) {
    if (preset.clave === 'CORTE') continue;
    const out = mergePresetEnContent(DEFAULTS as unknown as Record<string, unknown>, preset);
    assert.deepEqual(out.navDrawerMovil, DRAWER_MOVIL_HOY, `${preset.clave} debe dejar navDrawerMovil en su default de hoy`);
  }
});

// ── El mirador (`?tema=CORTE`) — la vista de sólo-lectura que ejerce la cadena completa ─────────

test('sin ?tema= (mirador con clave undefined): Nayoli no cambia — navDrawerMovil sigue en "dropdown"', () => {
  const nayoli = resolverSiteContent({});
  const sinTema = contenidoConPresetDeVista(nayoli, undefined);
  assert.equal(sinTema, nayoli, 'byte-idéntico: la misma referencia, ni un campo tocado');
  assert.equal(sinTema.navDrawerMovil.variante, 'dropdown');
});

test('?tema=CORTE sobre Nayoli: navDrawerMovil.variante pasa a "pantallaCompleta"', () => {
  const nayoli = resolverSiteContent({});
  const conCorte = contenidoConPresetDeVista(nayoli, 'CORTE');
  assert.equal(conCorte.navDrawerMovil.variante, 'pantallaCompleta');
});

// ── La CAPA DE DATOS que gobierna a StoreNav — pass-through directo, verificable sin render ─────

test('la capa de datos: navDrawerMovil.variante="dropdown" → StoreNav rinde el panel angosto de HOY (el HOY exacto)', () => {
  const variante = resolverSiteContent({}).navDrawerMovil.variante;
  assert.equal(variante === 'pantallaCompleta', false);
});

test('la capa de datos: navDrawerMovil.variante="pantallaCompleta" (CORTE) → StoreNav rinde la composición de pantalla completa', () => {
  const conCorte = contenidoConPresetDeVista(resolverSiteContent({}), 'CORTE');
  assert.equal(conCorte.navDrawerMovil.variante === 'pantallaCompleta', true);
});

// ── `cromo`/`navTratamiento` siguen SIN gobernar el drawer — independencia de ejes, afirmada ────
// El spec de este slice ordena explícitamente NO tocar `cromo`/`navTratamiento`/`navWordmark`: sus
// docstrings dicen que no gobiernan el drawer móvil, y eso sigue siendo cierto. Esto lo afirma por
// EJECUCIÓN: un preset que enciende `navTinta`/`navTratamientoActivo` SIN declarar
// `navDrawerMovilVariante` dice deja el drawer en su default — la independencia de los ejes es
// mecánica, no sólo una promesa en un comentario.

test('un preset que enciende cromo.navTinta/navTratamiento.activo SIN declarar navDrawerMovilVariante deja el drawer en "dropdown"', () => {
  const presetSintetico = { ...CORTE, navDrawerMovilVariante: undefined };
  const out = mergePresetEnContent(DEFAULTS as unknown as Record<string, unknown>, presetSintetico);
  assert.equal((out.cromo as { navTinta: boolean }).navTinta, true, 'cromo.navTinta sigue encendido');
  assert.equal((out.navTratamiento as { activo: boolean }).activo, true, 'navTratamiento.activo sigue encendido');
  assert.equal((out.navDrawerMovil as { variante: string }).variante, 'dropdown', 'el drawer NO sigue a cromo/navTratamiento');
});

// ── siteContentEditableSchema — `navDrawerMovil` es DEFENSIVO (§65-B), gemelo de `navTratamiento` ─

test('navDrawerMovil: un objeto válido SOBREVIVE al parse (si no, zod lo descartaría al guardar)', () => {
  const parsed = siteContentEditableSchema.parse({ navDrawerMovil: { variante: 'pantallaCompleta' } });
  assert.deepEqual(parsed.navDrawerMovil, { variante: 'pantallaCompleta' });
});

test('navDrawerMovil: un valor FUERA del set cerrado se rechaza (el write es estricto; el resolver SOFT es la red aparte)', () => {
  assert.throws(() => siteContentEditableSchema.parse({ navDrawerMovil: { variante: 'sidebar' } }));
  assert.throws(() => siteContentEditableSchema.parse({ navDrawerMovil: { variante: 42 } }));
});

test('navDrawerMovil: ausente no rompe el parse (es opcional, como las otras metas)', () => {
  const parsed = siteContentEditableSchema.parse({});
  assert.equal(parsed.navDrawerMovil, undefined);
});
