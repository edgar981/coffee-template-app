import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), '../..');

// EL RIESGO QUE EL CENSO DEJÓ ABIERTO (§ GSAP-MARCO-CENSO-1, "pin-spacer-vs-overflow-hidden") —
// cerrado en § MOVIMIENTO-NIVEL-EDITORIAL-1. `ScrollTrigger` con `pin:true` (S02 en Proceso.tsx, S03
// en el modo horizontal de Collage.tsx) posiciona el elemento pineado de forma ABSOLUTA/FIJA contra
// su ANCESTRO de scroll más cercano — EXACTAMENTE la misma clase de riesgo que ya mordió al sticky de
// framer-motion del hero (§ DECISIONS.md, `HERO-STICKY-OVERFLOW-FIX-1`, 2026-09-29): un ancestro con
// `overflow-hidden`/`overflow-auto`/`overflow-scroll` se vuelve un SCROLL CONTAINER y el elemento
// pineado deja de anclarse contra el VIEWPORT real.
//
// MEDIDO (no supuesto): los DOS pin de este slice están auto-contenidos — `<Movimiento as="section"
// className="…overflow-hidden…">` (Proceso.tsx) y `<Movimiento as="div" className="…overflow-
// hidden…">` (Collage.tsx, disposición horizontal) llevan `overflow-hidden` SOBRE SÍ MISMOS (el
// recorte que el prototipo también quiere, § `.horizontal{overflow:hidden}`), NUNCA sobre un
// ancestro — eso es lo que hace seguro al pin. La cadena de ancestros REAL hasta el viewport es
// `app/(storefront)/layout.tsx`: el `<main>` y el `<div className="min-h-screen …">` que lo envuelve
// — grepeados acá por CONTENIDO, no supuestos, igual que `hero-marquesina.test.ts` ya grepea su
// propio wrapper. Si algún día alguien le agrega `overflow-hidden`/`-auto`/`-scroll` a cualquiera de
// los dos por otra razón (una red de seguridad visual, como pasó con el hero), este test se cae —
// que es la señal de que hay que usar `overflow-clip` en su lugar (§ el fix del hero), no `hidden`.
const LAYOUT = readFileSync(join(RAIZ, 'app/(storefront)/layout.tsx'), 'utf8');
const PAGE = readFileSync(join(RAIZ, 'app/(storefront)/page.tsx'), 'utf8');

const SIN_OVERFLOW_SCROLL = /overflow-(hidden|auto|scroll)/;

test('app/(storefront)/layout.tsx: ni el wrapper de la tienda ni `<main>` llevan overflow-hidden/auto/scroll — el pin de S02/S03 se ancla contra el VIEWPORT real', () => {
  const wrapperMatch = LAYOUT.match(/<div className="min-h-screen[^"]*"/);
  assert.ok(wrapperMatch, 'el wrapper `min-h-screen` debe seguir existiendo con ese contrato textual');
  assert.doesNotMatch(wrapperMatch![0], SIN_OVERFLOW_SCROLL);
  // `<main>` no lleva className en absoluto hoy -- se afirma la ausencia total de la clase, no sólo
  // que no matchee el patrón (un `<main className="...">` futuro sin overflow seguiría pasando).
  assert.doesNotMatch(LAYOUT, /<main[^>]*overflow-(hidden|auto|scroll)/);
});

test('app/(storefront)/page.tsx: nada en el árbol de la home (donde vive `SeccionInstancia`) declara overflow-hidden/auto/scroll sobre un contenedor', () => {
  assert.doesNotMatch(PAGE, SIN_OVERFLOW_SCROLL);
});
