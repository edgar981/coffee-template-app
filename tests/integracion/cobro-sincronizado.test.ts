import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  transitionOrder,
  registerOrderPaymentTx,
  createOrderWithCustomer,
  assertEstadoNoEsCobro,
  CobroEstadoNoEscribibleError,
  type OrderTransitionData,
} from '@duna/core/orders';
import { buildBrand } from '@/lib/config/brand';
import { prisma, limpiar, crearOrden } from './fixtures';

// NINGUNA TRANSICIÓN DESINCRONIZA Order↔Payment, EN NINGUNA DIRECCIÓN.
//
// El defecto tenía DOS caras y las dos nacían de la misma raíz: `transitionOrder`
// trataba `estado` como campo libre y el PATCH lo exponía crudo, así que un
// dropdown podía:
//   • pendiente→pagado SIN crear Payment  → plata fantasma (ingreso sin respaldo);
//   • pagado→pendiente dejando el Payment → orden "pendiente" con el pago vivo.
//
// El fix es por IMPOSIBILIDAD: el eje de cobro (pagado/pendiente) ya no se escribe
// por ninguna ruta HTTP. `assertEstadoNoEsCobro` gatea las dos puertas —el PATCH
// de orden y `createOrderWithCustomer`— y el único camino a `pagado` es el path de
// dinero (`registerOrderPaymentTx`), que crea el Payment y mueve la orden en la
// MISMA transacción.
//
// POR QUÉ ESTE TEST VA EN EL CARRIL: lo que se afirma no es la forma de un objeto,
// es que la fila Order y sus filas Payment CONCUERDAN después de escribir. Fue la
// capa que faltó en el diagnóstico de pagado→pendiente: un test de UI no ve la
// desincronización, y un test con mocks tampoco — hay que releer las dos tablas.
// El carril no monta handlers HTTP, así que `patchComoLaRuta` replica EXACTAMENTE
// la secuencia del route handler (guarda → transacción) para ejercer "desde la
// ruta" contra una base real.

before(() => limpiar());
beforeEach(() => limpiar());
after(async () => { await limpiar(); await prisma.$disconnect(); });

// El invariante de sincronización, en sus dos mitades:
//   A) estado='pagado'  ⇒ existe al menos un Payment  (no hay plata fantasma)
//   B) existe un Payment ⇒ estado ≠ 'pendiente'        (no hay pago huérfano)
// `cancelado` es ortogonal: una orden cancelada PUEDE conservar su Payment (§4).
async function assertSincronizada(orderId: string, contexto: string) {
  const o = await prisma.order.findUniqueOrThrow({
    where:  { id: orderId },
    select: { estado: true, payments: { select: { id: true } } },
  });
  const pagos = o.payments.length;
  if (o.estado === 'pagado') {
    assert.ok(pagos >= 1, `${contexto}: estado='pagado' con ${pagos} pagos — plata fantasma`);
  }
  if (pagos >= 1) {
    assert.notEqual(o.estado, 'pendiente', `${contexto}: ${pagos} pagos pero estado='pendiente' — pago huérfano`);
  }
  return { estado: o.estado, pagos };
}

// Réplica FIEL de app/api/orders/[id]/route.ts: la guarda corre ANTES de abrir la
// transacción, así que un estado de cobro se rechaza sin tocar la orden.
async function patchComoLaRuta(id: string, data: OrderTransitionData) {
  assertEstadoNoEsCobro(data.estado);
  return prisma.$transaction((tx) => transitionOrder(tx, id, data));
}

test('el path de dinero es el ÚNICO camino a pagado, y sincroniza atómicamente', async () => {
  const orden = await crearOrden({ numero: 'CN-100001', estado: 'pendiente' });
  await assertSincronizada(orden.id, 'recién creada');

  await prisma.$transaction((tx) =>
    registerOrderPaymentTx(tx, orden.id, { monto: orden.total, metodo: 'TRANSFERENCIA' }),
  );

  const post = await assertSincronizada(orden.id, 'tras registrar pago');
  assert.equal(post.estado, 'pagado');
  assert.equal(post.pagos, 1);
});

test('la guarda rechaza AMBAS direcciones del eje de cobro; deja pasar cancelado y no-tocar', () => {
  // Las dos caras del bug:
  assert.throws(() => assertEstadoNoEsCobro('pagado'), CobroEstadoNoEscribibleError);
  assert.throws(() => assertEstadoNoEsCobro('pendiente'), CobroEstadoNoEscribibleError);
  // Lo legítimo:
  assert.doesNotThrow(() => assertEstadoNoEsCobro('cancelado'));
  assert.doesNotThrow(() => assertEstadoNoEsCobro(null));
  assert.doesNotThrow(() => assertEstadoNoEsCobro(undefined));
});

test('phantom-pagado: la ruta NO puede poner pagado sin Payment (deja la fila intacta)', async () => {
  const orden = await crearOrden({ numero: 'CN-100002', estado: 'pendiente' });

  await assert.rejects(
    () => patchComoLaRuta(orden.id, { estado: 'pagado' }),
    CobroEstadoNoEscribibleError,
  );

  // La orden ni se movió, y sigue sin pago.
  const post = await assertSincronizada(orden.id, 'tras intento phantom-pagado');
  assert.equal(post.estado, 'pendiente');
  assert.equal(post.pagos, 0);
});

test('revertir pagado→pendiente por la ruta es imposible (el Payment no queda huérfano)', async () => {
  const orden = await crearOrden({ numero: 'CN-100003', estado: 'pendiente' });
  await prisma.$transaction((tx) =>
    registerOrderPaymentTx(tx, orden.id, { monto: orden.total, metodo: 'NEQUI' }),
  );

  await assert.rejects(
    () => patchComoLaRuta(orden.id, { estado: 'pendiente' }),
    CobroEstadoNoEscribibleError,
  );

  const post = await assertSincronizada(orden.id, 'tras intento de reversión');
  assert.equal(post.estado, 'pagado');
  assert.equal(post.pagos, 1);
});

test('createOrderWithCustomer rechaza un estado de cobro crudo y NO escribe fila', async () => {
  const base = {
    customer: { nombre: 'Z', telefono: '3001234567' },
    canal:    'directo',
    total:    28000,
    items:    [{ producto_nombre: 'Café', cantidad: 1, subtotal: 28000 }],
    brand:    buildBrand(),
  };

  for (const estado of ['pagado', 'pendiente'] as const) {
    await assert.rejects(
      () => createOrderWithCustomer({ ...base, estado }),
      CobroEstadoNoEscribibleError,
      `estado='${estado}' debía rechazarse`,
    );
  }
  // Ni una orden escrita: la guarda corta en el borde de la función (antes incluso
  // de la validación de identidad del cliente).
  assert.equal(await prisma.order.count(), 0);
});

test('cancelar es una transición legítima y NO toca el Payment (comportamiento documentado)', async () => {
  const orden = await crearOrden({ numero: 'CN-100004', estado: 'pendiente' });
  await prisma.$transaction((tx) =>
    registerOrderPaymentTx(tx, orden.id, { monto: orden.total, metodo: 'EFECTIVO' }),
  );

  const cancelada = await patchComoLaRuta(orden.id, { estado: 'cancelado' });
  assert.equal(cancelada?.estado, 'cancelado');

  // El pago sobrevive a la cancelación: es la conversación aparte de "pagos sobre
  // canceladas". `assertSincronizada` lo acepta (cancelado con pago es válido).
  const post = await assertSincronizada(orden.id, 'tras cancelar una orden pagada');
  assert.equal(post.pagos, 1);
});

test('recorrido completo crear→cobrar→cancelar: sincronizado en CADA paso, con intentos ilegales de por medio', async () => {
  const orden = await crearOrden({ numero: 'CN-100005', estado: 'pendiente' });
  assert.deepEqual(await assertSincronizada(orden.id, 'paso 1'), { estado: 'pendiente', pagos: 0 });

  // Intento ilegal (phantom-pagado) NO altera nada.
  await assert.rejects(() => patchComoLaRuta(orden.id, { estado: 'pagado' }), CobroEstadoNoEscribibleError);
  assert.deepEqual(await assertSincronizada(orden.id, 'paso 1 tras intento ilegal'), { estado: 'pendiente', pagos: 0 });

  // Cobro por el único camino válido.
  await prisma.$transaction((tx) =>
    registerOrderPaymentTx(tx, orden.id, { monto: orden.total, metodo: 'TRANSFERENCIA' }),
  );
  assert.deepEqual(await assertSincronizada(orden.id, 'paso 2'), { estado: 'pagado', pagos: 1 });

  // Intento ilegal (reversión) NO altera nada.
  await assert.rejects(() => patchComoLaRuta(orden.id, { estado: 'pendiente' }), CobroEstadoNoEscribibleError);
  assert.deepEqual(await assertSincronizada(orden.id, 'paso 2 tras intento ilegal'), { estado: 'pagado', pagos: 1 });

  // Cancelación legítima.
  await patchComoLaRuta(orden.id, { estado: 'cancelado' });
  assert.deepEqual(await assertSincronizada(orden.id, 'paso 3'), { estado: 'cancelado', pagos: 1 });
});
