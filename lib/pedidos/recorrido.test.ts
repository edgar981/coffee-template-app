import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  recorridoDelPedido, etiquetaTransicion, tieneDerivados,
  type OrdenParaRecorrido,
} from './recorrido';
import type { OrderStatusTransition } from '@/types/order';

// El vocabulario y la derivación honesta del Recorrido. Se testea acá y no en el
// carril porque no toca la base: es la traducción de un libro ya leído a la lista
// de hechos que ve el operador. Lo que el carril afirma es OTRA cosa —que el libro
// se LEE en orden cronológico contra Postgres real (order-transitions.test.ts)—; sin
// las dos capas, un recorrido puede estar bien ordenado y decir cualquier cosa.

let n = 0;
const asiento = (
  eje: 'cobro' | 'fulfillment',
  from: string | null,
  to: string,
  cuando: string,
  actor: string | null = null,
): OrderStatusTransition => ({
  id: `t${++n}`, eje, estado_anterior: from, estado_nuevo: to,
  actor_id: actor && 'u1', actor_nombre: actor, occurred_at: cuando,
});

const orden = (o: Partial<OrdenParaRecorrido> = {}): OrdenParaRecorrido => ({
  createdAt: '2026-05-01T10:00:00.000Z',
  estado:    'pendiente',
  ...o,
});

const titulos = (o: OrdenParaRecorrido) => recorridoDelPedido(o).map(p => p.titulo);

// ─── VOCABULARIO ─────────────────────────────────────────────────────────────

test('la etiqueta depende del FROM, no sólo del estado nuevo', () => {
  // Los dos pares que un mapa por estado destino colapsaría en uno, diciendo lo
  // mismo para hechos opuestos.
  assert.equal(etiquetaTransicion({ eje: 'cobro', estado_anterior: null, estado_nuevo: 'pendiente' }), 'Pedido creado');
  assert.equal(etiquetaTransicion({ eje: 'cobro', estado_anterior: 'pagado', estado_nuevo: 'pendiente' }), 'Pago revertido');

  assert.equal(etiquetaTransicion({ eje: 'fulfillment', estado_anterior: null, estado_nuevo: 'preparando' }), 'Envío creado');
  assert.equal(etiquetaTransicion({ eje: 'fulfillment', estado_anterior: 'fallido', estado_nuevo: 'preparando' }), 'Entrega reprogramada');
});

test('cada estado que los cinco escritores producen tiene etiqueta propia', () => {
  assert.deepEqual(
    [
      etiquetaTransicion({ eje: 'cobro', estado_anterior: 'pendiente', estado_nuevo: 'pagado' }),
      etiquetaTransicion({ eje: 'cobro', estado_anterior: 'pagado', estado_nuevo: 'cancelado' }),
      etiquetaTransicion({ eje: 'fulfillment', estado_anterior: 'preparando', estado_nuevo: 'en_ruta' }),
      etiquetaTransicion({ eje: 'fulfillment', estado_anterior: 'en_ruta', estado_nuevo: 'entregado' }),
      etiquetaTransicion({ eje: 'fulfillment', estado_anterior: 'en_ruta', estado_nuevo: 'fallido' }),
      etiquetaTransicion({ eje: 'fulfillment', estado_anterior: 'preparando', estado_nuevo: 'cancelado' }),
    ],
    ['Pago registrado', 'Pedido cancelado', 'Despachado', 'Entregado', 'Entrega fallida', 'Envío anulado'],
  );
});

test('un estado DESCONOCIDO se muestra crudo, NO se omite', () => {
  // Un recorrido al que le falta un hecho miente por omisión. Feo pero cierto gana.
  assert.equal(etiquetaTransicion({ eje: 'fulfillment', estado_anterior: 'en_ruta', estado_nuevo: 'devuelto' }), 'devuelto');
  const pasos = recorridoDelPedido(orden({
    transiciones: [asiento('fulfillment', 'en_ruta', 'devuelto', '2026-05-02T10:00:00.000Z')],
  }));
  // Dos, no uno: el hecho desconocido MÁS el "Pedido creado" derivado, porque el
  // libro de esta orden no trae su asiento de creación. La primera versión de este
  // test pedía uno solo y se cayó — el que estaba mal era el test.
  assert.deepEqual(pasos.map(p => p.titulo), ['devuelto', 'Pedido creado']);
  assert.equal(pasos[0].derivado, false, 'el desconocido viene del libro, no se dedujo');
});

// ─── EL LIBRO ────────────────────────────────────────────────────────────────

test('con libro: los dos ejes MEZCLADOS y el más reciente ARRIBA', () => {
  const o = orden({
    estado: 'pagado',
    transiciones: [
      asiento('cobro',       null,         'pendiente',  '2026-05-01T10:00:00.000Z'),
      asiento('cobro',       'pendiente',  'pagado',     '2026-05-01T10:00:01.000Z', 'Cajera'),
      asiento('fulfillment', null,         'preparando', '2026-05-01T10:00:02.000Z'),
      asiento('fulfillment', 'preparando', 'en_ruta',    '2026-05-03T08:00:00.000Z', 'Ana'),
    ],
  });
  assert.deepEqual(titulos(o), ['Despachado', 'Envío creado', 'Pago registrado', 'Pedido creado']);
  assert.deepEqual(
    recorridoDelPedido(o).map(p => p.actor),
    ['Ana', null, 'Cajera', null],
    'el actor viaja tal cual; null = sin humano detrás',
  );
  assert.equal(tieneDerivados(recorridoDelPedido(o)), false, 'con libro completo no se deriva nada');
});

test('el `now` marca el hecho más reciente sólo si el pedido sigue en curso', () => {
  const ts = [
    asiento('cobro',       null,         'pendiente',  '2026-05-01T10:00:00.000Z'),
    asiento('fulfillment', 'preparando', 'en_ruta',    '2026-05-03T08:00:00.000Z'),
  ];
  assert.deepEqual(
    recorridoDelPedido(orden({ estado: 'pendiente', transiciones: ts })).map(p => p.estado),
    ['now', 'done'],
  );
  assert.deepEqual(
    recorridoDelPedido(orden({ estado: 'cancelado', transiciones: ts })).map(p => p.estado),
    ['done', 'done'],
    'cancelado es terminal: no hay un "acá está ahora" que marcar',
  );
});

// ─── GRANDFATHERING ──────────────────────────────────────────────────────────

test('orden ANTERIOR al libro y sin nada más: UN punto, y es el creado', () => {
  const pasos = recorridoDelPedido(orden());
  assert.deepEqual(pasos.map(p => p.titulo), ['Pedido creado']);
  assert.equal(pasos[0].cuando, '2026-05-01T10:00:00.000Z', 'sale de Order.createdAt');
  assert.equal(pasos[0].derivado, true);
});

test('orden ANTERIOR al libro, pagada y entregada: TRES puntos y NINGUNO inventado', () => {
  const pasos = recorridoDelPedido(orden({
    estado:   'pagado',
    payments: [{ fecha: '2026-05-02T09:00:00.000Z' }],
    shipping: { estado: 'entregado', fecha_entrega: '2026-05-04T15:00:00.000Z' },
  }));
  assert.deepEqual(pasos.map(p => p.titulo), ['Entregado', 'Pago registrado', 'Pedido creado']);
  assert.ok(pasos.every(p => p.derivado), 'los tres son deducidos');

  // LA AFIRMACIÓN QUE IMPORTA: los pasos que NO tienen timestamp real no aparecen.
  // Si algún día alguien "completa" el recorrido de una orden vieja, esto se cae.
  for (const inventado of ['Envío creado', 'Envío en preparación', 'Despachado', 'Pedido cancelado', 'Entrega fallida']) {
    assert.ok(!pasos.some(p => p.titulo === inventado), `NO se inventa "${inventado}"`);
  }
});

test('un envío entregado SIN fecha real no se deriva — no se inventa el cuándo', () => {
  assert.deepEqual(
    titulos(orden({ estado: 'pagado', shipping: { estado: 'entregado', fecha_entrega: null } })),
    ['Pedido creado'],
  );
  assert.deepEqual(
    titulos(orden({ estado: 'pagado', shipping: { estado: 'entregado', fecha_entrega: 'ayer por la tarde' } })),
    ['Pedido creado'],
    'una fecha impareseable vale lo mismo que ninguna (mismo criterio que entregaVencidaSinCobro)',
  );
});

test('un envío NO entregado no aporta punto, esté donde esté', () => {
  assert.deepEqual(
    titulos(orden({ estado: 'pagado', shipping: { estado: 'en_ruta', fecha_entrega: null } })),
    ['Pedido creado'],
    'en_ruta no es derivable: no hay timestamp de cuándo salió',
  );
});

test('en una orden derivada NADA queda en `now`, ni siquiera el hecho más reciente', () => {
  // Que "Pedido creado" sea el último hecho DERIVABLE no dice que sea el último que
  // pasó: dice que no hay registro de lo demás. Un `now` ahí afirmaría que el
  // pedido está parado en la creación.
  const pasos = recorridoDelPedido(orden({ estado: 'pendiente' }));
  assert.deepEqual(pasos.map(p => p.estado), ['done']);
});

// ─── EL CASO MIXTO · el agujero de "¿tiene asientos?" ────────────────────────

test('orden vieja CANCELADA HOY: conserva su creación y suma el asiento nuevo', () => {
  // Con la regla "si no hay asientos, derivar", esta orden mostraría "Pedido
  // cancelado" y NADA MÁS: su propia creación desaparecería por tener un asiento
  // de otra cosa. Es el caso que va a ocurrir con cada orden anterior al libro que
  // alguien toque de ahora en adelante.
  const pasos = recorridoDelPedido(orden({
    estado:       'cancelado',
    transiciones: [asiento('cobro', 'pendiente', 'cancelado', '2026-08-12T18:00:00.000Z', 'Edgar')],
  }));
  assert.deepEqual(pasos.map(p => p.titulo), ['Pedido cancelado', 'Pedido creado']);
  assert.deepEqual(pasos.map(p => p.derivado), [false, true], 'uno del libro, uno deducido');
  assert.equal(pasos[1].cuando, '2026-05-01T10:00:00.000Z');
});

test('el libro MANDA: un hecho que ya está no se duplica con su derivación', () => {
  const o = orden({
    estado:   'pagado',
    payments: [{ fecha: '2026-05-02T09:00:00.000Z' }],
    shipping: { estado: 'entregado', fecha_entrega: '2026-05-04T15:00:00.000Z' },
    transiciones: [
      asiento('cobro',       null,        'pendiente', '2026-05-01T10:00:00.000Z'),
      asiento('cobro',       'pendiente', 'pagado',    '2026-05-02T09:00:00.000Z', 'Cajera'),
      asiento('fulfillment', 'en_ruta',   'entregado', '2026-05-04T15:00:00.000Z', 'Ana'),
    ],
  });
  const pasos = recorridoDelPedido(o);
  assert.deepEqual(pasos.map(p => p.titulo), ['Entregado', 'Pago registrado', 'Pedido creado']);
  assert.ok(!tieneDerivados(pasos), 'ninguno se dedujo: el libro cubre los tres');
  assert.deepEqual(pasos.map(p => p.actor), ['Ana', 'Cajera', null], 'y conserva el actor del libro');
});

test('mezcla parcial: el pago está en el libro y la entrega se deriva', () => {
  const pasos = recorridoDelPedido(orden({
    estado:   'pagado',
    payments: [{ fecha: '2026-05-02T09:00:00.000Z' }],
    shipping: { estado: 'entregado', fecha_entrega: '2026-05-04T15:00:00.000Z' },
    transiciones: [asiento('cobro', 'pendiente', 'pagado', '2026-05-02T09:00:00.000Z', 'Cajera')],
  }));
  assert.deepEqual(pasos.map(p => p.titulo), ['Entregado', 'Pago registrado', 'Pedido creado']);
  assert.deepEqual(pasos.map(p => p.derivado), [true, false, true], 'se deriva sólo lo que el libro no cubre');
  assert.equal(pasos[0].estado, 'done', 'el más reciente es derivado → no se marca `now`');
});

// ─── ORDEN Y EMPATES ─────────────────────────────────────────────────────────

test('ordena parseando, no comparando texto: distinta precisión no invierte nada', () => {
  // La inversión ocurre DENTRO DEL MISMO SEGUNDO, que es lo único que hay que
  // acertar acá: '…:01Z' vs '…:01.500Z'. Como texto, la 'Z' (90) va DESPUÉS del
  // '.' (46), así que el de menos precisión se cree el más nuevo — y el pago se
  // pondría por encima de una entrega que ocurrió medio segundo más tarde.
  // Es una mezcla real: el libro siempre trae milisegundos y `fecha_entrega` es
  // una columna de TEXTO que podría no traerlos.
  //
  // La primera versión de este test usaba segundos DISTINTOS ('…:01Z' contra
  // '…:00.500Z') y pasaba también comparando texto, o sea que no probaba nada.
  // Se descubrió corriéndolo contra `localeCompare` a propósito.
  const pasos = recorridoDelPedido(orden({
    estado:   'pagado',
    shipping: { estado: 'entregado', fecha_entrega: '2026-05-01T10:00:01.500Z' },
    transiciones: [asiento('cobro', 'pendiente', 'pagado', '2026-05-01T10:00:01Z')],
  }));
  assert.deepEqual(
    pasos.map(p => p.titulo), ['Entregado', 'Pago registrado', 'Pedido creado'],
    'la entrega (10:00:01.500) va ARRIBA del pago (10:00:01.000)',
  );
});
