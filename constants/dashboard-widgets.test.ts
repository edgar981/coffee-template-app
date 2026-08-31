import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_WIDGET_KEYS, WIDGET_MAP, sanitizeWidgetKeys, estadoTile } from './dashboard-widgets';

// EL ESTADO DE LA PLECA de la tira editorial. La regla NO es "el widget tiene tono":
// es "tiene tono Y el valor lo justifica (> 0)". Sin el guard de valor, un widget de
// estado pintaría la pleca aunque su cola esté vacía o su fuente haya caído — una
// alerta que vale 0 no es una alerta. Estos casos se ven fallar si `estadoTile` deja
// de mirar el valor (p. ej. `return w.tono ?? null`).

test('estadoTile: con tono y valor > 0 devuelve el tono', () => {
  assert.equal(estadoTile({ tono: 'atencion' }, 3), 'atencion');
  assert.equal(estadoTile({ tono: 'alerta' }, 1), 'alerta');
});

test('estadoTile: valor 0 → null (una cola vacía no pide nada)', () => {
  assert.equal(estadoTile({ tono: 'atencion' }, 0), null);
  assert.equal(estadoTile({ tono: 'alerta' }, 0), null);
});

test('estadoTile: sin tono → null (el widget no representa estado → sin pleca)', () => {
  assert.equal(estadoTile({ tono: undefined }, 5), null);
});

test('estadoTile: valor null/undefined (fuente caída) → null', () => {
  assert.equal(estadoTile({ tono: 'alerta' }, null), null);
  assert.equal(estadoTile({ tono: 'atencion' }, undefined), null);
});

// EL DEFAULT DE LA PANTALLA "HOY" (2026-08-22) y la garantía de que el cambio de
// default NO le quita nada a quien ya eligió sus tarjetas.

test('el default son las tres tarjetas de acción del día (sin `pedidos_por_atender`, retirado)', () => {
  // `ventas_hoy` y `pedidos_hoy` salieron del default (su cifra vive en el hero y en
  // la curva); `ingresos_mes`/`ordenes_mes` son de mes, no del día. Y `pedidos_por_atender`
  // se RETIRÓ: su número es el badge de la sección "Necesita tu atención" (§ lib/atencion/items).
  assert.deepEqual(DEFAULT_WIDGET_KEYS, [
    'por_cobrar', 'despachos_hoy', 'alertas_stock',
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
