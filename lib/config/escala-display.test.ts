import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import HeroSection from '@/components/storefront/home/HeroSection';
import GrindChooser from '@/components/storefront/home/GrindChooser';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { DEFAULTS } from './site-content-defaults';
import {
  fontSizeDisplay,
  resolverEscalaDisplay,
  CLAVES_ESCALA_DISPLAY,
  type ClaveEscalaDisplay,
} from './escala-display';

// LA INVARIANTE (§ TEMAS-ESCALA-DISPLAY-1): "SIN declarar escala, cada titular rinde el MISMO
// font-size que hoy, en cada breakpoint." `fontSizeDisplay(null, rol)` es la señal de "no
// override" — el llamador no aplica ningún `style`, así que el elemento sigue rindiendo la clase
// Tailwind que ya tenía. Los valores de esa clase (2.25rem/3rem/3.75rem para `text-4xl`/
// `sm:text-5xl`/`lg:text-6xl`) están MEDIDOS contra `node_modules/tailwindcss/theme.css`, no
// asumidos — se afirman acá para que la conexión "undefined == byte-idéntico" quede auditable, no
// implícita.
const TAILWIND_TEXT_REM: Record<string, number> = {
  'text-3xl': 1.875,
  'text-4xl': 2.25,
  'text-5xl': 3,
  'text-6xl': 3.75,
  'text-7xl': 4.5,
};

test('sin escala declarada (null), no hay override — el hero sigue rindiendo su clase de hoy', () => {
  assert.equal(fontSizeDisplay(null, 'xl'), undefined);
  // El hero de HeroFicha/HeroMedia es `text-4xl sm:text-5xl lg:text-6xl` (medido en el componente,
  // § TEMAS-ESCALA-DISPLAY-1): sin override, esos tres valores son los que rinden.
  assert.equal(TAILWIND_TEXT_REM['text-4xl'], 2.25);
  assert.equal(TAILWIND_TEXT_REM['text-5xl'], 3);
  assert.equal(TAILWIND_TEXT_REM['text-6xl'], 3.75);
});

test('sin escala declarada (null), no hay override — la sección sigue rindiendo su clase de hoy', () => {
  assert.equal(fontSizeDisplay(null, 'l'), undefined);
  // Las secciones NO comparten una sola base (medido): featured/presentaciones son `text-3xl
  // sm:text-4xl`, brandStory es `text-4xl sm:text-5xl`, subscriptionCTA es `text-4xl` fijo,
  // testimonials es `text-3xl` fijo. `fontSizeDisplay(null, 'l')` es `undefined` para las CUATRO
  // — nunca replica ninguna de esas bases, porque no hay una sola base que replicar.
  assert.equal(TAILWIND_TEXT_REM['text-3xl'], 1.875);
  assert.equal(TAILWIND_TEXT_REM['text-4xl'], 2.25);
});

test("con escala 'amplia', el hero emite el clamp display-xl medido del prototipo", () => {
  assert.equal(fontSizeDisplay('amplia', 'xl'), 'clamp(72px, 9vw, 168px)');
});

test("con escala 'amplia', la sección emite el clamp display-l medido del prototipo", () => {
  assert.equal(fontSizeDisplay('amplia', 'l'), 'clamp(48px, 5vw, 76px)');
});

test('resolverEscalaDisplay: SOFT — sólo el único miembro del set cerrado sobrevive', () => {
  assert.equal(resolverEscalaDisplay('amplia'), 'amplia');
  assert.equal(resolverEscalaDisplay(undefined), null);
  assert.equal(resolverEscalaDisplay(null), null);
  assert.equal(resolverEscalaDisplay(''), null);
  assert.equal(resolverEscalaDisplay('ENORME'), null);
  assert.equal(resolverEscalaDisplay(42), null);
});

test('CLAVES_ESCALA_DISPLAY es el set cerrado real que fontSizeDisplay/resolverEscalaDisplay sirven', () => {
  assert.deepEqual(CLAVES_ESCALA_DISPLAY, ['amplia']);
  for (const clave of CLAVES_ESCALA_DISPLAY as ClaveEscalaDisplay[]) {
    assert.equal(typeof fontSizeDisplay(clave, 'xl'), 'string');
    assert.equal(typeof fontSizeDisplay(clave, 'l'), 'string');
  }
});

// ── LA VERIFICACIÓN DE EXTREMO A EXTREMO — el WIRING, no sólo la función pura ───────────────────
//
// Todo lo de arriba prueba `fontSizeDisplay` aislada. Esto renderiza los componentes REALES —
// `renderToStaticMarkup`, el mismo mecanismo que ya usa `site-content-defaults.test.ts` para
// `GrindChooser` (sin jsdom, sin *.test.tsx: SSR puro corre en Node) — para probar que el `style`
// condicional realmente llega al DOM (o realmente NO llega, que es la mitad que hace a Nayoli
// byte-idéntica). `HeroSection`/`GrindChooser` son los DISPATCHERS reales de `app/(storefront)/
// page.tsx`, así que esto ejercita el mismo árbol que sirve producción, no una copia.
function renderConEscala(
  Componente: React.ComponentType<{ style?: React.CSSProperties }>,
  seccion: Record<string, unknown>,
  escalaDisplay: ClaveEscalaDisplay | null,
): string {
  const content = {
    ...DEFAULTS,
    ...seccion,
    tema: { ...DEFAULTS.tema, escalaDisplay },
  };
  // El objeto con `children` (en vez del 3er argumento de `createElement`) es el que exige el tipo
  // de `SiteContentProvider` (`{ value: SiteContentData; children: ReactNode }`) — mismo patrón que
  // `renderGrindChooser` en `site-content-defaults.test.ts`, y con el MISMO costo: dispara
  // `react/no-children-prop` de eslint, ya aceptado ahí (pre-existente, fuera de `touches` arreglarlo).
  return renderToStaticMarkup(
    React.createElement(SiteContentProvider, {
      value: content,
      children: React.createElement(Componente),
    }),
  );
}

test('WIRING — HeroSection (variante "media", la de CORTE): sin escala, el h1 NO lleva font-size inline; con "amplia", lleva el clamp exacto', () => {
  const seccion = { hero: { ...DEFAULTS.hero, variante: 'media' } };

  const sinEscala = renderConEscala(HeroSection, seccion, null);
  assert.doesNotMatch(sinEscala, /<h1[^>]*style="[^"]*font-size/, 'sin escala, el h1 no debe llevar font-size inline');

  const conEscala = renderConEscala(HeroSection, seccion, 'amplia');
  assert.match(conEscala, /<h1[^>]*style="[^"]*font-size:clamp\(72px, ?9vw, ?168px\)/);
});

test('WIRING — HeroSection (variante "curtina", la canónica/Nayoli): sin escala, byte-idéntica; con "amplia", el MISMO clamp del hero (independiente de la variante)', () => {
  const seccion = { hero: { ...DEFAULTS.hero, variante: 'curtina' } };

  const sinEscala = renderConEscala(HeroSection, seccion, null);
  assert.doesNotMatch(sinEscala, /<h1[^>]*style="[^"]*font-size/);

  const conEscala = renderConEscala(HeroSection, seccion, 'amplia');
  assert.match(conEscala, /<h1[^>]*style="[^"]*font-size:clamp\(72px, ?9vw, ?168px\)/);
});

test('WIRING — GrindChooser (variante "riel", la de CORTE): sin escala, el h2 NO lleva font-size inline; con "amplia", lleva el clamp display-l', () => {
  const seccion = { presentaciones: { ...DEFAULTS.presentaciones, variante: 'riel' } };

  const sinEscala = renderConEscala(GrindChooser, seccion, null);
  assert.doesNotMatch(sinEscala, /<h2[^>]*style="[^"]*font-size/, 'sin escala, el h2 no debe llevar font-size inline');

  const conEscala = renderConEscala(GrindChooser, seccion, 'amplia');
  assert.match(conEscala, /<h2[^>]*style="[^"]*font-size:clamp\(48px, ?5vw, ?76px\)/);
});
