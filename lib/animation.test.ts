import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MotionConfig } from 'framer-motion';
import { ReducedMotionProvider } from './animation';

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
