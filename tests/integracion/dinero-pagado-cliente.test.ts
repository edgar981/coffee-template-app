import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { paidTotalByCustomer } from '@duna/core/metrics/customer-order-stats';
import { prisma, limpiar } from './fixtures';

// UNA SOLA DEFINICIÓN DE "DINERO PAGADO POR CLIENTE".
//
// Había DOS caminos al mismo hecho, y no diferían sólo en el período:
// `paidTotalByCustomer` (lista y perfil de Clientes) no filtraba nada, y la
// concentración de Analítica excluía `SN-` Y las canceladas. Medido en dev el día
// de la unificación: **$315.000 contra $259.000** para el mismo conjunto de
// clientes — dos pantallas afirmando el dinero de la misma persona con números
// distintos. Es el modo de falla de "Por cobrar vs Órdenes Pendientes", que se
// arregla de los dos lados o de ninguno.
//
// ── EL DISCRIMINADOR AFIRMA EL HECHO, NO LA FORMA ───────────────────────────
//
// Un test con mocks pasaría en verde contra el código defectuoso: el defecto no
// estaba en el mapeo —los dos sumaban bien lo que cargaban— sino en QUÉ FILAS
// cargaba cada uno. Lo único que lo delata es releer contra una base real. Por eso
// va en el carril, y por eso cada caso afirma un HECHO de negocio:
//
//   1. un pago sobre una orden CANCELADA sí entra en el total del cliente;
//   2. un pago sobre una orden `SN-` de demo NO entra;
//   3. el mismo cliente da el MISMO número desde los dos consumidores.
//
// El tercero es el que importa: SIN el cambio falla (daba 315.000 contra 259.000).
// Si pasara igual, el test no discrimina y no sirve.
//
// **No borrar este archivo** al tocar `paidTotalByCustomer`: es lo único que
// impide que los dos consumidores vuelvan a contar distinto.

before(() => limpiar());
beforeEach(() => limpiar());
after(async () => { await limpiar(); await prisma.$disconnect(); });

/** Una orden del cliente con su pago. `numero` decide si es real o demo. */
async function ordenPagada(opts: {
  clienteId: string;
  numero:    string;
  estado:    string;
  monto:     number;
  fecha:     Date;
}) {
  const orden = await prisma.order.create({
    data: {
      numero_orden: opts.numero,
      cliente_id:   opts.clienteId,
      cliente_nombre: 'Cliente de prueba',
      estado:       opts.estado,
      total:        opts.monto,
    },
  });
  await prisma.payment.create({
    data: { orden_id: orden.id, monto: opts.monto, metodo: 'NEQUI', fecha: opts.fecha },
  });
  return orden;
}

const HOY = new Date();

test('un pago sobre una orden CANCELADA sí entra: la plata entró', async () => {
  // La razón es doctrinal y por eso se afirma: cancelar NO toca el `Payment`. Si
  // esta suma escondiera ese pago, no cuadraría con el libro de Pagos, que sí lo
  // muestra. Un reembolso sería otro hecho y hoy no se modela.
  const c = await prisma.customer.create({ data: { nombre: 'Ana' } });
  await ordenPagada({ clienteId: c.id, numero: 'CN-100001', estado: 'pagado',    monto: 100_000, fecha: HOY });
  await ordenPagada({ clienteId: c.id, numero: 'CN-100002', estado: 'cancelado', monto:  56_000, fecha: HOY });

  const total = await paidTotalByCustomer();
  assert.equal(total.get(c.id), 156_000, 'la cancelada tiene que sumar: el cliente pagó');
});

test('un pago sobre una orden SN- de demo NO entra', async () => {
  // No es definición de negocio: es limpieza de datos de prueba. Ningún camino de
  // runtime emite `SN-`; sólo el seed.
  const c = await prisma.customer.create({ data: { nombre: 'Beto' } });
  await ordenPagada({ clienteId: c.id, numero: 'CN-200001', estado: 'pagado', monto: 80_000, fecha: HOY });
  await ordenPagada({ clienteId: c.id, numero: 'SN-000001', estado: 'pagado', monto: 99_000, fecha: HOY });

  const total = await paidTotalByCustomer();
  assert.equal(total.get(c.id), 80_000, 'la orden de demo no puede sumar dinero real');
});

test('LOS DOS CONSUMIDORES DAN EL MISMO NÚMERO — el caso que falla sin la unificación', async () => {
  // Reproduce la divergencia medida: un pago sobre cancelada (56.000) es justo lo
  // que Analítica escondía y Clientes mostraba. Se afirma que las DOS lecturas
  // —la histórica de Clientes y la del período de Analítica— coinciden.
  const c = await prisma.customer.create({ data: { nombre: 'Carla' } });
  await ordenPagada({ clienteId: c.id, numero: 'CN-300001', estado: 'pagado',    monto: 259_000, fecha: HOY });
  await ordenPagada({ clienteId: c.id, numero: 'CN-300002', estado: 'cancelado', monto:  56_000, fecha: HOY });

  // Como lo lee Clientes: histórico, sin período.
  const comoClientes = await paidTotalByCustomer();
  // Como lo lee Analítica: el MISMO helper con su ventana. La ventana abarca todo,
  // así que cualquier diferencia sería de DEFINICIÓN, que es lo que se afirma.
  const desde = new Date(HOY.getTime() - 86_400_000);
  const hasta = new Date(HOY.getTime() + 86_400_000);
  const comoAnalitica = await paidTotalByCustomer({ desde, hasta });

  assert.equal(comoClientes.get(c.id), 315_000);
  assert.equal(
    comoAnalitica.get(c.id), comoClientes.get(c.id),
    'las dos pantallas tienen que afirmar el mismo dinero del mismo cliente',
  );
});

test('el RANGO acota de verdad, y es lo único que cambia entre los dos alcances', async () => {
  // Sin esto, "una definición, dos alcances" quedaría sin la mitad del alcance:
  // un rango que no filtra haría pasar el test de arriba por la razón equivocada.
  const c = await prisma.customer.create({ data: { nombre: 'Dani' } });
  const viejo = new Date(HOY.getTime() - 40 * 86_400_000);
  await ordenPagada({ clienteId: c.id, numero: 'CN-400001', estado: 'pagado', monto: 10_000, fecha: HOY });
  await ordenPagada({ clienteId: c.id, numero: 'CN-400002', estado: 'pagado', monto: 20_000, fecha: viejo });

  const historico = await paidTotalByCustomer();
  const ventana   = await paidTotalByCustomer({
    desde: new Date(HOY.getTime() - 86_400_000),
    hasta: new Date(HOY.getTime() + 86_400_000),
  });

  assert.equal(historico.get(c.id), 30_000, 'el histórico suma los dos');
  assert.equal(ventana.get(c.id),   10_000, 'la ventana deja fuera el pago viejo');
});
