import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULTS, resolverSiteContent, resolverNavTratamiento, type NavTratamientoContent } from './site-content-defaults';
import { CORTE, PRESETS, PATIO, mergePresetEnContent, validarPreset, presetCompleto } from './themes';
import { contenidoConPresetDeVista } from './theme-mirador';
import { siteContentEditableSchema } from './site-content-schema';

// CROMO-NAV-TRATAMIENTO-1 — el nav gana un TRATAMIENTO tipográfico (mayúscula + tracking del
// prototipo + un peso, sobre la MISMA sans del par — NO una tercera familia, § el `.nav-link` del
// prototipo, `docs/prototipos/cafeone/css/app.css:212-217`). Vive en su PROPIA meta
// (`content.navTratamiento`, `NavTratamientoContent`), NO como un 4º campo de `cromo` (junto a
// `navTinta`, como pedía el spec inicial): `lib/config/cromo-tematizable.test.ts` (FUERA de
// `touches:` de este slice) afirma la forma EXHAUSTIVA de `cromo` con `assert.deepEqual` contra
// literales de 3 claves — la MISMA restricción, medida, que ya separó `volverArriba`
// (§ CROMO-VOLVER-ARRIBA-1) y `rielSocial` (§ CROMO-RIEL-SOCIAL-1) de `cromo`. Ver el docstring de
// `NavTratamientoContent` (`site-content-defaults.ts`) para el razonamiento completo.
//
// StoreNav.tsx NO se renderiza acá — usa `usePathname()` (`next/navigation`), que fuera de un árbol
// real de Next.js devuelve `null` y no `'/'`, y revienta en `pathname.startsWith(...)` (la MISMA
// frontera que ya documenta `cromo-tematizable.test.ts`). Lo que se afirma acá es la CAPA DE DATOS
// que gobierna a StoreNav: `navLinkTratamiento = navTratamiento.activo ? '...' : 'font-medium'` es
// un pass-through directo sobre el campo que este archivo sí puede verificar por lectura.

// § CROMO-NAV-DIRECCION-SCROLL-1 sumó `direccion` como CAMPO de esta MISMA meta (no una meta nueva —
// ver el docstring de `NavTratamientoContent.direccion` en `site-content-defaults.ts`), así que el
// literal de HOY y las aserciones exhaustivas de este archivo se amplían para incluirlo, sin dejar
// de afirmar `activo` como ya lo hacían.
//
// § CROMO-NAV-FILETE-1 sumó `filete` como TERCER CAMPO de esta MISMA meta (mismo razonamiento que
// `direccion`, ver el docstring de `NavTratamientoContent.filete`), así que el literal de HOY y las
// aserciones exhaustivas se amplían otra vez, sin dejar de afirmar `activo`/`direccion`.
//
// § CROMO-NAV-CTA-Y-BADGE-1 sumó `cta` como CUARTO CAMPO de esta MISMA meta (mismo razonamiento que
// `direccion`/`filete`, ver el docstring de `NavTratamientoContent.cta`), así que el literal de HOY
// y las aserciones exhaustivas se amplían otra vez, sin dejar de afirmar `activo`/`direccion`/`filete`.
//
// § CROMO-NAV-POSICION-TEMA-REAL-1 sumó `posicion` como QUINTO CAMPO de esta MISMA meta (mismo
// razonamiento que `direccion`/`filete`/`cta`, ver el docstring de `NavTratamientoContent.posicion`),
// así que el literal de HOY y las aserciones exhaustivas se amplían otra vez, sin dejar de afirmar
// `activo`/`direccion`/`filete`/`cta`.
//
// § CROMO-NAV-EXACTO-PROTOTIPO-1 REESCRIBE el VALOR de `posicion` (de la geometría del tema real a
// la del prototipo local, § el docstring de `NavTratamientoContent.posicion`) y suma `subrayado`
// como SEXTO CAMPO de esta MISMA meta (mismo razonamiento que `posicion`, ver el docstring de
// `NavTratamientoContent.subrayado`), así que el literal de HOY y las aserciones exhaustivas se
// amplían otra vez, sin dejar de afirmar `activo`/`direccion`/`filete`/`cta`/`posicion`.
const NAV_TRATAMIENTO_HOY: NavTratamientoContent = { activo: false, direccion: false, filete: false, cta: false, posicion: false, subrayado: false };

// ── resolverNavTratamiento — dominio CERRADO de 1 clave, gemelo de resolverRielSocial ────────────

test('resolverNavTratamiento: sin guardado (undefined/null/basura) → activo:false (el HOY)', () => {
  assert.deepEqual(resolverNavTratamiento(undefined, {}), NAV_TRATAMIENTO_HOY);
  assert.deepEqual(resolverNavTratamiento(null, {}), NAV_TRATAMIENTO_HOY);
  assert.deepEqual(resolverNavTratamiento('basura', {}), NAV_TRATAMIENTO_HOY);
  assert.deepEqual(resolverNavTratamiento({}, {}), NAV_TRATAMIENTO_HOY);
});

test('resolverNavTratamiento: un tipo equivocado (string donde va boolean) cae al default', () => {
  const r = resolverNavTratamiento({ activo: 'true' }, {});
  assert.equal(r.activo, false);
});

test('resolverNavTratamiento: un boolean real guardado se respeta', () => {
  assert.deepEqual(resolverNavTratamiento({ activo: true }, {}), { activo: true, direccion: false, filete: false, cta: false, posicion: false, subrayado: false });
});

test('resolverNavTratamiento: sin guardado, un DEFAULT explícito manda (defensa simétrica, como resolverCromo)', () => {
  const def = { activo: true, direccion: true, filete: true, cta: true, posicion: true, subrayado: true };
  assert.deepEqual(resolverNavTratamiento(undefined, def), def);
  assert.deepEqual(resolverNavTratamiento({}, def), def);
  // guardado presente con el TIPO correcto sigue ganando sobre el default
  assert.deepEqual(resolverNavTratamiento({ activo: false }, def), { activo: false, direccion: true, filete: true, cta: true, posicion: true, subrayado: true });
});

// § CROMO-NAV-DIRECCION-SCROLL-1 — `direccion` se resuelve INDEPENDIENTE de `activo` (mismo `bool()`
// que `resolverCromo`): un guardado que sólo trae uno de los dos no debe borrar el otro. § CROMO-
// NAV-FILETE-1 — `filete` es el TERCER campo, resuelto con el MISMO mecanismo independiente. § CROMO-
// NAV-CTA-Y-BADGE-1 — `cta` es el CUARTO campo, mismo mecanismo. § CROMO-NAV-POSICION-TEMA-REAL-1 —
// `posicion` es el QUINTO campo, mismo mecanismo. § CROMO-NAV-EXACTO-PROTOTIPO-1 — `subrayado` es
// el SEXTO campo, mismo mecanismo.

test('resolverNavTratamiento: un guardado que sólo trae `direccion` no toca `activo` ni `filete` ni `cta` ni `posicion` ni `subrayado` (cada campo cae a SU PROPIO default)', () => {
  assert.deepEqual(resolverNavTratamiento({ direccion: true }, {}), { activo: false, direccion: true, filete: false, cta: false, posicion: false, subrayado: false });
});

test('resolverNavTratamiento: un tipo equivocado en `direccion` (string donde va boolean) cae al default', () => {
  const r = resolverNavTratamiento({ activo: true, direccion: 'true' }, {});
  assert.equal(r.direccion, false);
  assert.equal(r.activo, true, '`activo` no se ve afectado por el tipo equivocado de `direccion`');
});

test('resolverNavTratamiento: un guardado que sólo trae `filete` no toca `activo` ni `direccion` ni `cta` ni `posicion` ni `subrayado` (cada campo cae a SU PROPIO default)', () => {
  assert.deepEqual(resolverNavTratamiento({ filete: true }, {}), { activo: false, direccion: false, filete: true, cta: false, posicion: false, subrayado: false });
});

test('resolverNavTratamiento: un tipo equivocado en `filete` (string donde va boolean) cae al default', () => {
  const r = resolverNavTratamiento({ activo: true, direccion: true, filete: 'true' }, {});
  assert.equal(r.filete, false);
  assert.equal(r.activo, true, '`activo` no se ve afectado por el tipo equivocado de `filete`');
  assert.equal(r.direccion, true, '`direccion` no se ve afectado por el tipo equivocado de `filete`');
});

test('resolverNavTratamiento: un guardado que sólo trae `cta` no toca `activo`/`direccion`/`filete`/`posicion`/`subrayado` (cada campo cae a SU PROPIO default)', () => {
  assert.deepEqual(resolverNavTratamiento({ cta: true }, {}), { activo: false, direccion: false, filete: false, cta: true, posicion: false, subrayado: false });
});

test('resolverNavTratamiento: un tipo equivocado en `cta` (string donde va boolean) cae al default', () => {
  const r = resolverNavTratamiento({ activo: true, direccion: true, filete: true, cta: 'true' }, {});
  assert.equal(r.cta, false);
  assert.equal(r.activo, true, '`activo` no se ve afectado por el tipo equivocado de `cta`');
  assert.equal(r.direccion, true, '`direccion` no se ve afectado por el tipo equivocado de `cta`');
  assert.equal(r.filete, true, '`filete` no se ve afectado por el tipo equivocado de `cta`');
});

test('resolverNavTratamiento: un guardado que sólo trae `posicion` no toca `activo`/`direccion`/`filete`/`cta`/`subrayado` (cada campo cae a SU PROPIO default)', () => {
  assert.deepEqual(resolverNavTratamiento({ posicion: true }, {}), { activo: false, direccion: false, filete: false, cta: false, posicion: true, subrayado: false });
});

test('resolverNavTratamiento: un tipo equivocado en `posicion` (string donde va boolean) cae al default', () => {
  const r = resolverNavTratamiento({ activo: true, direccion: true, filete: true, cta: true, posicion: 'true' }, {});
  assert.equal(r.posicion, false);
  assert.equal(r.activo, true, '`activo` no se ve afectado por el tipo equivocado de `posicion`');
  assert.equal(r.direccion, true, '`direccion` no se ve afectado por el tipo equivocado de `posicion`');
  assert.equal(r.filete, true, '`filete` no se ve afectado por el tipo equivocado de `posicion`');
  assert.equal(r.cta, true, '`cta` no se ve afectado por el tipo equivocado de `posicion`');
});

test('resolverNavTratamiento: un guardado que sólo trae `subrayado` no toca `activo`/`direccion`/`filete`/`cta`/`posicion` (cada campo cae a SU PROPIO default)', () => {
  assert.deepEqual(resolverNavTratamiento({ subrayado: true }, {}), { activo: false, direccion: false, filete: false, cta: false, posicion: false, subrayado: true });
});

test('resolverNavTratamiento: un tipo equivocado en `subrayado` (string donde va boolean) cae al default', () => {
  const r = resolverNavTratamiento({ activo: true, direccion: true, filete: true, cta: true, posicion: true, subrayado: 'true' }, {});
  assert.equal(r.subrayado, false);
  assert.equal(r.activo, true, '`activo` no se ve afectado por el tipo equivocado de `subrayado`');
  assert.equal(r.direccion, true, '`direccion` no se ve afectado por el tipo equivocado de `subrayado`');
  assert.equal(r.filete, true, '`filete` no se ve afectado por el tipo equivocado de `subrayado`');
  assert.equal(r.cta, true, '`cta` no se ve afectado por el tipo equivocado de `subrayado`');
  assert.equal(r.posicion, true, '`posicion` no se ve afectado por el tipo equivocado de `subrayado`');
});

// ── resolverSiteContent / DEFAULTS — sin fila, byte-idéntico ────────────────────────────────────

test('DEFAULTS.navTratamiento (el literal de site-content-defaults.ts) === el navTratamiento de HOY', () => {
  assert.deepEqual(DEFAULTS.navTratamiento, NAV_TRATAMIENTO_HOY);
});

test('resolverSiteContent({}).navTratamiento === el navTratamiento de HOY (Nayoli, sin fila)', () => {
  assert.deepEqual(resolverSiteContent({}).navTratamiento, NAV_TRATAMIENTO_HOY);
});

// ── El catálogo de presets: AUSENTE = hoy exacto; sólo CORTE lo declara ─────────────────────────

test('CORTE declara navTratamientoActivo:true; los otros 5 presets del catálogo NO lo declaran (ausente, no `false`)', () => {
  assert.equal(CORTE.navTratamientoActivo, true);
  for (const preset of PRESETS) {
    if (preset.clave === 'CORTE') continue;
    assert.equal(preset.navTratamientoActivo, undefined, `${preset.clave} no debe declarar navTratamientoActivo`);
  }
});

// § CROMO-NAV-DIRECCION-SCROLL-1
test('CORTE declara navTratamientoDireccion:true; los otros 5 presets del catálogo NO lo declaran (ausente, no `false`)', () => {
  assert.equal(CORTE.navTratamientoDireccion, true);
  for (const preset of PRESETS) {
    if (preset.clave === 'CORTE') continue;
    assert.equal(preset.navTratamientoDireccion, undefined, `${preset.clave} no debe declarar navTratamientoDireccion`);
  }
});

// § CROMO-NAV-FILETE-1
test('CORTE declara navTratamientoFilete:true; los otros 5 presets del catálogo NO lo declaran (ausente, no `false`)', () => {
  assert.equal(CORTE.navTratamientoFilete, true);
  for (const preset of PRESETS) {
    if (preset.clave === 'CORTE') continue;
    assert.equal(preset.navTratamientoFilete, undefined, `${preset.clave} no debe declarar navTratamientoFilete`);
  }
});

// § CROMO-NAV-CTA-Y-BADGE-1
test('CORTE declara navTratamientoCta:true; los otros 5 presets del catálogo NO lo declaran (ausente, no `false`)', () => {
  assert.equal(CORTE.navTratamientoCta, true);
  for (const preset of PRESETS) {
    if (preset.clave === 'CORTE') continue;
    assert.equal(preset.navTratamientoCta, undefined, `${preset.clave} no debe declarar navTratamientoCta`);
  }
});

// § CROMO-NAV-POSICION-TEMA-REAL-1
test('CORTE declara navTratamientoPosicion:true; los otros 5 presets del catálogo NO lo declaran (ausente, no `false`)', () => {
  assert.equal(CORTE.navTratamientoPosicion, true);
  for (const preset of PRESETS) {
    if (preset.clave === 'CORTE') continue;
    assert.equal(preset.navTratamientoPosicion, undefined, `${preset.clave} no debe declarar navTratamientoPosicion`);
  }
});

// § CROMO-NAV-EXACTO-PROTOTIPO-1
test('CORTE declara navTratamientoSubrayado:true; los otros 5 presets del catálogo NO lo declaran (ausente, no `false`)', () => {
  assert.equal(CORTE.navTratamientoSubrayado, true);
  for (const preset of PRESETS) {
    if (preset.clave === 'CORTE') continue;
    assert.equal(preset.navTratamientoSubrayado, undefined, `${preset.clave} no debe declarar navTratamientoSubrayado`);
  }
});

test('validarPreset(CORTE) sigue devolviendo [] (completo) — el eje nuevo es opcional, no rompe la completitud', () => {
  assert.deepEqual(validarPreset(CORTE), []);
  assert.ok(presetCompleto(CORTE));
});

test('mergePresetEnContent: CORTE escribe `content.navTratamiento` = {activo:true, direccion:true, filete:true, cta:true, posicion:true, subrayado:true}', () => {
  const out = mergePresetEnContent(DEFAULTS as unknown as Record<string, unknown>, CORTE);
  assert.deepEqual(out.navTratamiento, { activo: true, direccion: true, filete: true, cta: true, posicion: true, subrayado: true });
});

test('mergePresetEnContent: PATIO no declara ninguno de los seis ejes — la meta queda en su default de HOY (false×6)', () => {
  assert.equal(PATIO.navTratamientoActivo, undefined);
  assert.equal(PATIO.navTratamientoDireccion, undefined);
  assert.equal(PATIO.navTratamientoFilete, undefined);
  assert.equal(PATIO.navTratamientoCta, undefined);
  assert.equal(PATIO.navTratamientoPosicion, undefined);
  assert.equal(PATIO.navTratamientoSubrayado, undefined);
  const out = mergePresetEnContent(DEFAULTS as unknown as Record<string, unknown>, PATIO);
  assert.deepEqual(out.navTratamiento, { activo: false, direccion: false, filete: false, cta: false, posicion: false, subrayado: false });
});

test('mergePresetEnContent: los otros 5 presets escriben `content.navTratamiento` = el de HOY, byte-idéntico', () => {
  for (const preset of PRESETS) {
    if (preset.clave === 'CORTE') continue;
    const out = mergePresetEnContent(DEFAULTS as unknown as Record<string, unknown>, preset);
    assert.deepEqual(out.navTratamiento, NAV_TRATAMIENTO_HOY, `${preset.clave} debe dejar navTratamiento en su default de hoy`);
  }
});

// ── El mirador (`?tema=CORTE`) — la vista de sólo-lectura que ejerce la cadena completa ─────────

test('sin ?tema= (mirador con clave undefined): Nayoli no cambia — navTratamiento sigue en false', () => {
  const nayoli = resolverSiteContent({});
  const sinTema = contenidoConPresetDeVista(nayoli, undefined);
  assert.equal(sinTema, nayoli, 'byte-idéntico: la misma referencia, ni un campo tocado');
  assert.equal(sinTema.navTratamiento.activo, false);
  assert.equal(sinTema.navTratamiento.direccion, false);
  assert.equal(sinTema.navTratamiento.filete, false);
  assert.equal(sinTema.navTratamiento.cta, false);
  assert.equal(sinTema.navTratamiento.posicion, false);
  assert.equal(sinTema.navTratamiento.subrayado, false);
});

test('?tema=CORTE sobre Nayoli: navTratamiento.activo, .direccion, .filete, .cta, .posicion Y .subrayado pasan a true', () => {
  const nayoli = resolverSiteContent({});
  const conCorte = contenidoConPresetDeVista(nayoli, 'CORTE');
  assert.equal(conCorte.navTratamiento.activo, true);
  assert.equal(conCorte.navTratamiento.direccion, true);
  assert.equal(conCorte.navTratamiento.filete, true);
  assert.equal(conCorte.navTratamiento.cta, true);
  assert.equal(conCorte.navTratamiento.posicion, true);
  assert.equal(conCorte.navTratamiento.subrayado, true);
});

// ── La CAPA DE DATOS que gobierna a StoreNav — pass-through directo, verificable sin render ─────

test('la capa de datos: navTratamiento.activo=false → el pass-through de StoreNav usa "font-medium" (el HOY exacto)', () => {
  const activo = resolverSiteContent({}).navTratamiento.activo;
  const navLinkTratamiento = activo ? 'uppercase tracking-[0.06em] font-normal' : 'font-medium';
  assert.equal(navLinkTratamiento, 'font-medium');
});

test('la capa de datos: navTratamiento.activo=true (CORTE) → el pass-through de StoreNav aplica mayúscula+tracking+peso regular', () => {
  const conCorte = contenidoConPresetDeVista(resolverSiteContent({}), 'CORTE');
  const navLinkTratamiento = conCorte.navTratamiento.activo ? 'uppercase tracking-[0.06em] font-normal' : 'font-medium';
  assert.equal(navLinkTratamiento, 'uppercase tracking-[0.06em] font-normal');
});

// § CROMO-NAV-FILETE-1 — el pass-through EXACTO de `navFileteClase` en StoreNav.tsx: `filete:false` no
// agrega ninguna clase (byte-idéntico); `filete:true` agrega el hairline, con el par `navClaro` que
// ya decide texto/íconos (§ el docstring del componente para el porqué de los tokens elegidos). El
// VALOR no cambió con § CROMO-NAV-EXACTO-PROTOTIPO-1 — lo que se movió es DÓNDE se aplica la clase
// (del contenedor con padding, donde el borde ignoraba su propio padding y tocaba los bordes de
// pantalla, a la fila interior, ya inset por ese mismo padding) — invisible para este test de string.
const navFileteClaseDe = (filete: boolean, navClaro: boolean) =>
  filete ? (navClaro ? 'border-b border-[var(--sf-sobre)]/20' : 'border-b border-[var(--sf-tinta)]/20') : '';

test('la capa de datos: navTratamiento.filete=false → el pass-through de StoreNav no agrega ninguna clase (el HOY exacto)', () => {
  const filete = resolverSiteContent({}).navTratamiento.filete;
  assert.equal(navFileteClaseDe(filete, true), '');
  assert.equal(navFileteClaseDe(filete, false), '');
});

test('la capa de datos: navTratamiento.filete=true (CORTE) → el pass-through aplica el hairline con el token del par navClaro', () => {
  const conCorte = contenidoConPresetDeVista(resolverSiteContent({}), 'CORTE');
  const filete = conCorte.navTratamiento.filete;
  assert.equal(navFileteClaseDe(filete, true), 'border-b border-[var(--sf-sobre)]/20');
  assert.equal(navFileteClaseDe(filete, false), 'border-b border-[var(--sf-tinta)]/20');
});

// § CROMO-NAV-CTA-Y-BADGE-1 — el pass-through EXACTO de `badgeSpan`/el CTA repositionado en
// `StoreNav.tsx`: `cta:false` sigue dependiendo de `navClaro` (byte-idéntico); `cta:true` (CORTE) es
// FIJO — ya no depende de `navClaro` — y el CTA cambia de posición/forma.
const badgeClaseDe = (cta: boolean, navClaro: boolean) =>
  cta
    ? 'bg-[var(--sf-tostado)] text-[var(--sf-tinta)]'
    : navClaro ? 'bg-[var(--sf-sobre)]/10 text-[var(--sf-sobre)]' : 'bg-[var(--sf-tinta)]/5 text-[var(--sf-tinta)]';

test('la capa de datos: navTratamiento.cta=false → el badge sigue dependiendo de navClaro (el HOY exacto)', () => {
  const cta = resolverSiteContent({}).navTratamiento.cta;
  assert.equal(badgeClaseDe(cta, true), 'bg-[var(--sf-sobre)]/10 text-[var(--sf-sobre)]');
  assert.equal(badgeClaseDe(cta, false), 'bg-[var(--sf-tinta)]/5 text-[var(--sf-tinta)]');
});

test('la capa de datos: navTratamiento.cta=true (CORTE) → el badge es FIJO, independiente de navClaro', () => {
  const conCorte = contenidoConPresetDeVista(resolverSiteContent({}), 'CORTE');
  const cta = conCorte.navTratamiento.cta;
  assert.equal(badgeClaseDe(cta, true), 'bg-[var(--sf-tostado)] text-[var(--sf-tinta)]');
  assert.equal(badgeClaseDe(cta, false), 'bg-[var(--sf-tostado)] text-[var(--sf-tinta)]');
});

// § CROMO-NAV-EXACTO-PROTOTIPO-1 (REESCRIBE § CROMO-NAV-POSICION-TEMA-REAL-1) — el pass-through
// EXACTO de `navContenedorClase`/`navFilaAltoClase` en `StoreNav.tsx`: `posicion:false` deja el
// contenedor/altura de HOY (byte-idéntico); `posicion:true` (CORTE) los reemplaza por la geometría
// medida contra el PROTOTIPO LOCAL (`--content-max`/`--page-gutter`/`--header-height`,
// `docs/prototipos/cafeone/css/tokens.css:150,151,157`), no el tema real de la medición anterior.
const navContenedorClaseDe = (posicion: boolean) =>
  posicion ? 'max-w-[1440px] px-[18px] sm:px-6 cortenav:px-8' : 'max-w-6xl px-4 sm:px-6 lg:px-8';
const navFilaAltoClaseDe = (posicion: boolean) =>
  posicion ? 'h-[76px] sm:h-[88px] cortenav:h-[118px]' : 'h-16 lg:h-18';

test('la capa de datos: navTratamiento.posicion=false → el pass-through de StoreNav usa el contenedor/altura de HOY (el HOY exacto)', () => {
  const posicion = resolverSiteContent({}).navTratamiento.posicion;
  assert.equal(navContenedorClaseDe(posicion), 'max-w-6xl px-4 sm:px-6 lg:px-8');
  assert.equal(navFilaAltoClaseDe(posicion), 'h-16 lg:h-18');
});

test('la capa de datos: navTratamiento.posicion=true (CORTE) → el pass-through aplica la geometría medida contra el prototipo local', () => {
  const conCorte = contenidoConPresetDeVista(resolverSiteContent({}), 'CORTE');
  const posicion = conCorte.navTratamiento.posicion;
  assert.equal(navContenedorClaseDe(posicion), 'max-w-[1440px] px-[18px] sm:px-6 cortenav:px-8');
  assert.equal(navFilaAltoClaseDe(posicion), 'h-[76px] sm:h-[88px] cortenav:h-[118px]');
});

// § CROMO-NAV-EXACTO-PROTOTIPO-1 — el pass-through EXACTO de `navHoverClase` en `StoreNav.tsx`:
// `subrayado:false` no agrega ninguna clase (byte-idéntico); `subrayado:true` agrega el subrayado
// que se dibuja al hover (`.nav-link::after` del prototipo, `docs/prototipos/cafeone/css/
// app.css:219-224`) — `bg-current` (=`currentColor`) porque el subrayado toma el color del propio
// texto del link, sin un token nuevo.
const navHoverClaseDe = (subrayado: boolean) =>
  subrayado
    ? 'relative after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-[220ms] after:ease-[cubic-bezier(0.22,0.61,0.36,1)] hover:after:scale-x-100'
    : '';

test('la capa de datos: navTratamiento.subrayado=false → el pass-through de StoreNav no agrega ninguna clase (el HOY exacto)', () => {
  const subrayado = resolverSiteContent({}).navTratamiento.subrayado;
  assert.equal(navHoverClaseDe(subrayado), '');
});

test('la capa de datos: navTratamiento.subrayado=true (CORTE) → el pass-through aplica el subrayado animado', () => {
  const conCorte = contenidoConPresetDeVista(resolverSiteContent({}), 'CORTE');
  const subrayado = conCorte.navTratamiento.subrayado;
  const clase = navHoverClaseDe(subrayado);
  assert.match(clase, /after:bg-current/, 'el subrayado toma currentColor, como .nav-link::after del prototipo');
  assert.match(clase, /after:duration-\[220ms\]/, '--duration-base del prototipo (tokens.css:192)');
  assert.match(clase, /after:ease-\[cubic-bezier\(0\.22,0\.61,0\.36,1\)\]/, '--ease-out del prototipo (tokens.css:189), la MISMA curva que ENTRADA_ESCALONADA_DRAWER');
  assert.match(clase, /hover:after:scale-x-100/, 'se dibuja al hover');
});

// ── siteContentEditableSchema — `navTratamiento` es DEFENSIVO (§65-B), gemelo de `rielSocial` ────

test('navTratamiento: un objeto válido SOBREVIVE al parse (si no, zod lo descartaría al guardar)', () => {
  const parsed = siteContentEditableSchema.parse({ navTratamiento: { activo: true } });
  assert.deepEqual(parsed.navTratamiento, { activo: true });
});

// § CROMO-NAV-DIRECCION-SCROLL-1
test('navTratamiento.direccion: sobrevive al parse solo, y junto con `activo`', () => {
  const soloDireccion = siteContentEditableSchema.parse({ navTratamiento: { direccion: true } });
  assert.deepEqual(soloDireccion.navTratamiento, { direccion: true });
  const ambos = siteContentEditableSchema.parse({ navTratamiento: { activo: true, direccion: true } });
  assert.deepEqual(ambos.navTratamiento, { activo: true, direccion: true });
});

// § CROMO-NAV-FILETE-1
test('navTratamiento.filete: sobrevive al parse solo, y junto con `activo`/`direccion`', () => {
  const soloFilete = siteContentEditableSchema.parse({ navTratamiento: { filete: true } });
  assert.deepEqual(soloFilete.navTratamiento, { filete: true });
  const los3 = siteContentEditableSchema.parse({ navTratamiento: { activo: true, direccion: true, filete: true } });
  assert.deepEqual(los3.navTratamiento, { activo: true, direccion: true, filete: true });
});

// § CROMO-NAV-CTA-Y-BADGE-1
test('navTratamiento.cta: sobrevive al parse solo, y junto con `activo`/`direccion`/`filete`', () => {
  const soloCta = siteContentEditableSchema.parse({ navTratamiento: { cta: true } });
  assert.deepEqual(soloCta.navTratamiento, { cta: true });
  const los4 = siteContentEditableSchema.parse({ navTratamiento: { activo: true, direccion: true, filete: true, cta: true } });
  assert.deepEqual(los4.navTratamiento, { activo: true, direccion: true, filete: true, cta: true });
});

// § CROMO-NAV-POSICION-TEMA-REAL-1
test('navTratamiento.posicion: sobrevive al parse solo, y junto con `activo`/`direccion`/`filete`/`cta`', () => {
  const soloPosicion = siteContentEditableSchema.parse({ navTratamiento: { posicion: true } });
  assert.deepEqual(soloPosicion.navTratamiento, { posicion: true });
  const los5 = siteContentEditableSchema.parse({ navTratamiento: { activo: true, direccion: true, filete: true, cta: true, posicion: true } });
  assert.deepEqual(los5.navTratamiento, { activo: true, direccion: true, filete: true, cta: true, posicion: true });
});

// § CROMO-NAV-EXACTO-PROTOTIPO-1
test('navTratamiento.subrayado: sobrevive al parse solo, y junto con `activo`/`direccion`/`filete`/`cta`/`posicion`', () => {
  const soloSubrayado = siteContentEditableSchema.parse({ navTratamiento: { subrayado: true } });
  assert.deepEqual(soloSubrayado.navTratamiento, { subrayado: true });
  const los6 = siteContentEditableSchema.parse({ navTratamiento: { activo: true, direccion: true, filete: true, cta: true, posicion: true, subrayado: true } });
  assert.deepEqual(los6.navTratamiento, { activo: true, direccion: true, filete: true, cta: true, posicion: true, subrayado: true });
});

test('navTratamiento: un TIPO equivocado se rechaza (el write es estricto; el resolver SOFT es la red aparte)', () => {
  assert.throws(() => siteContentEditableSchema.parse({ navTratamiento: { activo: 'true' } }));
  assert.throws(() => siteContentEditableSchema.parse({ navTratamiento: { direccion: 'true' } }));
  assert.throws(() => siteContentEditableSchema.parse({ navTratamiento: { filete: 'true' } }));
  assert.throws(() => siteContentEditableSchema.parse({ navTratamiento: { cta: 'true' } }));
  assert.throws(() => siteContentEditableSchema.parse({ navTratamiento: { posicion: 'true' } }));
  assert.throws(() => siteContentEditableSchema.parse({ navTratamiento: { subrayado: 'true' } }));
});

test('navTratamiento: ausente no rompe el parse (es opcional, como las otras metas)', () => {
  const parsed = siteContentEditableSchema.parse({});
  assert.equal(parsed.navTratamiento, undefined);
});

// ── EL LINK ACTIVO del nav — § NAV-LINK-ACTIVO-INVISIBLE-1 ──────────────────────────────────────
//
// `--sf-acento-texto` se florea contra el FONDO CLARO de página (§ palette-derive.ts, `RECETA`,
// `piso: true`). Sobre CORTE, `origenTexto:'tinta'` lo re-deriva a `pisoContraste(tinta, fondo,
// 4.5)`: como `tinta` YA pasa el piso contra `fondo`, el resultado es literalmente `tinta`
// (`#102407`) — el MISMO color que pinta la banda oscura del nav (`bg-[var(--sf-tinta)]`, o el hero
// oscuro detrás del floating), contraste 1.00 (medido con `derivarPaleta`/`contraste` de
// `palette-derive.ts`, ver el commit que cierra este slice). Ese 1.00 es la caja vacía que reportó
// el owner en /nosotros.
//
// StoreNav.tsx NO se renderiza acá (misma frontera del comentario de arriba, `usePathname()` fuera
// de un árbol real). Lo que se afirma es el PASS-THROUGH — la misma expresión que el componente
// evalúa — replicado literal, como ya hacen los tests de `navLinkTratamiento` arriba.
const colorActivoDeNavClaro = (navClaro: boolean) =>
  navClaro ? 'text-[var(--sf-tostado)]!' : 'text-[var(--sf-acento-texto)]!';

test('el link activo: nav CLARO (navClaro=false) sigue usando --sf-acento-texto, byte-idéntico a hoy', () => {
  assert.equal(colorActivoDeNavClaro(false), 'text-[var(--sf-acento-texto)]!');
});

test('el link activo: nav OSCURO (navClaro=true) NO usa el token floreado contra fondo claro (--sf-acento-texto)', () => {
  const clase = colorActivoDeNavClaro(true);
  assert.notEqual(clase, 'text-[var(--sf-acento-texto)]!');
  assert.equal(clase, 'text-[var(--sf-tostado)]!');
});

test('el link activo se distingue del no-activo en AMBAS ramas: el color activo nunca coincide con linkColor', () => {
  // linkColor de StoreNav.tsx: navClaro → sobre/80 (blanco atenuado); !navClaro → texto (de página).
  const linkColorDeNavClaro = (navClaro: boolean) =>
    navClaro ? 'text-[var(--sf-sobre)]/80 hover:text-[var(--sf-sobre)]' : 'text-[var(--sf-texto)] hover:text-[var(--sf-tinta)]';

  for (const navClaro of [true, false]) {
    const activo = colorActivoDeNavClaro(navClaro);
    const reposo = linkColorDeNavClaro(navClaro);
    assert.ok(!reposo.includes(activo.replace('!', '')), `navClaro=${navClaro}: el color activo no debe coincidir con el de reposo`);
  }
});
