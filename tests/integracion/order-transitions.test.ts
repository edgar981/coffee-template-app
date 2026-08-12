import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createOrderWithCustomer, registerOrderPaymentTx, transitionOrder } from '@duna/core/orders';
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
    brand:    buildBrand(),
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
    brand:    buildBrand(),
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

test('un PATCH que NO cambia el estado (sólo notas) no deja asiento', async () => {
  const orden = await crearOrden({ numero: 'CN-T00003', estado: 'pendiente' });
  await prisma.$transaction((tx) => transitionOrder(tx, orden.id, { notas_internas: 'nota' }, actor));
  assert.equal((await asientos(orden.id)).length, 0, 'sin cambio de estado, sin asiento');
});
