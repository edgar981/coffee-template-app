import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoEntrega, accionFilaEntrega, type OrdenParaEntrega } from './entrega-estado';

// Todos los casos del mapeo aprobado. La aserción es sobre la ETIQUETA VISIBLE y
// no sobre la key: el vocabulario ES la decisión de producto de esta tanda, así
// que un cambio de redacción tiene que romper un test y no pasar callado.

const orden = (o: Partial<OrdenParaEntrega> = {}): OrdenParaEntrega => ({
  estado: 'pendiente', condicion_pago: 'ANTICIPADO', ...o,
});

const envio = (s: Partial<NonNullable<OrdenParaEntrega['shipping']>> = {}) => ({
  estado: 'preparando', ...s,
});

// ─── 1-2. Nada que mostrar ───────────────────────────────────────────────────

test('orden cancelada sin envío: la celda queda vacía (el estado ya lo dice)', () => {
  const r = estadoEntrega(orden({ estado: 'cancelado' }));
  assert.equal(r.key, 'ninguno');
  assert.equal(r.etiqueta, '');
});

test('entrega anulada: la celda queda vacía aunque la orden traiga el registro', () => {
  const r = estadoEntrega(orden({ estado: 'cancelado', shipping: envio({ estado: 'cancelado' }) }));
  assert.equal(r.key, 'ninguno');
  assert.equal(r.etiqueta, '');
});

// ─── 3-4. "Sin programar", una etiqueta y dos detalles ───────────────────────

test('orden sin registro de envío: Sin programar, neutro', () => {
  const r = estadoEntrega(orden());
  assert.equal(r.etiqueta, 'Sin programar');
  assert.equal(r.tono, 'neutral');
});

test('envío creado y vacío: la MISMA etiqueta que sin registro', () => {
  const r = estadoEntrega(orden({ shipping: envio() }));
  assert.equal(r.etiqueta, 'Sin programar');
  assert.equal(r.tono, 'neutral');
});

test('los dos "Sin programar" se distinguen en el detalle, no en la etiqueta', () => {
  const sinRegistro = estadoEntrega(orden());
  const vacio       = estadoEntrega(orden({ shipping: envio() }));
  assert.equal(sinRegistro.etiqueta, vacio.etiqueta);
  assert.notEqual(sinRegistro.detalle, vacio.detalle);
  // El matiz existe para diagnóstico: cada uno nombra su propia situación.
  assert.match(sinRegistro.detalle, /no tiene registro de envío/);
  assert.match(vacio.detalle,       /sin mensajero ni fecha/);
});

test('una fecha en blanco o de puros espacios no cuenta como programación', () => {
  const r = estadoEntrega(orden({ shipping: envio({ fecha_programada: '   ', mensajero: '' }) }));
  assert.equal(r.etiqueta, 'Sin programar');
});

// ─── 5-6. Datos parciales ────────────────────────────────────────────────────

test('con fecha y sin mensajero: Programada · fecha (no puede despachar todavía)', () => {
  const r = estadoEntrega(orden({ shipping: envio({ fecha_programada: '2026-05-14' }) }));
  assert.equal(r.etiqueta, 'Programada · 14 may 2026');
  assert.equal(r.tono, 'warn');
  assert.match(r.detalle, /mensajero/);
});

test('con mensajero y sin fecha: Falta fecha — no se finge una programación', () => {
  const r = estadoEntrega(orden({ shipping: envio({ mensajero: 'Juan' }) }));
  assert.equal(r.etiqueta, 'Falta fecha');
  assert.equal(r.tono, 'warn');
});

// ─── 7. El gate de despacho ──────────────────────────────────────────────────

test('mensajero + fecha: Lista para despacho · fecha', () => {
  const r = estadoEntrega(orden({ shipping: envio({ mensajero: 'Juan', fecha_programada: '2026-05-14' }) }));
  assert.equal(r.key, 'lista');
  assert.equal(r.etiqueta, 'Lista para despacho · 14 may 2026');
  assert.equal(r.tono, 'info');
});

test('el corte "lista" es el MISMO gate que despacha: sin mensajero nunca es lista', () => {
  const casi = estadoEntrega(orden({ shipping: envio({ mensajero: '  ', fecha_programada: '2026-05-14' }) }));
  assert.notEqual(casi.key, 'lista');
});

// ─── 8-10. Estados reales de fulfillment ─────────────────────────────────────

test('en ruta: En ruta, azul, con la fecha programada en el detalle', () => {
  const r = estadoEntrega(orden({
    shipping: envio({ estado: 'en_ruta', mensajero: 'Juan', fecha_programada: '2026-05-14' }),
  }));
  assert.equal(r.etiqueta, 'En ruta');
  assert.equal(r.tono, 'info');
  assert.match(r.detalle, /14 may 2026/);
});

test('entregada: lleva la fecha REAL de entrega, no la programada', () => {
  const r = estadoEntrega(orden({
    estado: 'pagado',
    shipping: envio({
      estado: 'entregado',
      fecha_programada: '2026-05-14',
      fecha_entrega:    '2026-05-16T15:00:00.000Z',
    }),
  }));
  assert.equal(r.etiqueta, 'Entregada · 16 may 2026');
  assert.equal(r.tono, 'ok');
});

test('entregada sin fecha registrada: no inventa una', () => {
  const r = estadoEntrega(orden({ estado: 'pagado', shipping: envio({ estado: 'entregado' }) }));
  assert.equal(r.etiqueta, 'Entregada');
});

test('fallida: Fallida, rojo', () => {
  const r = estadoEntrega(orden({ shipping: envio({ estado: 'fallido', mensajero: 'Juan', fecha_programada: '2026-05-14' }) }));
  assert.equal(r.etiqueta, 'Fallida');
  assert.equal(r.tono, 'danger');
});

// ─── Badge secundario: sólo la excepción que cuesta plata ────────────────────

test('contraentrega despachada sin cobro: marca Por cobrar', () => {
  const r = estadoEntrega(orden({
    estado: 'pendiente', condicion_pago: 'CONTRAENTREGA',
    shipping: envio({ estado: 'en_ruta', mensajero: 'Juan', fecha_programada: '2026-05-14' }),
  }));
  assert.equal(r.porCobrar, true);
});

test('contraentrega entregada sin cobro: sigue siendo Por cobrar, y el detalle lo dice', () => {
  const r = estadoEntrega(orden({
    estado: 'pendiente', condicion_pago: 'CONTRAENTREGA',
    shipping: envio({ estado: 'entregado', fecha_entrega: '2026-05-16T15:00:00.000Z' }),
  }));
  assert.equal(r.porCobrar, true);
  assert.match(r.detalle, /no se ha registrado/);
});

test('contraentrega AÚN NO despachada no es Por cobrar: la mercancía no ha salido', () => {
  const r = estadoEntrega(orden({
    estado: 'pendiente', condicion_pago: 'CONTRAENTREGA',
    shipping: envio({ mensajero: 'Juan', fecha_programada: '2026-05-14' }),
  }));
  assert.equal(r.porCobrar, false);
});

test('orden pagada y entregada: sin badge secundario (el default no se etiqueta)', () => {
  const r = estadoEntrega(orden({
    estado: 'pagado', condicion_pago: 'CONTRAENTREGA',
    shipping: envio({ estado: 'entregado', fecha_entrega: '2026-05-16T15:00:00.000Z' }),
  }));
  assert.equal(r.porCobrar, false);
});

// ─── Residual ────────────────────────────────────────────────────────────────

test('un estado desconocido calla en vez de inventar una etiqueta', () => {
  const r = estadoEntrega(orden({ shipping: envio({ estado: 'teletransportado' }) }));
  assert.equal(r.key, 'ninguno');
  assert.equal(r.etiqueta, '');
});

// ─── La acción única de la fila ──────────────────────────────────────────────
// La fila ofrece EL siguiente paso, no un menú. "Editar entrega" murió: editar,
// reprogramar y los casos raros viven en el detalle.

test('orden cancelada: la fila no ofrece nada', () => {
  assert.equal(accionFilaEntrega(orden({ estado: 'cancelado' })).tipo, 'ninguna');
});

test('sin registro de envío: Programar entrega', () => {
  assert.equal(accionFilaEntrega(orden()).tipo, 'programar');
});

test('envío creado y vacío: Programar entrega', () => {
  assert.equal(accionFilaEntrega(orden({ shipping: envio() })).tipo, 'programar');
});

test('programación completa: Marcar En Ruta', () => {
  const a = accionFilaEntrega(orden({ shipping: envio({ mensajero: 'Juan', fecha_programada: '2026-05-14' }) }));
  assert.equal(a.tipo, 'despachar');
});

test('con fecha y sin mensajero: En Ruta BLOQUEADO nombrando lo que falta', () => {
  const a = accionFilaEntrega(orden({ shipping: envio({ fecha_programada: '2026-05-14' }) }));
  assert.deepEqual(a, { tipo: 'despachar_bloqueado', falta: 'mensajero' });
});

test('con mensajero y sin fecha: En Ruta BLOQUEADO por la fecha', () => {
  const a = accionFilaEntrega(orden({ shipping: envio({ mensajero: 'Juan' }) }));
  assert.deepEqual(a, { tipo: 'despachar_bloqueado', falta: 'fecha' });
});

test('el bloqueo de la fila usa el MISMO gate que despacha', () => {
  // Mensajero de puros espacios: `isScheduledShipping` lo rechaza y la fila
  // tampoco puede ofrecer el despacho. Si divergieran, la fila prometería una
  // transición que el servidor devuelve en 400.
  const a = accionFilaEntrega(orden({ shipping: envio({ mensajero: '  ', fecha_programada: '2026-05-14' }) }));
  assert.notEqual(a.tipo, 'despachar');
});

test('en ruta: Marcar Entregado', () => {
  const a = accionFilaEntrega(orden({ shipping: envio({ estado: 'en_ruta', mensajero: 'Juan', fecha_programada: '2026-05-14' }) }));
  assert.equal(a.tipo, 'entregar');
});

test('fallida: la fila calla — reprogramar exige ver por qué falló', () => {
  assert.equal(accionFilaEntrega(orden({ shipping: envio({ estado: 'fallido' }) })).tipo, 'ninguna');
});

test('entregada y anulada: la fila calla', () => {
  assert.equal(accionFilaEntrega(orden({ shipping: envio({ estado: 'entregado' }) })).tipo, 'ninguna');
  assert.equal(accionFilaEntrega(orden({ shipping: envio({ estado: 'cancelado' }) })).tipo, 'ninguna');
});
