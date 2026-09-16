import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lockOrderForPayment, registerOrderPaymentTx, referenciaIntentoPago } from '@duna/core/orders';
import { createNotification } from '@duna/core/notifications';
import { hrefOrden } from '@/constants/automations';
import type { EventoWompi } from '@/lib/pagos/wompi-firma';
import { procesarEventoWompi, type PaymentIntentDb } from '@/app/api/webhooks/wompi/route';
import {
  correrReconciliador,
  UMBRAL_VENCIDO_MS,
  TOPE_POR_BARRIDO,
  type ReconciliadorDb,
  type TransaccionWompiTerminal,
} from '@duna/core/pagos/reconciliador';
import { prisma, limpiar, crearOrden } from './fixtures';

// EL RECONCILIADOR (h)+(i) — CONTRA POSTGRES REAL (WOMPI-RECONCILIADOR-HI-1).
//
// La consulta a Wompi se INYECTA (`consultarWompi`), nunca se hace contra la red
// real — ni este archivo ni el carril tienen credenciales de Wompi. Lo que SÍ es
// real es el lock, la transacción y la escritura: el `SELECT … FOR UPDATE`, la
// atomicidad, y que dos caminos (el webhook y el reconciliador) sobre el MISMO
// intento produzcan un solo Payment. Eso es lo que un doble en memoria no puede
// probar — mismo criterio que `wompi-payment-webhook.test.ts`.
//
// `dbReal`/`reconciliadorDb` de `route.ts`/`app/api/cron/automations/route.ts` NO
// se exportan (son `const` privados) y `touches:` de este slice no los incluye —
// acá se reconstruyen los MISMOS adaptadores, letra por letra, a partir de las
// piezas públicas que ya usan (`lockOrderForPayment`/`registerOrderPaymentTx` de
// `@duna/core/orders`, `createNotification` de `@duna/core/notifications`).

before(() => limpiar());
beforeEach(() => limpiar());
after(async () => { await limpiar(); await prisma.$disconnect(); });

const SECRETO = 'secreto-de-integracion-wompi-reconciliador';
const PROPERTIES = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'];
const TIMESTAMP = 1_726_000_000;

function checksumEsperado(data: Record<string, unknown>): string {
  const resolver = (ruta: string): string =>
    String(ruta.split('.').reduce<unknown>((acc, parte) => (acc as Record<string, unknown>)?.[parte], data));
  const cadena = PROPERTIES.map(resolver).join('') + String(TIMESTAMP) + SECRETO;
  return createHash('sha256').update(cadena).digest('hex');
}

function eventoTransaccion(overrides: {
  id: string;
  reference: string;
  status: string;
  amount_in_cents: number;
}): EventoWompi {
  const data = { transaction: { ...overrides } };
  return { data, timestamp: TIMESTAMP, signature: { properties: PROPERTIES, checksum: checksumEsperado(data) } };
}

/** El adaptador REAL de `ReconciliadorDb` — réplica de `reconciliadorDb` en
 *  `app/api/cron/automations/route.ts`. */
const dbReal: ReconciliadorDb = {
  paymentIntent: {
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
  paymentIntentsEnVuelo: (limite) =>
    prisma.paymentIntent.findMany({
      where:   { estado: 'EN_VUELO' },
      select:  { id: true, orden_id: true, reference: true, monto_esperado: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
      take:    limite,
    }),
  cerrarVencido: async (id) => {
    const { count } = await prisma.paymentIntent.updateMany({
      where: { id, estado: 'EN_VUELO' },
      data:  { estado: 'FALLIDO' },
    });
    return { count };
  },
  notificarAtencion: (input) => createNotification(input),
};

/** El adaptador REAL de `PaymentIntentDb` (el webhook) — réplica de `dbReal` en
 *  `route.ts`, para la prueba de idempotencia cruzada webhook↔reconciliador. */
const dbWebhook: PaymentIntentDb = {
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

/** Un `PaymentIntent` real, con la referencia FINAL, EN_VUELO. `createdAt` es
 *  sobreescribible para simular edad — el mismo campo que `reconciliarIntentoPago`
 *  usa para decidir joven-vs-vencido. */
async function sembrarIntento(opts: {
  ordenId: string;
  numeroOrden: string;
  montoEsperado: number;
  createdAt?: Date;
}) {
  const creado = await prisma.paymentIntent.create({
    data: {
      orden_id:       opts.ordenId,
      reference:      `_seed_pendiente_${opts.ordenId}_${Math.random()}`,
      monto_esperado: opts.montoEsperado,
      estado:         'EN_VUELO',
    },
  });
  const conReferencia = await prisma.paymentIntent.update({
    where: { id: creado.id },
    data:  { reference: referenciaIntentoPago(opts.numeroOrden, creado.id) },
  });
  if (!opts.createdAt) return conReferencia;
  return prisma.paymentIntent.update({ where: { id: creado.id }, data: { createdAt: opts.createdAt } });
}

// ── CASO 1 · JOVEN + APROBADO ────────────────────────────────────────────────

test('joven + Wompi APROBADO: crea el Payment, paga la orden bajo el lock real', async () => {
  const orden = await crearOrden({ numero: 'CN-820001', total: 45_000 });
  const intento = await sembrarIntento({ ordenId: orden.id, numeroOrden: orden.numero_orden, montoEsperado: 45_000 });

  const consultarWompi = async (reference: string): Promise<TransaccionWompiTerminal[]> => {
    assert.equal(reference, intento.reference, 'debe consultar por la REFERENCIA del intento');
    return [{ id: 'txn_recon_1', status: 'APPROVED', amount_in_cents: 4_500_000 }];
  };

  const reporte = await correrReconciliador(new Date(), consultarWompi, hrefOrden, dbReal);

  assert.equal(reporte.consultados, 1);
  assert.equal(reporte.aprobados, 1);

  const intentoFinal = await prisma.paymentIntent.findUniqueOrThrow({ where: { id: intento.id } });
  assert.equal(intentoFinal.estado, 'APROBADO');
  assert.equal(intentoFinal.pspTransactionId, 'txn_recon_1');

  const pagos = await prisma.payment.findMany({ where: { orden_id: orden.id } });
  assert.equal(pagos.length, 1, 'debía crear exactamente un Payment');
  assert.equal(pagos[0].monto, 45_000);
  assert.equal(pagos[0].metodo, 'WOMPI');
  assert.equal(pagos[0].referencia, 'txn_recon_1');

  const ordenFinal = await prisma.order.findUniqueOrThrow({ where: { id: orden.id } });
  assert.equal(ordenFinal.estado, 'pagado');

  const shipping = await prisma.shipping.findUnique({ where: { orden_id: orden.id } });
  assert.ok(shipping, 'debía auto-crear el Shipping al pagar');
});

// ── CASO 2 · JOVEN + APROBADO SOBRE ORDEN YA PAGADA (cobro duplicado) ───────

test('joven + APROBADO sobre una orden YA pagada: cobro duplicado, CERO segundo Payment, notifica', async () => {
  const orden = await crearOrden({ numero: 'CN-820002', total: 30_000 });
  await sembrarIntento({ ordenId: orden.id, numeroOrden: orden.numero_orden, montoEsperado: 30_000 });

  // Primero: paga la orden de verdad, vía el reconciliador.
  const primero = await correrReconciliador(
    new Date(),
    async () => [{ id: 'txn_recon_2a', status: 'APPROVED', amount_in_cents: 3_000_000 }],
    hrefOrden, dbReal,
  );
  assert.equal(primero.aprobados, 1);
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: orden.id } })).estado, 'pagado');

  // Segundo intento, DISTINTO, de la MISMA orden — llega APROBADO después.
  const intento2 = await sembrarIntento({ ordenId: orden.id, numeroOrden: orden.numero_orden, montoEsperado: 30_000 });
  const segundo = await correrReconciliador(
    new Date(),
    async () => [{ id: 'txn_recon_2b', status: 'APPROVED', amount_in_cents: 3_000_000 }],
    hrefOrden, dbReal,
  );

  assert.equal(segundo.aprobados, 1, 'el HECHO de Wompi se cierra igual: el intento sí queda APROBADO');

  const intento2Final = await prisma.paymentIntent.findUniqueOrThrow({ where: { id: intento2.id } });
  assert.equal(intento2Final.estado, 'APROBADO');
  assert.equal(intento2Final.pspTransactionId, 'txn_recon_2b');

  const pagos = await prisma.payment.findMany({ where: { orden_id: orden.id } });
  assert.equal(pagos.length, 1, 'el cobro duplicado no debía crear un segundo Payment');
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: orden.id } })).estado, 'pagado');

  const notis = await prisma.notification.findMany({ where: { tipo: 'wompi_cobro_duplicado' } });
  assert.equal(notis.length, 1, 'debía dejar exactamente una notificación de cobro duplicado');
  assert.match(notis[0].mensaje, /CN-820002/);
  assert.equal(notis[0].href, hrefOrden(orden.numero_orden));
});

// ── CASO 3 · JOVEN + DECLINED ────────────────────────────────────────────────

test('joven + Wompi DECLINED: cierra FALLIDO, cero Payment, la Order queda intacta', async () => {
  const orden = await crearOrden({ numero: 'CN-820003', total: 25_000 });
  const intento = await sembrarIntento({ ordenId: orden.id, numeroOrden: orden.numero_orden, montoEsperado: 25_000 });

  const reporte = await correrReconciliador(
    new Date(),
    async () => [{ id: 'txn_recon_3', status: 'DECLINED', amount_in_cents: 2_500_000 }],
    hrefOrden, dbReal,
  );

  assert.equal(reporte.fallidosPorWompi, 1);
  const intentoFinal = await prisma.paymentIntent.findUniqueOrThrow({ where: { id: intento.id } });
  assert.equal(intentoFinal.estado, 'FALLIDO');
  assert.equal(intentoFinal.pspTransactionId, 'txn_recon_3');
  assert.equal(await prisma.payment.count(), 0);
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: orden.id } })).estado, 'pendiente');
});

// ── CASO 4 · JOVEN + ARRAY VACÍO ─────────────────────────────────────────────

test('joven + array vacío: sigue EN_VUELO', async () => {
  const orden = await crearOrden({ numero: 'CN-820004', total: 20_000 });
  const intento = await sembrarIntento({ ordenId: orden.id, numeroOrden: orden.numero_orden, montoEsperado: 20_000 });

  let llamadas = 0;
  const reporte = await correrReconciliador(
    new Date(),
    async () => { llamadas++; return []; },
    hrefOrden, dbReal,
  );

  assert.equal(llamadas, 1);
  assert.equal(reporte.dejadosEnVuelo, 1);
  const intentoFinal = await prisma.paymentIntent.findUniqueOrThrow({ where: { id: intento.id } });
  assert.equal(intentoFinal.estado, 'EN_VUELO');
  assert.equal(intentoFinal.pspTransactionId, null);
});

// ── CASO 5 · VENCIDO (≥48h) + SIN RESOLVER — la parte (i), pero SEGURA ──────

test('vencido (≥48h) + sin resolver: consulta a Wompi UNA vez (§0, la pieza de seguridad) y cierra FALLIDO sin más consulta', async () => {
  const orden = await crearOrden({ numero: 'CN-820005', total: 18_000 });
  const hace49h = new Date(Date.now() - UMBRAL_VENCIDO_MS - 60 * 60 * 1000);
  const intento = await sembrarIntento({
    ordenId: orden.id, numeroOrden: orden.numero_orden, montoEsperado: 18_000, createdAt: hace49h,
  });

  let llamadas = 0;
  const reporte = await correrReconciliador(
    new Date(),
    async () => { llamadas++; return []; },
    hrefOrden, dbReal,
  );

  assert.equal(llamadas, 1, 'debía consultar a Wompi antes de cerrar por edad — nunca cierra a ciegas');
  assert.equal(reporte.vencidos, 1);
  const intentoFinal = await prisma.paymentIntent.findUniqueOrThrow({ where: { id: intento.id } });
  assert.equal(intentoFinal.estado, 'FALLIDO');
  assert.equal(intentoFinal.pspTransactionId, null, 'nunca hubo evidencia positiva — no se rellena con un centinela');
  assert.equal(intentoFinal.estado_crudo_psp, null);
});

test('joven (<48h) + sin resolver: NO cierra, aunque la edad esté cerca del umbral', async () => {
  const orden = await crearOrden({ numero: 'CN-820009', total: 15_000 });
  const hace47h = new Date(Date.now() - (UMBRAL_VENCIDO_MS - 60 * 60 * 1000));
  const intento = await sembrarIntento({
    ordenId: orden.id, numeroOrden: orden.numero_orden, montoEsperado: 15_000, createdAt: hace47h,
  });

  const reporte = await correrReconciliador(new Date(), async () => [], hrefOrden, dbReal);

  assert.equal(reporte.dejadosEnVuelo, 1);
  assert.equal(reporte.vencidos, 0);
  const intentoFinal = await prisma.paymentIntent.findUniqueOrThrow({ where: { id: intento.id } });
  assert.equal(intentoFinal.estado, 'EN_VUELO');
});

// ── CASO 6 · LA RAZÓN DE SEGURIDAD DE §0, DIRECTA ───────────────────────────

test('SEGURIDAD (§0): vencido (≥48h) pero Wompi dice APROBADO — paga, NUNCA se marca FALLIDO por la sola edad', async () => {
  const orden = await crearOrden({ numero: 'CN-820006', total: 22_000 });
  const hace50h = new Date(Date.now() - UMBRAL_VENCIDO_MS - 2 * 60 * 60 * 1000);
  const intento = await sembrarIntento({
    ordenId: orden.id, numeroOrden: orden.numero_orden, montoEsperado: 22_000, createdAt: hace50h,
  });

  const reporte = await correrReconciliador(
    new Date(),
    async () => [{ id: 'txn_recon_6', status: 'APPROVED', amount_in_cents: 2_200_000 }],
    hrefOrden, dbReal,
  );

  assert.equal(reporte.aprobados, 1);
  assert.equal(reporte.vencidos, 0, 'un intento vencido pero APROBADO NUNCA cuenta como vencido');

  const intentoFinal = await prisma.paymentIntent.findUniqueOrThrow({ where: { id: intento.id } });
  assert.equal(intentoFinal.estado, 'APROBADO');
  const pagos = await prisma.payment.findMany({ where: { orden_id: orden.id } });
  assert.equal(pagos.length, 1);
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: orden.id } })).estado, 'pagado');
});

// ── CASO 7 · WEBHOOK Y RECONCILIADOR SOBRE EL MISMO INTENTO ────────────────

test('el webhook cierra el intento primero: el reconciliador ya no lo ve EN_VUELO — un solo Payment', async () => {
  const orden = await crearOrden({ numero: 'CN-820007', total: 40_000 });
  const intento = await sembrarIntento({ ordenId: orden.id, numeroOrden: orden.numero_orden, montoEsperado: 40_000 });

  const evento = eventoTransaccion({
    id: 'txn_compartido', reference: intento.reference, status: 'APPROVED', amount_in_cents: 4_000_000,
  });
  const resultadoWebhook = await procesarEventoWompi(evento, undefined, SECRETO, dbWebhook);
  assert.equal(resultadoWebhook.motivo, 'cerrado aprobado');

  const reporte = await correrReconciliador(
    new Date(),
    async () => [{ id: 'txn_compartido', status: 'APPROVED', amount_in_cents: 4_000_000 }],
    hrefOrden, dbReal,
  );

  assert.equal(reporte.consultados, 0, 'el intento ya no está EN_VUELO — el reconciliador ni lo mira');
  const pagos = await prisma.payment.findMany({ where: { orden_id: orden.id } });
  assert.equal(pagos.length, 1);
});

test('CONCURRENCIA: webhook y reconciliador procesando el MISMO evento A LA VEZ — un solo Payment, ninguno revienta', async () => {
  const orden = await crearOrden({ numero: 'CN-820008', total: 33_000 });
  const intento = await sembrarIntento({ ordenId: orden.id, numeroOrden: orden.numero_orden, montoEsperado: 33_000 });
  const evento = eventoTransaccion({
    id: 'txn_concurrente', reference: intento.reference, status: 'APPROVED', amount_in_cents: 3_300_000,
  });

  const [resultadoWebhook] = await Promise.all([
    procesarEventoWompi(evento, undefined, SECRETO, dbWebhook),
    correrReconciliador(
      new Date(),
      async () => [{ id: 'txn_concurrente', status: 'APPROVED', amount_in_cents: 3_300_000 }],
      hrefOrden, dbReal,
    ),
  ]);

  // Uno de los dos ganó la carrera del `updateMany` condicional bajo el lock de
  // la Order; el otro vio `count === 0` — el `SELECT … FOR UPDATE` compartido
  // (`lockOrderForPayment`) los serializa, aunque las dos promesas corran juntas.
  assert.ok(['cerrado aprobado', 'cerrado por otra entrega concurrente'].includes(resultadoWebhook.motivo));
  const pagos = await prisma.payment.findMany({ where: { orden_id: orden.id } });
  assert.equal(pagos.length, 1, 'nunca dos Payments del mismo intento, aunque los dos caminos corran a la vez');
  const ordenFinal = await prisma.order.findUniqueOrThrow({ where: { id: orden.id } });
  assert.equal(ordenFinal.estado, 'pagado');
});

// ── CAP DEL BARRIDO ───────────────────────────────────────────────────────────

test('el barrido respeta el TOPE_POR_BARRIDO — no procesa más filas que el cap', async () => {
  const total = TOPE_POR_BARRIDO + 3;
  for (let i = 0; i < total; i++) {
    const orden = await crearOrden({ numero: `CN-8201${String(i).padStart(2, '0')}`, total: 10_000 });
    await sembrarIntento({ ordenId: orden.id, numeroOrden: orden.numero_orden, montoEsperado: 10_000 });
  }

  const reporte = await correrReconciliador(new Date(), async () => [], hrefOrden, dbReal);

  assert.equal(reporte.consultados, TOPE_POR_BARRIDO);
});
