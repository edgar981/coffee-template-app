import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Logo } from '@/components/storefront/Logo';
import { DEFAULTS, resolverSiteContent, resolverNavWordmark, type NavWordmarkContent } from './site-content-defaults';
import { CORTE, PRESETS, PATIO, mergePresetEnContent, validarPreset, presetCompleto } from './themes';
import { contenidoConPresetDeVista } from './theme-mirador';
import { siteContentEditableSchema } from './site-content-schema';

// CORTE-LOGO-APILADO-1 — el wordmark APILADO del nav (rama `subtitle` de `Logo.tsx`, YA encendida
// por `cromo.navSubtitulo`, § CROMO-NAV-FOOTER-TEMATIZABLE-1) calza el ESTILO del `.wordmark`/
// `.wordmark small` del prototipo (`docs/prototipos/cafeone/css/app.css:199-207`): nombre en
// MAYÚSCULA con tracking, sub-encabezado en la SANS del cuerpo, muted, tracking `.11em`, SIN
// itálica. El apilado en sí NO es el trabajo de este slice — ya existía—; esto es sólo el ESTILO.
//
// Vive en su PROPIA meta (`content.navWordmark`, `NavWordmarkContent`), NO reusando
// `content.navTratamiento.activo` (§ CROMO-NAV-TRATAMIENTO-1): ese eje, ya CERRADO y afirmado por
// `cromo-nav-tratamiento.test.ts` (FUERA de `touches:` de este slice), es específicamente "¿los
// LINKS del nav (`.nav-link`) llevan mayúscula+tracking+peso?" — un elemento del DOM distinto, con
// sus PROPIOS valores medidos (`.06em`, sans del par). El wordmark es OTRO elemento (`.wordmark`)
// con SUS PROPIOS valores medidos (`.01em` en el nombre, `.11em` en el sub). Ver el docstring de
// `NavWordmarkContent` (`site-content-defaults.ts`) para el razonamiento completo.
//
// StoreNav.tsx NO se renderiza acá (usa `usePathname()`, § la misma frontera que ya documentan
// `cromo-tematizable.test.ts`/`cromo-nav-tratamiento.test.ts`). Lo que se afirma es la CAPA DE
// DATOS (`resolverNavWordmark`, el catálogo de presets, `mergePresetEnContent`) y el componente
// `Logo`, que no depende de ningún contexto de ruteo y SÍ se renderiza de verdad.

// `NAV_WORDMARK_HOY` es el navWordmark RESUELTO de hoy (lo que `resolverNavWordmark`/
// `resolverSiteContent`/`DEFAULTS` dan) — incluye `taglineColor:'atenuado'` (§ NAV-LOGO-MOVIL-CON-
// AIRE-1). `NAV_WORDMARK_RAW_HOY` es la forma CRUDA que `mergePresetEnContent` escribe —SIN
// `taglineColor`, porque ningún preset es su eje (misma familia que `navTratamiento.buscarMovil`,
// § su propio docstring: "ningún preset lo declara… nace `true` para TODO tenant", y el docstring
// de `NavWordmarkContent.taglineColor` documenta el MISMO hueco para este campo) — las dos formas
// son DISTINTAS a propósito, no un error de una de las dos.
const NAV_WORDMARK_HOY: NavWordmarkContent = { activo: false, taglineColor: 'atenuado' };
const NAV_WORDMARK_RAW_HOY = { activo: false };

// ── resolverNavWordmark — dominio CERRADO de 1+1 claves, gemelo de resolverNavTratamiento ────────

test('resolverNavWordmark: sin guardado (undefined/null/basura) → activo:false, taglineColor:atenuado (el HOY)', () => {
  assert.deepEqual(resolverNavWordmark(undefined, {}), NAV_WORDMARK_HOY);
  assert.deepEqual(resolverNavWordmark(null, {}), NAV_WORDMARK_HOY);
  assert.deepEqual(resolverNavWordmark('basura', {}), NAV_WORDMARK_HOY);
  assert.deepEqual(resolverNavWordmark({}, {}), NAV_WORDMARK_HOY);
});

test('resolverNavWordmark: un tipo equivocado (string donde va boolean) cae al default', () => {
  const r = resolverNavWordmark({ activo: 'true' }, {});
  assert.equal(r.activo, false);
});

test('resolverNavWordmark: un boolean real guardado se respeta (taglineColor sigue su propio default, sin fila)', () => {
  assert.deepEqual(resolverNavWordmark({ activo: true }, {}), { activo: true, taglineColor: 'atenuado' });
});

test('resolverNavWordmark: sin guardado, un DEFAULT explícito de `activo` manda (defensa simétrica, como resolverNavTratamiento)', () => {
  const def = { activo: true };
  assert.deepEqual(resolverNavWordmark(undefined, def), { activo: true, taglineColor: 'atenuado' });
  assert.deepEqual(resolverNavWordmark({}, def), { activo: true, taglineColor: 'atenuado' });
  // guardado presente con el TIPO correcto sigue ganando sobre el default
  assert.deepEqual(resolverNavWordmark({ activo: false }, def), { activo: false, taglineColor: 'atenuado' });
});

// ── resolverSiteContent / DEFAULTS — sin fila, byte-idéntico ────────────────────────────────────

test('DEFAULTS.navWordmark (el literal de site-content-defaults.ts) === el navWordmark de HOY', () => {
  assert.deepEqual(DEFAULTS.navWordmark, NAV_WORDMARK_HOY);
});

test('resolverSiteContent({}).navWordmark === el navWordmark de HOY (Nayoli, sin fila)', () => {
  assert.deepEqual(resolverSiteContent({}).navWordmark, NAV_WORDMARK_HOY);
});

// ── El catálogo de presets: AUSENTE = hoy exacto; sólo CORTE lo declara ─────────────────────────

test('CORTE declara navWordmarkActivo:true; los otros 5 presets del catálogo NO lo declaran (ausente, no `false`)', () => {
  assert.equal(CORTE.navWordmarkActivo, true);
  for (const preset of PRESETS) {
    if (preset.clave === 'CORTE') continue;
    assert.equal(preset.navWordmarkActivo, undefined, `${preset.clave} no debe declarar navWordmarkActivo`);
  }
});

test('validarPreset(CORTE) sigue devolviendo [] (completo) — el eje nuevo es opcional, no rompe la completitud', () => {
  assert.deepEqual(validarPreset(CORTE), []);
  assert.ok(presetCompleto(CORTE));
});

test('mergePresetEnContent: CORTE escribe `content.navWordmark.activo:true` — SIN taglineColor (no es eje de preset, § NAV_WORDMARK_RAW_HOY)', () => {
  const out = mergePresetEnContent(DEFAULTS as unknown as Record<string, unknown>, CORTE);
  assert.deepEqual(out.navWordmark, { activo: true });
});

test('mergePresetEnContent: PATIO no declara el eje — la meta queda en su default de HOY (false), crudo', () => {
  assert.equal(PATIO.navWordmarkActivo, undefined);
  const out = mergePresetEnContent(DEFAULTS as unknown as Record<string, unknown>, PATIO);
  assert.deepEqual(out.navWordmark, NAV_WORDMARK_RAW_HOY);
});

test('mergePresetEnContent: los otros 5 presets escriben `content.navWordmark` = el de HOY crudo (sin taglineColor), byte-idéntico', () => {
  for (const preset of PRESETS) {
    if (preset.clave === 'CORTE') continue;
    const out = mergePresetEnContent(DEFAULTS as unknown as Record<string, unknown>, preset);
    assert.deepEqual(out.navWordmark, NAV_WORDMARK_RAW_HOY, `${preset.clave} debe dejar navWordmark en su default de hoy`);
  }
});

// ── El mirador (`?tema=CORTE`) — la vista de sólo-lectura que ejerce la cadena completa ─────────

test('sin ?tema= (mirador con clave undefined): Nayoli no cambia — navWordmark sigue en false', () => {
  const nayoli = resolverSiteContent({});
  const sinTema = contenidoConPresetDeVista(nayoli, undefined);
  assert.equal(sinTema, nayoli, 'byte-idéntico: la misma referencia, ni un campo tocado');
  assert.equal(sinTema.navWordmark.activo, false);
});

test('?tema=CORTE sobre Nayoli: navWordmark.activo pasa a true', () => {
  const nayoli = resolverSiteContent({});
  const conCorte = contenidoConPresetDeVista(nayoli, 'CORTE');
  assert.equal(conCorte.navWordmark.activo, true);
});

// ── siteContentEditableSchema — `navWordmark` es DEFENSIVO (§65-B), gemelo de `navTratamiento` ───

test('navWordmark: un objeto válido SOBREVIVE al parse (si no, zod lo descartaría al guardar)', () => {
  const parsed = siteContentEditableSchema.parse({ navWordmark: { activo: true } });
  assert.deepEqual(parsed.navWordmark, { activo: true });
});

test('navWordmark: un TIPO equivocado se rechaza (el write es estricto; el resolver SOFT es la red aparte)', () => {
  assert.throws(() => siteContentEditableSchema.parse({ navWordmark: { activo: 'true' } }));
});

test('navWordmark: ausente no rompe el parse (es opcional, como las otras metas)', () => {
  const parsed = siteContentEditableSchema.parse({});
  assert.equal(parsed.navWordmark, undefined);
});

// ── `navWordmark.taglineColor` (§ NAV-LOGO-MOVIL-CON-AIRE-1) — MISMO patrón de `navDrawerMovil.
// variante`/`carrito.variante`: `z.enum` de 2 miembros, declarado para que un futuro write general
// no lo STRIPPEE en silencio (§65-B).

test('navWordmark.taglineColor: "atenuado"/"acento" SOBREVIVEN al parse', () => {
  assert.deepEqual(
    siteContentEditableSchema.parse({ navWordmark: { activo: true, taglineColor: 'atenuado' } }).navWordmark,
    { activo: true, taglineColor: 'atenuado' },
  );
  assert.deepEqual(
    siteContentEditableSchema.parse({ navWordmark: { activo: true, taglineColor: 'acento' } }).navWordmark,
    { activo: true, taglineColor: 'acento' },
  );
});

test('navWordmark.taglineColor: un valor fuera del set CERRADO se rechaza (el write es estricto)', () => {
  assert.throws(() => siteContentEditableSchema.parse({ navWordmark: { taglineColor: 'dorado' } }));
});

test('navWordmark.taglineColor: ausente no rompe el parse — es opcional, como `activo`', () => {
  const parsed = siteContentEditableSchema.parse({ navWordmark: { activo: true } });
  assert.deepEqual(parsed.navWordmark, { activo: true });
});

// ── El COMPONENTE `Logo` — la rama `subtitle`, ESTILO por `wordmarkTratado` ─────────────────────
//
// Cadenas medidas por EJECUCIÓN (`renderToStaticMarkup`), no transcritas a mano — igual que
// `cromo-tematizable.test.ts` mide el HTML de la rama `subtitle` sin tratamiento.
//
// § MARCA-LOGO-IMAGEN-1 agregó `min-w-0` al `<div>` raíz (layout-only, sin efecto de píxel — § el
// docstring de `Logo.tsx`) y un SEGUNDO `<span>` oculto (`aria-hidden`, el MEDIDOR del ajuste) +
// un ajuste CONDICIONAL POR ESTADO en el `<span>` visible del nombre, para que un nombre de
// negocio largo nunca se parta en dos líneas (§ `NombreEncogible`). El ajuste se decide en
// `useLayoutEffect`, que NO corre en `renderToStaticMarkup` — así que estas cadenas, medidas
// contra ese render estático, siguen sin las clases de recorte en el `<span>` visible (`ajuste`
// nace `null`); el medidor SÍ aparece siempre (es parte fija del markup), pero está oculto
// (`invisible`, fuera del árbol de accesibilidad).

test('Logo CON subtitle, SIN wordmarkTratado (todo tenant salvo CORTE): HTML idéntico al de HOY + el medidor oculto', () => {
  const html = renderToStaticMarkup(
    React.createElement(Logo, { nombre: 'Café Nayoli', subtitle: 'San Adolfo · Huila' }),
  );
  assert.equal(
    html,
    '<div class="flex min-w-0 items-center gap-2.5"><span class="flex min-w-0 flex-col leading-none">'
      + '<span aria-hidden="true" class="font-display text-[22px] leading-none text-[var(--sf-tinta)] pointer-events-none invisible absolute whitespace-nowrap">Café Nayoli</span>'
      + '<span class="font-display text-[22px] leading-none text-[var(--sf-tinta)]">Café Nayoli</span>'
      + '<span class="mt-0.5 font-display text-[11px] italic text-[var(--sf-tostado-5)]">San Adolfo · Huila</span>'
      + '</span></div>',
  );
});

test('Logo CON subtitle Y wordmarkTratado (CORTE, variant="light"): nombre en mayúscula+tracking+30px, sub en sans muted sin itálica', () => {
  const html = renderToStaticMarkup(
    React.createElement(Logo, { nombre: 'Café Nayoli', subtitle: 'San Adolfo · Huila', wordmarkTratado: true }),
  );
  assert.equal(
    html,
    '<div class="flex min-w-0 items-center gap-2.5"><span class="flex min-w-0 flex-col leading-none">'
      + '<span aria-hidden="true" class="font-display uppercase tracking-[0.01em] text-[30px] leading-none text-[var(--sf-tinta)] pointer-events-none invisible absolute whitespace-nowrap">Café Nayoli</span>'
      + '<span class="font-display uppercase tracking-[0.01em] text-[30px] leading-none text-[var(--sf-tinta)]">Café Nayoli</span>'
      + '<span class="mt-1 font-inter font-normal tracking-[0.11em] text-[11px] text-[var(--sf-tinta)]/60">San Adolfo · Huila</span>'
      + '</span></div>',
  );
});

test('Logo CON subtitle Y wordmarkTratado, variant="dark" (el estado real del nav de CORTE, siempre sobre tinta): el color del nombre y el sub SIGUEN tomando --sf-sobre-tinta', () => {
  const html = renderToStaticMarkup(
    React.createElement(Logo, { nombre: 'Café Nayoli', subtitle: 'San Adolfo · Huila', wordmarkTratado: true, variant: 'dark' }),
  );
  assert.ok(html.includes('text-[var(--sf-sobre-tinta,var(--sf-fondo))]">Café Nayoli'), 'el nombre tratado conserva el color correcto por variante');
  assert.ok(html.includes('text-[var(--sf-sobre-tinta,var(--sf-fondo))]/60">San Adolfo'), 'el sub muted es el MISMO token del nombre, atenuado al 60%, no un color nuevo');
  assert.doesNotMatch(html, /italic/, 'sin itálica, aunque esté tratado');
});

test('Logo SIN subtitle, con wordmarkTratado=true: no hay rama `subtitle` que tratar — HTML idéntico al de HOY + el medidor oculto', () => {
  const html = renderToStaticMarkup(React.createElement(Logo, { nombre: 'Café Nayoli', wordmarkTratado: true }));
  assert.equal(
    html,
    '<div class="flex min-w-0 items-center gap-2.5">'
      + '<span aria-hidden="true" class="font-display text-[22px] leading-none text-[var(--sf-tinta)] pointer-events-none invisible absolute whitespace-nowrap">Café Nayoli</span>'
      + '<span class="font-display text-[22px] leading-none text-[var(--sf-tinta)]">Café Nayoli</span>'
      + '</div>',
  );
});

test('Logo `stacked` (el footer) con wordmarkTratado=true: NO SE TOCA — el sub sigue font-display itálico --sf-tostado-5', () => {
  const html = renderToStaticMarkup(
    React.createElement(Logo, { nombre: 'Café Nayoli', subtitle: 'San Adolfo · Huila', stacked: true, wordmarkTratado: true }),
  );
  assert.equal(
    html,
    '<div class="flex min-w-0 flex-col items-center gap-3"><div class="flex min-w-0 max-w-full flex-col items-center gap-0.5">'
      + '<span aria-hidden="true" class="font-display text-2xl text-[var(--sf-tinta)] pointer-events-none invisible absolute whitespace-nowrap">Café Nayoli</span>'
      + '<span class="font-display text-2xl text-[var(--sf-tinta)]">Café Nayoli</span>'
      + '<span class="font-display text-[13px] italic text-[var(--sf-tostado-5)]">San Adolfo · Huila</span>'
      + '</div></div>',
  );
});

// ── `taglineColor` (§ NAV-LOGO-MOVIL-CON-AIRE-1) — EJECUTADO a través del componente REAL, no sólo
// de `colorTaglineAcento`/`usaColorAcento` en aislado (§ marca-logo.test.ts): esto prueba que
// `Logo.tsx` efectivamente los CONECTA al render, para las dos ramas (tratada/sin tratar) y las
// dos variantes (light/dark).

test('taglineColor ausente (default "atenuado"): HTML IDÉNTICO a los dos tests de arriba — byte a byte, Onix/Nayoli no cambian', () => {
  const tratado = renderToStaticMarkup(
    React.createElement(Logo, { nombre: 'Café Nayoli', subtitle: 'San Adolfo · Huila', wordmarkTratado: true }),
  );
  assert.ok(tratado.includes('<span class="mt-1 font-inter font-normal tracking-[0.11em] text-[11px] text-[var(--sf-tinta)]/60">San Adolfo · Huila</span>'));
  const sinTratar = renderToStaticMarkup(
    React.createElement(Logo, { nombre: 'Café Nayoli', subtitle: 'San Adolfo · Huila' }),
  );
  assert.ok(sinTratar.includes('<span class="mt-0.5 font-display text-[11px] italic text-[var(--sf-tostado-5)]">San Adolfo · Huila</span>'));
});

test('taglineColor="acento", variant="dark" (tratado): el sub cae a --sf-tostado-5 literal, en vez de `${wordmark}/60` — SIN itálica (sigue sans, sólo cambia el color)', () => {
  const html = renderToStaticMarkup(
    React.createElement(Logo, { nombre: 'Café Nayoli', subtitle: 'San Adolfo · Huila', wordmarkTratado: true, variant: 'dark', taglineColor: 'acento' }),
  );
  assert.ok(html.includes('<span class="mt-1 font-inter font-normal tracking-[0.11em] text-[11px] text-[var(--sf-tostado-5)]">San Adolfo · Huila</span>'));
  assert.doesNotMatch(html, /italic/, 'el color cambia, la itálica no vuelve');
});

test('taglineColor="acento", variant="light" (tratado): el piso de contraste falla con tostado-5 (2.54:1 medido) — cae al TOKEN derivado --sf-tagline-acento-claro, con respaldo --sf-tostado-5 (§ TAGLINE-DORADO-DERIVADO-1, corrige TAGLINE-DORADO-PROFUNDO-1: el literal #a16336 de CORTE se retira, generalizado por tenant; DEVIATION — este archivo no estaba en `touches:` de ese slice, pero sus dos assertions sobre el literal retirado quedarían falsas sin este ajuste, § "Regla del libro: el que crea una capacidad cuenta sus consumidores" del propio spec)', () => {
  const html = renderToStaticMarkup(
    React.createElement(Logo, { nombre: 'Café Nayoli', subtitle: 'San Adolfo · Huila', wordmarkTratado: true, variant: 'light', taglineColor: 'acento' }),
  );
  assert.ok(html.includes('<span class="mt-1 font-inter font-normal tracking-[0.11em] text-[11px] text-[var(--sf-tagline-acento-claro,var(--sf-tostado-5))]">San Adolfo · Huila</span>'));
});

test('taglineColor="acento", SIN wordmarkTratado (sin tratar), variant="dark": sigue en --sf-tostado-5 — mismo literal que "atenuado" acá, LA ITÁLICA SE CONSERVA (sólo el color cambia, § el docstring de BloqueNombreTagline)', () => {
  const html = renderToStaticMarkup(
    React.createElement(Logo, { nombre: 'Café Nayoli', subtitle: 'San Adolfo · Huila', variant: 'dark', taglineColor: 'acento' }),
  );
  assert.ok(html.includes('<span class="mt-0.5 font-display text-[11px] italic text-[var(--sf-tostado-5)]">San Adolfo · Huila</span>'));
});

test('taglineColor="acento", SIN wordmarkTratado, variant="light": el piso también aplica fuera de la rama tratada — cae al TOKEN derivado --sf-tagline-acento-claro (§ TAGLINE-DORADO-DERIVADO-1, corrige TAGLINE-DORADO-PROFUNDO-1), itálica conservada', () => {
  const html = renderToStaticMarkup(
    React.createElement(Logo, { nombre: 'Café Nayoli', subtitle: 'San Adolfo · Huila', variant: 'light', taglineColor: 'acento' }),
  );
  assert.ok(html.includes('<span class="mt-0.5 font-display text-[11px] italic text-[var(--sf-tagline-acento-claro,var(--sf-tostado-5))]">San Adolfo · Huila</span>'));
});

test('taglineColor="acento" SIN subtitle: no hay nada que colorear — HTML idéntico al de siempre (usaColorAcento da false)', () => {
  const html = renderToStaticMarkup(
    React.createElement(Logo, { nombre: 'Café Nayoli', wordmarkTratado: true, taglineColor: 'acento' }),
  );
  assert.equal(
    html,
    '<div class="flex min-w-0 items-center gap-2.5">'
      + '<span aria-hidden="true" class="font-display text-[22px] leading-none text-[var(--sf-tinta)] pointer-events-none invisible absolute whitespace-nowrap">Café Nayoli</span>'
      + '<span class="font-display text-[22px] leading-none text-[var(--sf-tinta)]">Café Nayoli</span>'
      + '</div>',
  );
});

test('taglineColor="acento" en `stacked` (el footer): NO SE TOCA, mismo precedente que wordmarkTratado — sigue --sf-tostado-5 itálico', () => {
  const html = renderToStaticMarkup(
    React.createElement(Logo, { nombre: 'Café Nayoli', subtitle: 'San Adolfo · Huila', stacked: true, wordmarkTratado: true, taglineColor: 'acento' }),
  );
  assert.ok(html.includes('<span class="font-display text-[13px] italic text-[var(--sf-tostado-5)]">San Adolfo · Huila</span>'));
});
