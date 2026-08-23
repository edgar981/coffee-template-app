import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { REVENUE_ORDER_SCOPE } from '@duna/core/metrics/prisma-scopes';
import { prisma, limpiar } from './fixtures';

// INGRESO INCLUYE LAS CANCELADAS — el scope compartido de la plata.
//
// `REVENUE_ORDER_SCOPE` es la definición ÚNICA de "ingreso" que usan el Dashboard
// (hero, ingresos del mes, histórico, la serie de insights) y los DOS reportes de
// automatización (resumen diario y reporte semanal). Antes excluía las órdenes
// canceladas, y por eso el Dashboard era la única superficie que reportaba menos
// que el libro de Pagos: $259.000 contra los $315.000 de Analítica y Clientes.
//
// La razón de que sumen es doctrinal (§ "El eje de COBRO se escribe una sola vez"):
// cancelar NO toca el `Payment`, así que la plata entró. Un reembolso sería otro
// hecho y hoy no se modela.
//
// ── EL DISCRIMINADOR AFIRMA EL HECHO, NO LA FORMA ───────────────────────────
//
// Un test con mocks pasaría en verde contra el scope viejo: el defecto no estaba
// en cómo se suma sino en QUÉ FILAS entran al `where`. Sólo releer contra una base
// real lo delata. Por eso va en el carril y corre el MISMO `aggregate` que el
// Dashboard y los reportes. El primer caso es el que FALLA con el scope viejo (daba
// 100.000 en vez de 156.000); si pasara igual, el test no discrimina y no sirve.

before(() => limpiar());
beforeEach(() => limpiar());
after(async () => { await limpiar(); await prisma.$disconnect(); });

/** Una orden con su pago. `numero` decide si es real (`CN-`) o demo (`SN-`). */
async function ordenPagada(opts: { numero: string; estado: string; monto: number }) {
  const orden = await prisma.order.create({
    data: {
      numero_orden:   opts.numero,
      cliente_nombre: 'Cliente de prueba',
      estado:         opts.estado,
      total:          opts.monto,
    },
  });
  await prisma.payment.create({
    data: { orden_id: orden.id, monto: opts.monto, metodo: 'NEQUI' },
  });
  return orden;
}

/** El MISMO cálculo que el Dashboard y los reportes: suma del libro de pagos
 *  filtrada por el scope compartido. */
async function ingreso() {
  const agg = await prisma.payment.aggregate({ where: REVENUE_ORDER_SCOPE, _sum: { monto: true } });
  return agg._sum.monto ?? 0;
}

test('un pago sobre una orden CANCELADA suma: la plata entró — falla con el scope viejo', async () => {
  await ordenPagada({ numero: 'CN-100001', estado: 'pagado',    monto: 100_000 });
  await ordenPagada({ numero: 'CN-100002', estado: 'cancelado', monto:  56_000 });

  assert.equal(
    await ingreso(), 156_000,
    'la cancelada tiene que sumar: cancelar no toca el Payment (con el scope viejo daba 100.000)',
  );
});

test('un pago sobre una orden SN- de demo NO suma: el filtro CN- sigue en pie', async () => {
  // El cambio quitó la exclusión de canceladas, NO la de la data de demo. Sin este
  // caso, "incluir canceladas" podría degenerar en "incluir todo".
  await ordenPagada({ numero: 'CN-200001', estado: 'pagado', monto: 80_000 });
  await ordenPagada({ numero: 'SN-000001', estado: 'pagado', monto: 99_000 });

  assert.equal(await ingreso(), 80_000, 'la orden de demo no puede sumar ingreso real');
});

test('el ingreso total = Dashboard = Analítica: 259.000 + 56.000 cancelada = 315.000', async () => {
  // La cifra exacta de la divergencia medida en dev, para que el número que cerró
  // Dashboard↔Analítica quede afirmado y no dependa de que alguien lo recuerde.
  await ordenPagada({ numero: 'CN-300001', estado: 'pagado',    monto: 259_000 });
  await ordenPagada({ numero: 'CN-300002', estado: 'cancelado', monto:  56_000 });

  assert.equal(await ingreso(), 315_000);
});
