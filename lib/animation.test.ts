import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MotionConfig } from 'framer-motion';
import { ReducedMotionProvider, valorContador, DURACION_CONTADOR_MS } from './animation';

// EL INVARIANTE de este slice (STOREFRONT-REDUCED-MOTION-1): el storefront monta
// `<MotionConfig reducedMotion="user">`, no un valor distinto ni ningún otro provider.
// No hay DOM ni navegador en capa 1, así que no se puede afirmar la CONDUCTA (que una
// entrada deje de desplazarse bajo `prefers-reduced-motion: reduce`) — eso es capa 3.
// Lo que sí se puede afirmar sin renderizar: `ReducedMotionProvider` es una función pura
// que devuelve el elemento `MotionConfig` con ese prop exacto envolviendo a sus children.
// Llamarla directamente (sin ReactDOM) es seguro porque no usa hooks.

test('ReducedMotionProvider monta MotionConfig con reducedMotion="user"', () => {
  const children = 'contenido-de-prueba';
  const el = ReducedMotionProvider({ children });

  assert.equal(el.type, MotionConfig, 'debe ser el componente MotionConfig, no otro wrapper');
  assert.equal(
    el.props.reducedMotion,
    'user',
    'sin "user" no respeta la preferencia del sistema — "always"/"never" o ausente dejarían el defecto vivo',
  );
});

test('ReducedMotionProvider no descarta ni envuelve los children', () => {
  const children = 'contenido-de-prueba';
  const el = ReducedMotionProvider({ children });

  assert.equal(
    el.props.children,
    children,
    'el provider sólo debe agregar el contexto, nunca alterar lo que renderiza',
  );
});

// ── EL CONTADOR (§ ORIGEN-BANDA-1) — `valorContador`, sin React, sin navegador ────────────────────
// Reproduce el cálculo de `docs/prototipos/cafeone/js/home.js:320-327` (ease-out cúbica). El hook
// (`useContadorAnimado`, sobre IntersectionObserver + rAF) no se puede afirmar acá — es render +
// timers reales; su cableado se verifica por render en `lib/config/origen-banda.test.ts` (proxy de
// vista previa, mismo criterio que `historia-direccion-arte.test.ts` usa para el otro motor de
// movimiento de este repo).

test('valorContador: progreso=0 da 0, sin importar el destino', () => {
  assert.equal(valorContador(1600, 0), 0);
  assert.equal(valorContador(52, 0), 0);
});

test('valorContador: progreso=1 da EXACTAMENTE el destino — ease-out cúbica converge a 1', () => {
  assert.equal(valorContador(1600, 1), 1600);
  assert.equal(valorContador(12, 1), 12);
});

test('valorContador: a mitad de progreso ya pasó la mitad del camino — ease-out (desacelera, no lineal)', () => {
  const v = valorContador(1000, 0.5);
  assert.ok(v > 500, `ease-out cúbica a k=0.5 debe superar el lineal (500); dio ${v}`);
  assert.equal(v, 1000 * (1 - Math.pow(0.5, 3)));
});

test('valorContador: progreso se acota a [0,1] — fuera de rango no se dispara ni retrocede', () => {
  assert.equal(valorContador(1600, -0.5), valorContador(1600, 0));
  assert.equal(valorContador(1600, 1.5), valorContador(1600, 1));
});

test('DURACION_CONTADOR_MS reproduce el `dur=1100` medido en el prototipo (`js/home.js:321`)', () => {
  assert.equal(DURACION_CONTADOR_MS, 1100);
});
