import { test } from 'node:test';
import assert from 'node:assert/strict';

import { configToasterTienda, DURACION_TOAST_TIENDA_CORTE_MS } from './toast-tienda';

test('configToasterTienda(false) — byte-idéntica al Toaster genérico de antes de este slice: richColors + top-center, sin duration ni vars', () => {
  const config = configToasterTienda(false);
  assert.equal(config.position, 'top-center');
  assert.equal(config.richColors, true);
  assert.equal(config.duration, undefined);
  assert.equal(config.vars, undefined);
});

test('configToasterTienda(true) — el estilo del prototipo: bottom-left, richColors apagado, la duración visible del prototipo (3200ms)', () => {
  const config = configToasterTienda(true);
  assert.equal(config.position, 'bottom-left');
  assert.equal(config.richColors, false);
  assert.equal(config.duration, DURACION_TOAST_TIENDA_CORTE_MS);
  assert.equal(config.duration, 3200);
});

test('configToasterTienda(true) — el color sale de las raíces del tema (--sf-tinta banda oscura, --sf-fondo texto claro), esquinas rectas', () => {
  const config = configToasterTienda(true);
  assert.deepEqual(config.vars, {
    '--normal-bg': 'var(--sf-tinta)',
    '--normal-text': 'var(--sf-fondo)',
    '--normal-border': 'var(--sf-tinta)',
    '--border-radius': '0px',
  });
});
