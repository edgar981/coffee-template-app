import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), '../..');

// § MOVIMIENTO-CIERRE-BOTON-1 — el defecto medido en MOVIMIENTO-NIVEL-FIRMA-1
// (`CTA01-BOTON-SCROLL-TOPE-1`, `DECISIONS.md`) tenía DOS hipótesis de causa, y sólo UNA se
// confirmó por ejecución (Chromium real, Postgres efímero + `next build`/`next start`):
//
//   1. La hipótesis ORIGINAL ("el `end:'center 45%'` del scrub, sin `pin`, puede exigir más
//      distancia de scroll de la que el documento tiene") quedaba SIN CONFIRMAR en esa medición —
//      y al re-medirla en ESTE slice, con una página real (home completo + footer), el timeline
//      ÚNICO viejo SÍ alcanzaba `end` y completaba. No era la causa real EN ESE escenario, pero
//      sigue siendo un riesgo ESTRUCTURAL real (una página mucho más corta sí podría topar), así
//      que el fix de abajo la cierra de todos modos — por el principio general del spec, no
//      porque haya sido la causa medida.
//   2. La causa REAL, confirmada por ejecución: el botón (`<Link data-cta01-boton>`, `Cierre.tsx`)
//      llevaba `transition-all` — una transición CSS sobre TODAS sus propiedades, incluidas
//      `opacity`/`visibility`, las MISMAS que GSAP escribe con `.from(boton, {autoAlpha:0})`. Cada
//      frame de GSAP reinicia esa transición CSS, y GSAP consulta el valor vigente (vía su caché
//      interno) al completar el tween para decidir si `visibility` queda en `hidden` — atrapado a
//      mitad de esa persecución, se queda en `hidden` aunque el VALOR FINAL que GSAP escribió sea
//      `opacity:1`. Se cierra en `Cierre.tsx` (`transition-all` → `transition-transform`), afirmado
//      por render en `demo-byte-identidad.test.ts` ("el botón NUNCA lleva `transition-all`").
//
// NO HAY FORMA HONESTA DE EJECUTAR `cta01()` EN ESTE CARRIL: `ScrollTrigger.create` exige un
// `window`/`document` reales (medido: `_context is not a function` sin ellos) y este repo no tiene
// jsdom/happy-dom (§ CLAUDE.md, "El glob NO incluye *.test.tsx: los tests de COMPONENTE necesitan
// jsdom, que el repo no tiene"), así que la verificación EN EJECUCIÓN de la causa #2 (arriba) y del
// fix completo vive en el gate visual (Chromium real), no en `npm test`. Lo que SÍ se puede afirmar
// acá, por el mismo criterio que `pin-overflow-ancestro.test.ts`/`hero-marquesina.test.ts` ya usan
// para lo que la ejecución no puede cubrir, es la ESTRUCTURA del motor: que la frase y el botón de
// CTA01 viven en un `ScrollTrigger` SEPARADO del scrub del vapor (causa #1, defensivo), y que ese
// scrub se auto-limpia por `id` para no dejar una instancia huérfana si `useMovimiento.ts` lo
// recrea (§ MOVIMIENTO-SCROLL-UMBRAL-1) sin saber que el vapor existe aparte.
const ANIMACIONES = readFileSync(
  join(RAIZ, 'components/storefront/movimiento/animaciones.ts'),
  'utf8',
);

function cuerpoDeCta01(): string {
  const inicio = ANIMACIONES.indexOf('function cta01(');
  assert.ok(inicio >= 0, 'cta01 debe seguir existiendo con ese nombre exacto');
  const fin = ANIMACIONES.indexOf('// ─── EL DESPACHADOR', inicio);
  assert.ok(fin > inicio, 'el despachador debe seguir siendo el próximo bloque después de cta01');
  return ANIMACIONES.slice(inicio, fin);
}

test('cta01: el vapor conserva SU scrub exacto, sin cambios de comportamiento (`top 70%` → `center 45%`, `scrub: 0.6`)', () => {
  const cuerpo = cuerpoDeCta01();
  assert.match(
    cuerpo,
    /scrollTrigger: forzar \? undefined : \{ id: 'cta01-vapor', trigger: raiz, start: 'top 70%', end: 'center 45%', scrub: 0\.6 \}/,
    'el ScrollTrigger del vapor no cambia su start/end/scrub — el spec permite que el vapor siga atado al scroll tal cual; sólo gana un `id` fijo para el auto-limpiado',
  );
});

test('cta01: el vapor se auto-limpia por `id` antes de crearse — una recreación (§ MOVIMIENTO-SCROLL-UMBRAL-1) no deja una instancia huérfana', () => {
  const cuerpo = cuerpoDeCta01();
  assert.match(
    cuerpo,
    /ScrollTrigger\.getById\('cta01-vapor'\)\?\.kill\(\);/,
    'sin este auto-limpiado, cada recreación de `cta01()` (p. ej. por el ResizeObserver de useMovimiento.ts, que sólo rastrea el timeline de revelado) deja un tlVapor viejo escuchando scroll para siempre',
  );
});

test('cta01: la frase y el botón revelan en un SEGUNDO timeline con disparador de ENTRADA EN VISTA, no en el del vapor', () => {
  const cuerpo = cuerpoDeCta01();
  // Dos timelines — uno para el vapor, otro para el revelado — es la forma misma del fix: un solo
  // timeline compartido es exactamente el bug que MOVIMIENTO-NIVEL-FIRMA-1 midió.
  const timelines = cuerpo.match(/gsap\.timeline\(/g) ?? [];
  assert.equal(timelines.length, 2, 'cta01 debe armar DOS timelines (vapor + revelado), no uno compartido');

  assert.match(
    cuerpo,
    /gsap\.timeline\(\{ scrollTrigger: alEntrar\(raiz, forzar, 70\) \}\)/,
    'el timeline de revelado debe usar `alEntrar` (play-una-vez, sin `end`) — nunca el `end` del scrub',
  );
});

test('cta01: la frase y el botón NUNCA se encadenan sobre el timeline del vapor', () => {
  const cuerpo = cuerpoDeCta01();
  assert.doesNotMatch(
    cuerpo,
    /tlVapor\.(from|to)\(\s*(frase|boton)/,
    'frase/boton no pueden depender del timeline cuyo `end` puede quedar fuera del scroll máximo real',
  );
  assert.match(cuerpo, /tlRevelado\.from\(frase/, 'la frase se revela desde el timeline de revelado');
  assert.match(cuerpo, /tlRevelado\.from\(boton/, 'el botón se revela desde el timeline de revelado');
});

test('alEntrar: acepta un umbral configurable, con 82 como default — CTA01 es el único llamador que lo cambia (a 70, para no invertir el orden narrativo con el vapor)', () => {
  assert.match(
    ANIMACIONES,
    /function alEntrar\(el: Element, forzar = false, umbral = 82\)/,
    'el default debe seguir siendo 82 — los otros diez ids del catálogo (T01…H03) no pasan un tercer argumento y deben seguir disparando al 82% de siempre',
  );
  assert.match(
    ANIMACIONES,
    /return \{ trigger: el, start: `top \$\{umbral\}%`, toggleActions: 'play none none none' \}/,
    'el umbral debe seguir siendo un `start` puro, SIN `end` — un disparador de entrada en vista nunca depende de cuánto scroll queda después del elemento',
  );
});
