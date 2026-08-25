import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createOrderWithCustomer, registerOrderPaymentTx, transitionOrder } from '@duna/core/orders';
import { appendOrderStatusTransition } from '@duna/core/order-transitions';
import { buildBrand } from '@/lib/config/brand';
import { prisma, limpiar, crearOrden, crearEnvio } from './fixtures';

// EL LIBRO SE ESCRIBE EN LA MISMA TX QUE EL CAMBIO, EN LOS CINCO FUNNELS.
//
// Este test no afirma "la escritura no se rompe" (eso ya lo cubre el resto del
// carril) — afirma que cada funnel deja el ASIENTO CORRECTO: eje, from/to y actor.
// Fue la capa que faltaría si sólo se mirara que crear/pagar/mover sigue andando:
// un asiento con el eje equivocado, o el de anulación del envío que se PIERDE al
// cancelar, no rompe ninguna escritura y pasaría desapercibido.

before(() => limpiar());
beforeEach(() => limpiar());
after(async () => { await limpiar(); await prisma.$disconnect(); });

const asientos = (ordenId: string) =>
  prisma.orderStatusTransition.findMany({ where: { orden_id: ordenId }, orderBy: { occurred_at: 'asc' } });

const actor = { id: 'u1', nombre: 'Operador QA' };

test('CREACIÓN: un asiento cobro null→pendiente con el actor', async () => {
  const orden = await createOrderWithCustomer({
    customer: { nombre: 'Ana', telefono: '3001112233' },
    canal:    'directo',
    total:    20000,
    items:    [{ producto_nombre: 'Café', cantidad: 1, subtotal: 20000 }],
    brand:    await buildBrand(),
    actor,
  });
  const libro = await asientos(orden!.id);
  assert.equal(libro.length, 1, 'la creación deja exactamente un asiento');
  assert.deepEqual(
    { eje: libro[0].eje, from: libro[0].estado_anterior, to: libro[0].estado_nuevo, actor: libro[0].actor_nombre },
    { eje: 'cobro', from: null, to: 'pendiente', actor: 'Operador QA' },
    'creación = cobro null→pendiente con actor',
  );
});

test('CHECKOUT sin humano: el asiento de creación va con actor null', async () => {
  const orden = await createOrderWithCustomer({
    customer: { nombre: 'Web', telefono: '3009998877' },
    canal:    'directo',
    total:    15000,
    items:    [{ producto_nombre: 'Café', cantidad: 1, subtotal: 15000 }],
    brand:    await buildBrand(),
    // sin actor → storefront
  });
  const libro = await asientos(orden!.id);
  assert.equal(libro[0].actor_id, null);
  assert.equal(libro[0].actor_nombre, null);
});

test('PAGO: cobro pendiente→pagado (actor = quien registró) + fulfillment null→preparando (envío auto = sistema, null)', async () => {
  const orden = await crearOrden({ numero: 'CN-T00001', estado: 'pendiente' }); // directo → sin asiento previo
  await prisma.$transaction((tx) =>
    registerOrderPaymentTx(tx, orden.id, {
      monto: orden.total, metodo: 'NEQUI',
      registrado_por: 'u2', registrado_por_nombre: 'Cajera',
    }),
  );
  const libro = await asientos(orden.id);
  const cobro = libro.find((a) => a.eje === 'cobro');
  const ful   = libro.find((a) => a.eje === 'fulfillment');
  assert.deepEqual(
    { from: cobro?.estado_anterior, to: cobro?.estado_nuevo, actor: cobro?.actor_nombre },
    { from: 'pendiente', to: 'pagado', actor: 'Cajera' },
    'el asiento de cobro lo escribe transitionOrder con el actor del pago (no se duplica)',
  );
  assert.deepEqual(
    { from: ful?.estado_anterior, to: ful?.estado_nuevo, actor: ful?.actor_nombre },
    { from: null, to: 'preparando', actor: null },
    'el envío auto-creado es efecto del sistema → actor null',
  );
});

// El `estado_anterior` del asiento de anulación es el estado REAL del envío al
// momento de cancelar, NO un valor fijo: `preparando` sólo si nunca se movió;
// `en_ruta` si ya se había despachado. Los dos casos, para que quede afirmado.

test('CANCELAR un envío que NUNCA se movió: fulfillment preparando→cancelado', async () => {
  const orden = await crearOrden({ numero: 'CN-T00002', estado: 'pendiente' });
  await crearEnvio({ ordenId: orden.id, estado: 'preparando' });
  await prisma.$transaction((tx) => transitionOrder(tx, orden.id, { estado: 'cancelado' }, actor));
  const libro = await asientos(orden.id);
  const cobro = libro.find((a) => a.eje === 'cobro' && a.estado_nuevo === 'cancelado');
  const anul  = libro.find((a) => a.eje === 'fulfillment' && a.estado_nuevo === 'cancelado');
  assert.ok(cobro, 'falta el asiento de cobro →cancelado');
  assert.ok(anul,  'falta el asiento de FULFILLMENT (anulación del envío) — el que se perdería con 3 puntos');
  assert.deepEqual({ from: anul!.estado_anterior, to: anul!.estado_nuevo }, { from: 'preparando', to: 'cancelado' });
  assert.equal(anul!.actor_nombre, 'Operador QA', 'la anulación lleva el actor que canceló');
});

test('CANCELAR un envío YA DESPACHADO: fulfillment en_ruta→cancelado (el from es el estado REAL, no fijo)', async () => {
  const orden = await crearOrden({ numero: 'CN-T00004', estado: 'pagado' });
  await crearEnvio({ ordenId: orden.id, estado: 'en_ruta' });
  await prisma.$transaction((tx) => transitionOrder(tx, orden.id, { estado: 'cancelado' }, actor));
  const anul = (await asientos(orden.id)).find((a) => a.eje === 'fulfillment' && a.estado_nuevo === 'cancelado');
  assert.ok(anul, 'falta el asiento de anulación del envío despachado');
  assert.deepEqual(
    { from: anul!.estado_anterior, to: anul!.estado_nuevo },
    { from: 'en_ruta', to: 'cancelado' },
    'estado_anterior refleja que el envío ya iba en ruta al cancelar',
  );
});

// ─── EL ORDEN DE LECTURA · lo que el Recorrido consume ───────────────────────
//
// `GET /api/orders/[id]` sirve el libro con `orderBy: [occurred_at asc, id asc]`
// y la pantalla lo pinta EN ESE ORDEN, mezclando los dos ejes. O sea que el orden
// no es una preferencia de presentación: es el contenido. Un Recorrido que diga
// "entregado" antes que "pagado" es una pantalla que miente sobre el negocio.
//
// El riesgo real está en los asientos que EMPATAN en `occurred_at`. Pasa de tres
// formas —el `DEFAULT CURRENT_TIMESTAMP` del DDL (hora de INICIO de transacción en
// Postgres, o sea constante dentro de ella), un `occurredAt` explícito repetido, o
// dos `create` que caen en el mismo milisegundo— y ninguna de las tres es un
// defecto: el desempate por `id` existe justamente para que la lectura sea
// determinista igual.
//
// Por eso este test afirma las TRES partes del mismo sujeto, y hay que leerlas
// juntas: la SECUENCIA correcta, que `occurred_at` no DECRECE, y que el orden
// SOBREVIVE a un empate.
test('el libro se LEE cronológico y con los dos ejes MEZCLADOS, incluso dentro de una misma transacción', async () => {
  // Tres asientos en UNA sola transacción: creación (cobro), pago (cobro) y
  // envío auto-creado (fulfillment). Es el peor caso para el empate.
  const orden = await createOrderWithCustomer({
    customer: { nombre: 'Ana', telefono: '3001112233' },
    canal:    'directo',
    total:    20000,
    items:    [{ producto_nombre: 'Café', cantidad: 1, subtotal: 20000 }],
    brand:    await buildBrand(),
    actor,
    immediatePayment: { metodo: 'NEQUI', registrado_por_nombre: 'Cajera' },
  });
  // Y un cuarto y quinto en OTRA transacción, más tarde: cancelar escribe en los
  // dos ejes a la vez.
  await prisma.$transaction((tx) => transitionOrder(tx, orden!.id, { estado: 'cancelado' }, actor));

  // El MISMO orderBy que sirve el endpoint. Si se cambia allá, este test se cae.
  const libro = await prisma.orderStatusTransition.findMany({
    where:   { orden_id: orden!.id },
    orderBy: [{ occurred_at: 'asc' }, { id: 'asc' }],
  });

  assert.deepEqual(
    libro.map((a) => `${a.eje}:${a.estado_anterior ?? '∅'}→${a.estado_nuevo}`),
    [
      'cobro:∅→pendiente',          // 1ª tx — la orden nace
      'cobro:pendiente→pagado',     // 1ª tx — el pago, DESPUÉS de nacer
      'fulfillment:∅→preparando',   // 1ª tx — el envío que el pago auto-crea
      'cobro:pagado→cancelado',     // 2ª tx
      'fulfillment:preparando→cancelado',
    ],
    'el Recorrido se lee en el orden en que pasaron las cosas, sin agrupar por eje',
  );

  // Y el orden no sale de casualidad: los timestamps son estrictamente crecientes.
  const ts = libro.map((a) => a.occurred_at.getTime());
  assert.deepEqual(
    ts, [...ts].sort((a, b) => a - b),
    'occurred_at no decrece nunca — es la clave de orden global, no un dato de auditoría',
  );
  // ── Y EL ORDEN SOBREVIVE A UN EMPATE ──────────────────────────────────────
  //
  // Acá vivía una aserción de que los cinco `occurred_at` eran ESTRICTAMENTE
  // ÚNICOS, como tripwire de que el `DEFAULT CURRENT_TIMESTAMP` del DDL no se
  // hubiera vuelto a ejercer. Se retiró porque su premisa era falsa por dos
  // motivos independientes, y mientras estuvo fallaba al azar (medido: tres
  // corridas seguidas con código idéntico dieron verde · rojo · verde).
  //
  // 1. LOS EMPATES SON LEGALES. `appendOrderStatusTransition` acepta un
  //    `occurredAt` explícito — es API pública, y el `orderBy` del endpoint ya
  //    nombra "un occurredAt explícito que un llamador podría repetir" como uno
  //    de los casos para los que existe el desempate. "Estrictamente crecientes"
  //    nunca fue un invariante del sistema.
  //
  // 2. EL MILISEGUNDO COMPARTIDO ES RUIDO DE MÁQUINA, no una propiedad. Los
  //    asientos de una misma tx difieren sólo porque cada `create` cuesta un
  //    viaje de ida y vuelta (medido: 7–9 ms). Nada obliga a cruzar un borde de
  //    milisegundo: en una máquina rápida dos caen en el mismo, y el tripwire
  //    disparaba sin que nada estuviera mal.
  //
  // Lo que la tanda del libro prometió no fue "timestamps únicos" sino "la
  // timeline se lee cronológicamente", y ESO es lo que se afirma acá: se fuerza
  // el empate y se comprueba que la lectura sale en orden de inserción.
  //
  // ── LA DEPENDENCIA QUE ESTO PROTEGE, y que no estaba escrita ───────────────
  //
  // Con `occurred_at` empatado, lo ÚNICO que ordena es `id asc`, y eso funciona
  // porque `cuid()` es MONÓTONO dentro de un proceso (timestamp + contador), así
  // que el orden de id ES el de inserción. Nadie lo había dicho en ningún lado.
  // El día que alguien cambie el generador a `uuid()` —aleatorio— el Recorrido se
  // desordenaría en cada empate, y el tripwire viejo no lo habría notado: sólo
  // miraba los timestamps, nunca el orden bajo empate.
  const empate = new Date(ts[ts.length - 1] + 1000);
  await prisma.$transaction(async (tx) => {
    for (const estado of ['uno', 'dos', 'tres']) {
      await appendOrderStatusTransition(tx, {
        ordenId: orden!.id, eje: 'cobro', estadoAnterior: null, estadoNuevo: estado,
        occurredAt: empate,
      });
    }
  });

  // Y UNO MÁS, insertado AL FINAL pero con un id que ORDENA PRIMERO.
  //
  // Sin esto el test no discrimina, y está medido: quitándole el `id asc` al
  // `orderBy` pasaba igual, 3 de 3 corridas. La razón es que Postgres devuelve las
  // filas empatadas en orden de heap, que para filas recién insertadas ES el de
  // inserción — o sea que los tres de arriba salen bien ordenados por accidente,
  // y la aserción no puede distinguir quién los ordenó.
  //
  // Con un id fijado a mano el orden por id DIFIERE del de inserción, y ahí la
  // pregunta se vuelve contestable: si sale primero, lo ordenó el `id asc`; si sale
  // último, lo ordenó el heap y el desempate no está haciendo nada.
  //
  // El id es artificial a propósito —`cuid()` jamás genera uno así— porque lo que
  // este asiento prueba es el MECANISMO. Los tres de arriba prueban la otra mitad:
  // que con ids reales el desempate coincide con el orden cronológico, que es lo
  // que depende de la monotonía de `cuid()`.
  await prisma.orderStatusTransition.create({
    data: {
      id: '0000-ordena-primero', orden_id: orden!.id, eje: 'cobro',
      estado_anterior: null, estado_nuevo: 'cero', occurred_at: empate,
    },
  });

  const conEmpate = await prisma.orderStatusTransition.findMany({
    where:   { orden_id: orden!.id, occurred_at: empate },
    orderBy: [{ occurred_at: 'asc' }, { id: 'asc' }],
  });
  assert.equal(conEmpate.length, 4, 'los cuatro asientos comparten el instante exacto');
  assert.deepEqual(
    conEmpate.map((a) => a.estado_nuevo),
    ['cero', 'uno', 'dos', 'tres'],
    'con el instante empatado, el orden lo decide el id: "cero" se insertó ÚLTIMO y ' +
    'se lee PRIMERO. Si esto falla, el desempate por id dejó de aplicarse y el ' +
    'Recorrido pasó a depender del orden físico de las filas',
  );
});

test('un PATCH que NO cambia el estado (sólo notas) no deja asiento', async () => {
  const orden = await crearOrden({ numero: 'CN-T00003', estado: 'pendiente' });
  await prisma.$transaction((tx) => transitionOrder(tx, orden.id, { notas_internas: 'nota' }, actor));
  assert.equal((await asientos(orden.id)).length, 0, 'sin cambio de estado, sin asiento');
});
