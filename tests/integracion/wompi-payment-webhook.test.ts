import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lockOrderForPayment, registerOrderPaymentTx, referenciaIntentoPago } from '@duna/core/orders';
import { createNotification } from '@duna/core/notifications';
import { hrefOrden } from '@/constants/automations';
import type { EventoWompi } from '@/lib/pagos/wompi-firma';
import { procesarEventoWompi, type PaymentIntentDb } from '@/app/api/webhooks/wompi/route';
import { prisma, limpiar, crearOrden } from './fixtures';

// EL LOCK, EL COBRO DUPLICADO Y LA IDEMPOTENCIA DE (g) — CONTRA POSTGRES REAL.
//
// `app/api/webhooks/wompi/route.test.ts` (capa 1) prueba la LÓGICA de decisión con
// un `db` fake en memoria: qué rama toma, qué se llama, qué NO se llama. Lo que un
// fake NO puede probar es el `SELECT … FOR UPDATE` real, la atomicidad de la
// transacción de Postgres, y que dos entregas concurrentes de la MISMA orden se
// serialicen de verdad. Eso es lo que este archivo mide — mismo criterio que
// `cobro-sincronizado.test.ts`, `dinero-pagado-cliente.test.ts` e
// `intento-pago-atomico.test.ts`: la concurrencia/atomicidad se prueba con una base
// real o no se prueba.
//
// `dbReal` en `route.ts` NO se exporta (es un `const` privado del módulo) y
// `touches:` de este slice no incluye `route.ts`, así que acá se reconstruye el
// MISMO adaptador — letra por letra — a partir de las TRES piezas públicas que
// `dbReal` ya usa: `lockOrderForPayment`/`registerOrderPaymentTx`
// (`@duna/core/orders`) y `createNotification` (`@duna/core/notifications`). No es
// una segunda implementación de la lógica de negocio: es la MISMA plomería,
// re-ensamblada porque el original es privado. `procesarEventoWompi` sí se importa
// tal cual — es lo que se está midiendo.

before(() => limpiar());
beforeEach(() => limpiar());
after(async () => { await limpiar(); await prisma.$disconnect(); });

const SECRETO = 'secreto-de-integracion-wompi-inventado-para-el-test';
const PROPERTIES = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'];
const TIMESTAMP = 1_726_000_000;

function checksumEsperado(data: Record<string, unknown>): string {
  const resolver = (ruta: string): string =>
    String(ruta.split('.').reduce<unknown>((acc, parte) => (acc as Record<string, unknown>)?.[parte], data));
  const cadena = PROPERTIES.map(resolver).join('') + String(TIMESTAMP) + SECRETO;
  return createHash('sha256').update(cadena).digest('hex');
}

/** Un evento `transaction.updated` sintético, con el checksum calculado para el
 *  secreto y los datos dados — nunca hardcodeado (misma técnica que route.test.ts). */
function eventoTransaccion(overrides: {
  id: string;
  reference: string;
  status: string;
  amount_in_cents: number;
}): EventoWompi {
  const data = { transaction: { ...overrides } };
  return { data, timestamp: TIMESTAMP, signature: { properties: PROPERTIES, checksum: checksumEsperado(data) } };
}

/** El adaptador REAL — Postgres de verdad, sin doble en memoria. Réplica de `dbReal`
 *  en `route.ts`, ensamblada a partir de sus mismas piezas públicas (ver cabecera). */
const dbReal: PaymentIntentDb = {
  paymentIntent: {
    findUnique: (args) => prisma.paymentIntent.findUnique(args),
    updateMany: (args) => prisma.paymentIntent.updateMany(args),
  },
  transaccionConOrdenLockeada: (ordenId, fn) =>
    prisma.$transaction(async (tx) => {
      const orden = await lockOrderForPayment(tx, ordenId);
      return fn(orden, {
        paymentIntent: { updateMany: (args) => tx.paymentIntent.updateMany(args) },
        registrarPago: async ({ monto, referencia }) => {
          await registerOrderPaymentTx(tx, ordenId, { monto, metodo: 'WOMPI', referencia });
        },
      });
    }),
  notificarAtencion: (input) => createNotification(input),
};

/** Un `PaymentIntent` real, con la referencia FINAL (`referenciaIntentoPago`), no un
 *  placeholder — el mismo patrón de dos escrituras que `orders.ts` documenta para
 *  `crearIntentoPago`, porque la referencia embebe el `id` de la propia fila. */
async function sembrarIntento(opts: {
  ordenId: string;
  numeroOrden: string;
  montoEsperado: number;
  estado?: 'EN_VUELO' | 'APROBADO' | 'FALLIDO';
  pspTransactionId?: string | null;
}) {
  const creado = await prisma.paymentIntent.create({
    data: {
      orden_id:         opts.ordenId,
      reference:        `_seed_pendiente_${opts.ordenId}_${Math.random()}`,
      monto_esperado:   opts.montoEsperado,
      estado:           opts.estado ?? 'EN_VUELO',
      pspTransactionId: opts.pspTransactionId ?? null,
    },
  });
  return prisma.paymentIntent.update({
    where: { id: creado.id },
    data:  { reference: referenciaIntentoPago(opts.numeroOrden, creado.id) },
  });
}

// ── CASO 1 · PRIMER APROBADO ─────────────────────────────────────────────────

test('PRIMER APROBADO: crea exactamente un Payment, paga la orden bajo el lock real, y auto-crea el Shipping', async () => {
  const orden = await crearOrden({ numero: 'CN-810001', total: 45_000 });
  const intento = await sembrarIntento({ ordenId: orden.id, numeroOrden: orden.numero_orden, montoEsperado: 45_000 });

  const evento = eventoTransaccion({
    id: 'txn_real_1', reference: intento.reference, status: 'APPROVED', amount_in_cents: 4_500_000,
  });
  const resultado = await procesarEventoWompi(evento, undefined, SECRETO, dbReal);

  assert.equal(resultado.status, 200);
  assert.equal(resultado.motivo, 'cerrado aprobado');

  // El intento quedó cerrado APROBADO, con el id de transacción asentado.
  const intentoFinal = await prisma.paymentIntent.findUniqueOrThrow({ where: { id: intento.id } });
  assert.equal(intentoFinal.estado, 'APROBADO');
  assert.equal(intentoFinal.pspTransactionId, 'txn_real_1');

  // EXACTAMENTE un Payment, con el monto que Wompi CONFIRMÓ (no el esperado, que
  // acá coincide, pero el método debe ser WOMPI y la referencia el id del PSP).
  const pagos = await prisma.payment.findMany({ where: { orden_id: orden.id } });
  assert.equal(pagos.length, 1, 'debía crear exactamente un Payment');
  assert.equal(pagos[0].monto, 45_000);
  assert.equal(pagos[0].metodo, 'WOMPI');
  assert.equal(pagos[0].referencia, 'txn_real_1');

  // La orden quedó pagada — leída fresca, no el snapshot de antes de procesar.
  const ordenFinal = await prisma.order.findUniqueOrThrow({ where: { id: orden.id } });
  assert.equal(ordenFinal.estado, 'pagado');

  // Shipping auto-creado por `transitionOrder` (dentro de `registerOrderPaymentTx`,
  // el CUARTO llamador) — nace en 'preparando', como los otros tres.
  const shipping = await prisma.shipping.findUnique({ where: { orden_id: orden.id } });
  assert.ok(shipping, 'debía auto-crear el Shipping al pagar');
  assert.equal(shipping?.estado, 'preparando');
});

// ── CASO 2 · SEGUNDO APROBADO SOBRE ORDEN YA PAGADA (cobro duplicado) ───────

test('SEGUNDO APROBADO sobre una orden YA pagada (dos PaymentIntent distintos): cierra su intento, CERO segundo Payment, la orden sigue pagada, y notifica al carril de atención', async () => {
  const orden = await crearOrden({ numero: 'CN-810002', total: 30_000 });
  const intento1 = await sembrarIntento({ ordenId: orden.id, numeroOrden: orden.numero_orden, montoEsperado: 30_000 });

  // Primero: paga la orden de verdad, a través del webhook real.
  const primero = await procesarEventoWompi(
    eventoTransaccion({ id: 'txn_real_2a', reference: intento1.reference, status: 'APPROVED', amount_in_cents: 3_000_000 }),
    undefined, SECRETO, dbReal,
  );
  assert.equal(primero.motivo, 'cerrado aprobado');
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: orden.id } })).estado, 'pagado');

  // Segundo intento, DISTINTO, de la MISMA orden — llega APROBADO después.
  const intento2 = await sembrarIntento({ ordenId: orden.id, numeroOrden: orden.numero_orden, montoEsperado: 30_000 });
  const segundo = await procesarEventoWompi(
    eventoTransaccion({ id: 'txn_real_2b', reference: intento2.reference, status: 'APPROVED', amount_in_cents: 3_000_000 }),
    undefined, SECRETO, dbReal,
  );

  assert.equal(segundo.status, 200);
  assert.equal(segundo.motivo, 'cerrado aprobado (cobro duplicado)');

  // El HECHO de Wompi se guarda igual: el segundo intento SÍ cierra APROBADO.
  const intento2Final = await prisma.paymentIntent.findUniqueOrThrow({ where: { id: intento2.id } });
  assert.equal(intento2Final.estado, 'APROBADO');
  assert.equal(intento2Final.pspTransactionId, 'txn_real_2b');

  // Pero NO se crea un segundo Payment, y la orden no se reabre.
  const pagos = await prisma.payment.findMany({ where: { orden_id: orden.id } });
  assert.equal(pagos.length, 1, 'el cobro duplicado no debía crear un segundo Payment');
  const ordenFinal = await prisma.order.findUniqueOrThrow({ where: { id: orden.id } });
  assert.equal(ordenFinal.estado, 'pagado', 'la orden no debía reabrirse');

  // Y quedó UNA fila real en `Notification`, con el número de orden en el mensaje —
  // `createNotification` real, no un espía: esto es lo que sólo el carril puede ver.
  const notis = await prisma.notification.findMany({ where: { tipo: 'wompi_cobro_duplicado' } });
  assert.equal(notis.length, 1, 'debía dejar exactamente una notificación de cobro duplicado');
  assert.equal(notis[0].titulo, 'Cobro duplicado de Wompi');
  assert.match(notis[0].mensaje, /CN-810002/);
  assert.equal(notis[0].href, hrefOrden(orden.numero_orden));
});

// ── CASO 3 · REINTENTO del mismo evento, y el choque de pspTransactionId ────

test('REINTENTO del mismo evento (dos entregas): un solo Payment — el segundo corta en el guard "ya terminal" antes de la transacción', async () => {
  const orden = await crearOrden({ numero: 'CN-810003', total: 20_000 });
  const intento = await sembrarIntento({ ordenId: orden.id, numeroOrden: orden.numero_orden, montoEsperado: 20_000 });
  const evento = eventoTransaccion({ id: 'txn_real_3', reference: intento.reference, status: 'APPROVED', amount_in_cents: 2_000_000 });

  const primero = await procesarEventoWompi(evento, undefined, SECRETO, dbReal);
  assert.equal(primero.motivo, 'cerrado aprobado');

  const segundo = await procesarEventoWompi(evento, undefined, SECRETO, dbReal);
  assert.equal(segundo.status, 200);
  assert.equal(segundo.motivo, 'repetido');

  const pagos = await prisma.payment.findMany({ where: { orden_id: orden.id } });
  assert.equal(pagos.length, 1, 'el reintento del mismo evento no debía crear un segundo Payment');
});

test('choque de pspTransactionId entre DOS intentos distintos (mismo id de Wompi, unique real de Postgres): no revienta, no pisa, no paga', async () => {
  const ordenA = await crearOrden({ numero: 'CN-810004', total: 15_000 });
  const ordenB = await crearOrden({ numero: 'CN-810005', total: 15_000 });
  const intentoA = await sembrarIntento({ ordenId: ordenA.id, numeroOrden: ordenA.numero_orden, montoEsperado: 15_000 });
  const intentoB = await sembrarIntento({
    ordenId: ordenB.id, numeroOrden: ordenB.numero_orden, montoEsperado: 15_000,
    estado: 'APROBADO', pspTransactionId: 'txn_real_compartido',
  });

  // `intentoB` YA tiene asentado `txn_real_compartido` — la unique de Postgres es
  // la pieza que sostiene la idempotencia (PASARELA-DOC-AL-DIA-1). Un evento que
  // trae el MISMO id de transacción para `intentoA` debe chocar contra ella.
  const evento = eventoTransaccion({
    id: 'txn_real_compartido', reference: intentoA.reference, status: 'APPROVED', amount_in_cents: 1_500_000,
  });
  const resultado = await procesarEventoWompi(evento, undefined, SECRETO, dbReal);

  assert.equal(resultado.status, 200);
  assert.equal(resultado.motivo, 'id de transacción ya asentado en otro intento');

  // No se pisó: `intentoA` sigue EN_VUELO (la transacción entera se revirtió), y
  // `intentoB` sigue exactamente como estaba.
  const intentoAFinal = await prisma.paymentIntent.findUniqueOrThrow({ where: { id: intentoA.id } });
  assert.equal(intentoAFinal.estado, 'EN_VUELO');
  assert.equal(intentoAFinal.pspTransactionId, null);
  const intentoBFinal = await prisma.paymentIntent.findUniqueOrThrow({ where: { id: intentoB.id } });
  assert.equal(intentoBFinal.pspTransactionId, 'txn_real_compartido');

  // Y no se creó ningún Payment de ninguna de las dos órdenes.
  assert.equal(await prisma.payment.count(), 0);
});

// ── CASO 4 · FALLIDO ──────────────────────────────────────────────────────────

test('FALLIDO (DECLINED): cierra el intento FALLIDO, cero Payment, la Order queda intacta', async () => {
  const orden = await crearOrden({ numero: 'CN-810006', total: 25_000 });
  const intento = await sembrarIntento({ ordenId: orden.id, numeroOrden: orden.numero_orden, montoEsperado: 25_000 });
  const evento = eventoTransaccion({ id: 'txn_real_4', reference: intento.reference, status: 'DECLINED', amount_in_cents: 2_500_000 });

  const resultado = await procesarEventoWompi(evento, undefined, SECRETO, dbReal);

  assert.equal(resultado.status, 200);
  assert.equal(resultado.motivo, 'cerrado fallido');

  const intentoFinal = await prisma.paymentIntent.findUniqueOrThrow({ where: { id: intento.id } });
  assert.equal(intentoFinal.estado, 'FALLIDO');
  assert.equal(intentoFinal.pspTransactionId, 'txn_real_4');

  assert.equal(await prisma.payment.count(), 0);
  const ordenFinal = await prisma.order.findUniqueOrThrow({ where: { id: orden.id } });
  assert.equal(ordenFinal.estado, 'pendiente');
  assert.equal(await prisma.shipping.count({ where: { orden_id: orden.id } }), 0);
});
