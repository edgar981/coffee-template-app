import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_WIDGET_KEYS, WIDGET_MAP, sanitizeWidgetKeys } from './dashboard-widgets';

// EL DEFAULT DE LA PANTALLA "HOY" (2026-08-22) y la garantía de que el cambio de
// default NO le quita nada a quien ya eligió sus tarjetas.

test('el default es EXACTAMENTE las cuatro tarjetas de acción del día', () => {
  // `ventas_hoy` y `pedidos_hoy` salieron del default (su cifra vive en el hero y en
  // la curva); `ingresos_mes`/`ordenes_mes` son de mes, no del día. Quedan estas 4.
  assert.deepEqual(DEFAULT_WIDGET_KEYS, [
    'por_cobrar', 'despachos_hoy', 'pedidos_por_atender', 'alertas_stock',
  ]);
});

test('los que salieron del default SIGUEN en el catálogo — nadie que los tenga los pierde', () => {
  // Verificación 2: no se retiró ninguna key del catálogo, así que `sanitizeWidgetKeys`
  // —el gate por el que pasa la preferencia guardada— las conserva. Si una de éstas
  // se retirara de verdad, un usuario que la tuviera elegida la perdería del grid.
  for (const key of ['ventas_hoy', 'pedidos_hoy', 'ingresos_mes', 'ordenes_mes']) {
    assert.ok(key in WIDGET_MAP, `${key} debe seguir en el catálogo (opt-in)`);
  }
});

test('una preferencia guardada con las viejas keys se conserva intacta', () => {
  // El caso concreto de verificación 1: quien guardó el default anterior (con
  // ventas_hoy/pedidos_hoy/ingresos_mes/ordenes_mes) las mantiene — el cambio de
  // `defaultVisible` sólo toca a quien NO tiene preferencia guardada.
  const guardadas = ['ventas_hoy', 'pedidos_hoy', 'ingresos_mes', 'ordenes_mes', 'alertas_stock'];
  assert.deepEqual(sanitizeWidgetKeys(guardadas), guardadas);
});
