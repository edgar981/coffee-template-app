import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Logo } from '@/components/storefront/Logo';
import {
  DEFAULTS,
  resolverSiteContent,
  resolverCromo,
  type CromoContent,
} from '@/lib/config/site-content-defaults';
import {
  PRESETS,
  CORTE,
  validarPreset,
  mergePresetEnContent,
} from '@/lib/config/themes';
import { siteContentEditableSchema } from '@/lib/config/site-content-schema';

// § CROMO-NAV-FOOTER-TEMATIZABLE-1. La superficie es "el cromo del prototipo" — el nav como banda
// tinta con logotipo serif crema, sub-encabezado y badge de cosecha — disponible por PRESET
// (`CromoContent`, `content.cromo`), con default = el cromo de HOY.
//
// StoreNav.tsx NO se renderiza acá: usa `usePathname()` (`next/navigation`), que fuera de un árbol
// real de Next.js devuelve `null` y no `'/'` — medido con `renderToStaticMarkup` antes de escribir
// este archivo (`.scratch/try-storenav.ts`, no versionado): revienta en `pathname.startsWith(...)`,
// una línea AJENA a este slice. Es la misma frontera que ya documenta el repo para `*.test.tsx`
// (§ CLAUDE.md, "los tests de COMPONENTE necesitan jsdom, que el repo no tiene"). Lo que SÍ se
// afirma acá es la CAPA DE DATOS que gobierna a StoreNav (byte a byte, `navBandaTinta =
// cromo.navTinta` es un pass-through directo — verificable por lectura, sin necesitar el render) y
// el componente `Logo`, que no depende de ningún contexto de ruteo y SÍ se renderiza de verdad.

const CROMO_HOY: CromoContent = { navTinta: false, navSubtitulo: false, navBadge: '' };

// ── resolverCromo — dominio CERRADO de 3 claves, gemelo de resolverPaginas ──────────────────────

test('resolverCromo: sin guardado (undefined/null/basura) → el cromo de HOY exacto', () => {
  assert.deepEqual(resolverCromo(undefined, {}), CROMO_HOY);
  assert.deepEqual(resolverCromo(null, {}), CROMO_HOY);
  assert.deepEqual(resolverCromo('basura', {}), CROMO_HOY);
  assert.deepEqual(resolverCromo({}, {}), CROMO_HOY);
});

test('resolverCromo: un tipo equivocado por clave (string donde va boolean, número donde va string) cae al default de esa clave, no al de las otras', () => {
  const r = resolverCromo({ navTinta: 'true', navSubtitulo: true, navBadge: 42 }, {});
  assert.equal(r.navTinta, false, 'navTinta: "true" (string) no es un boolean → default');
  assert.equal(r.navSubtitulo, true, 'navSubtitulo: boolean real → se respeta');
  assert.equal(r.navBadge, '', 'navBadge: 42 (number) no es un string → default');
});

test('resolverCromo: valores del TIPO correcto se respetan tal cual', () => {
  assert.deepEqual(
    resolverCromo({ navTinta: true, navSubtitulo: true, navBadge: 'Cosecha 2026' }, {}),
    { navTinta: true, navSubtitulo: true, navBadge: 'Cosecha 2026' },
  );
});

test('resolverCromo: sin guardado, un DEFAULT explícito manda (defensa simétrica, como resolverTema)', () => {
  const def = { navTinta: true, navSubtitulo: true, navBadge: 'x' };
  assert.deepEqual(resolverCromo(undefined, def), def);
  assert.deepEqual(resolverCromo({}, def), def);
  // guardado presente con el TIPO correcto sigue ganando sobre el default
  assert.deepEqual(resolverCromo({ navBadge: 'y' }, def), { navTinta: true, navSubtitulo: true, navBadge: 'y' });
});

// ── resolverSiteContent — sin fila, el cromo cae al de HOY (byte-idéntico) ──────────────────────

test('resolverSiteContent({}).cromo === el cromo de HOY (Nayoli, sin fila)', () => {
  assert.deepEqual(resolverSiteContent({}).cromo, CROMO_HOY);
});

test('DEFAULTS.cromo (el literal de site-content-defaults.ts) === el cromo de HOY', () => {
  assert.deepEqual(DEFAULTS.cromo, CROMO_HOY);
});

// ── El catálogo de presets: AUSENTE = hoy exacto; sólo CORTE lo declara ─────────────────────────

test('CORTE declara los 3 ejes; los otros 5 presets del catálogo NO los declaran (ausentes, no `false`/`""`)', () => {
  assert.equal(CORTE.navTinta, true);
  assert.equal(CORTE.navSubtitulo, true);
  assert.equal(CORTE.navBadge, 'Cosecha 2026');

  for (const preset of PRESETS) {
    if (preset.clave === 'CORTE') continue;
    assert.equal(preset.navTinta, undefined, `${preset.clave} no debe declarar navTinta`);
    assert.equal(preset.navSubtitulo, undefined, `${preset.clave} no debe declarar navSubtitulo`);
    assert.equal(preset.navBadge, undefined, `${preset.clave} no debe declarar navBadge`);
  }
});

test('mergePresetEnContent: CORTE escribe `content.cromo` con sus 3 valores medidos contra el prototipo', () => {
  const out = mergePresetEnContent(DEFAULTS as unknown as Record<string, unknown>, CORTE);
  assert.deepEqual(out.cromo, { navTinta: true, navSubtitulo: true, navBadge: 'Cosecha 2026' });
});

test('mergePresetEnContent: los otros 5 presets escriben `content.cromo` = el cromo de HOY, byte-idéntico', () => {
  for (const preset of PRESETS) {
    if (preset.clave === 'CORTE') continue;
    const out = mergePresetEnContent(DEFAULTS as unknown as Record<string, unknown>, preset);
    assert.deepEqual(out.cromo, CROMO_HOY, `${preset.clave} debe dejar el cromo en su default de hoy`);
  }
});

test('validarPreset(CORTE) sigue devolviendo [] (completo) — los 3 ejes nuevos son opcionales, no rompen la completitud', () => {
  assert.deepEqual(validarPreset(CORTE), []);
});

// ── Logo — el ÚNICO componente de esta superficie renderizable sin contexto de ruteo ────────────
// Sin `subtitle` (el default en TODO caller salvo que `cromo.navSubtitulo` sea `true`), el HTML es
// BYTE-IDÉNTICO al de antes de este slice — medido contra `git show HEAD:components/storefront/
// Logo.tsx` (la rama sin `subtitle` no cambió un carácter) y confirmado por render.

test('Logo SIN subtitle: HTML idéntico al de HOY (Nayoli, y todo tenant que no declare navSubtitulo)', () => {
  const html = renderToStaticMarkup(React.createElement(Logo, { nombre: 'Café Nayoli' }));
  assert.equal(
    html,
    '<div class="flex items-center gap-2.5"><span class="font-display text-[22px] leading-none text-[var(--sf-tinta)]">Café Nayoli</span></div>',
  );
});

test('Logo CON subtitle (§ CROMO-NAV-FOOTER-TEMATIZABLE-1, cromo.navSubtitulo): el nombre y el tagline aparecen los DOS, sin perder el nombre', () => {
  const html = renderToStaticMarkup(React.createElement(Logo, { nombre: 'Finca San Adolfo', subtitle: 'San Adolfo · Huila' }));
  assert.ok(html.includes('Finca San Adolfo'));
  assert.ok(html.includes('San Adolfo · Huila'));
  assert.ok(html.includes('flex flex-col'), 'el sub-encabezado envuelve nombre+tagline en su propio bloque vertical');
});

test('Logo CON subtitle VACÍO ("") se comporta como AUSENTE — no cuelga un sub-encabezado vacío', () => {
  const html = renderToStaticMarkup(React.createElement(Logo, { nombre: 'Café Nayoli', subtitle: '' }));
  assert.equal(
    html,
    '<div class="flex items-center gap-2.5"><span class="font-display text-[22px] leading-none text-[var(--sf-tinta)]">Café Nayoli</span></div>',
  );
});

test('Logo variant="dark" (§1, el texto claro que el nav ya usa sobre banda oscura) + subtitle: los dos ejes conviven sin pisarse', () => {
  const html = renderToStaticMarkup(
    React.createElement(Logo, { nombre: 'Café Nayoli', variant: 'dark', subtitle: 'Origen Huila' }),
  );
  assert.ok(html.includes('text-[var(--sf-sobre-tinta,var(--sf-fondo))]'), 'el wordmark sigue tomando el color claro de variant="dark"');
  assert.ok(html.includes('Origen Huila'));
});

// ── siteContentEditableSchema — `cromo` es DEFENSIVO (§65-B), gemelo de `esquemas`/`orden` ─────

test('cromo: un objeto válido SOBREVIVE al parse (si no, zod lo descartaría al guardar)', () => {
  const parsed = siteContentEditableSchema.parse({ cromo: { navTinta: true, navSubtitulo: true, navBadge: 'Cosecha 2026' } });
  assert.deepEqual(parsed.cromo, { navTinta: true, navSubtitulo: true, navBadge: 'Cosecha 2026' });
});

test('cromo: parcial (una sola clave) sobrevive — el schema no exige las 3 a la vez', () => {
  const parsed = siteContentEditableSchema.parse({ cromo: { navBadge: 'x' } });
  assert.deepEqual(parsed.cromo, { navBadge: 'x' });
});

test('cromo: un TIPO equivocado por clave se rechaza (el write es estricto; el resolver SOFT es la red aparte)', () => {
  assert.throws(() => siteContentEditableSchema.parse({ cromo: { navTinta: 'true' } }));
  assert.throws(() => siteContentEditableSchema.parse({ cromo: { navBadge: 42 } }));
});

test('cromo: ausente no rompe el parse (es opcional, como las otras metas)', () => {
  const parsed = siteContentEditableSchema.parse({});
  assert.equal(parsed.cromo, undefined);
});
