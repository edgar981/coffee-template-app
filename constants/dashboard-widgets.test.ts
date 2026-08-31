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

test('el default son las dos tarjetas de acción del día (sin `pedidos_por_atender` ni `alertas_stock`)', () => {
  // `ventas_hoy` y `pedidos_hoy` salieron del default (su cifra vive en el hero y en la
  // curva); `ingresos_mes`/`ordenes_mes` son de mes, no del día. `pedidos_por_atender` y
  // `alertas_stock` se RETIRARON: sus hechos salen en la sección "Necesita tu atención"
  // (§ lib/atencion/items) — el conteo de pedidos es el badge, y el stock bajo va como
  // ítems rojos. `por_cobrar` se queda: muestra el MONTO ($ en la calle), que la sección no.
  assert.deepEqual(DEFAULT_WIDGET_KEYS, [
    'por_cobrar', 'despachos_hoy',
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

test('una preferencia guardada con keys VÁLIDAS se conserva intacta', () => {
  // El caso concreto de verificación 1: quien guardó el default anterior (con
  // ventas_hoy/pedidos_hoy/ingresos_mes/ordenes_mes) las mantiene — el cambio de
  // `defaultVisible` sólo toca a quien NO tiene preferencia guardada.
  const guardadas = ['ventas_hoy', 'pedidos_hoy', 'ingresos_mes', 'ordenes_mes', 'productos_activos'];
  assert.deepEqual(sanitizeWidgetKeys(guardadas), guardadas);
});

test('una key RETIRADA (alertas_stock, pedidos_por_atender) se DESCARTA de la preferencia guardada', () => {
  // El otro lado de lo mismo: quien tuviera guardado un tile ya retirado lo pierde del
  // grid —su hecho vive ahora en la sección "Necesita tu atención"—. Es el gate por
  // diseño (§ el retiro de los tiles); las demás keys válidas se conservan.
  assert.deepEqual(
    sanitizeWidgetKeys(['por_cobrar', 'alertas_stock', 'pedidos_por_atender', 'productos_activos']),
    ['por_cobrar', 'productos_activos'],
  );
});
