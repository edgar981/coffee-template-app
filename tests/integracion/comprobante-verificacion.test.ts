import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  decidirComprobante, crearComprobante, ComprobanteYaDecidido,
  PagoRequeridoParaVerificar, EfectivoConComprobanteError,
  type PagoAlVerificar,
} from '@duna/core/comprobantes';
import { registerOrderPaymentTx, FechaFuturaError } from '@duna/core/orders';
import { accionAlVerificar } from '@/lib/comprobante';
import { runEventAutomations } from '@/lib/automations/engine';
import {
  prisma, limpiar, crearOrden, crearComprobanteFixture, soloActiva, runsDe,
} from './fixtures';

// LA EVIDENCIA Y LA PLATA SON DOS HECHOS, Y VERIFICAR ES LO QUE LOS UNE.
//
// `Payment` es la plata; `Comprobante` es la foto que el cliente mandó (§3.1).
// § Decisión — Cuándo un pedido está pagado: sobre una orden PENDIENTE, verificar
// el comprobante CREA el Payment (tercer llamador de `registerOrderPaymentTx`, en
// la MISMA transacción que sella). Sobre una ya pagada, sólo SELLA. Rechazar nunca
// toca la orden. Lo que este archivo afirma no es la forma de un objeto —eso lo
// cubre `lib/comprobante.test.ts` en capa 1— sino qué FILAS quedan después:
//
//   • verificar una orden pendiente deja plata + sello + orden pagada;
//   • dos comprobantes de la misma orden verificados a la vez dejan UN solo Payment
//     (la guarda es el FOR UPDATE, no una unique — corrido sin él, da dos);
//   • verificar-que-cobra dispara `order.pagado` (o el cliente no se entera);
//   • rechazar no crea plata, no borra, y no mueve la orden.
//
// Nada de esto se simula con mocks: hay que releer las filas de las dos tablas.

before(() => limpiar());
beforeEach(() => limpiar());
after(async () => { await limpiar(); await prisma.$disconnect(); });

const VEREDICTO = { por: 'user_owner', nombre: 'Dueño Test' };
const TRANSFERENCIA: PagoAlVerificar = { metodo: 'TRANSFERENCIA' };

const pagosDe = (ordenId: string) => prisma.payment.findMany({ where: { orden_id: ordenId } });

// Réplica FIEL de la secuencia del route PATCH /api/comprobantes/[id]: verifica y,
// SÓLO si eso creó el Payment, dispara `order.pagado`. El carril no monta HTTP, así
// que ésta es la forma de afirmar que el emisor está cableado — no basta con que
// `decidirComprobante` cree la plata; el aviso al cliente vive en el route.
async function verificarComoLaRuta(comprobanteId: string, pago?: PagoAlVerificar) {
  const { comprobante, pagoCreado } = await decidirComprobante(comprobanteId, 'VERIFICADO', VEREDICTO, pago);
  if (pagoCreado && comprobante) {
    await runEventAutomations({ tipo: 'order.pagado', orderId: comprobante.orden_id });
  }
  return { comprobante, pagoCreado };
}

// ─── El caso que esta entidad existe para permitir ───────────────────────────

test('una orden puede tener comprobante SIN pago — el caso que un campo en Payment no podría representar', async () => {
  const orden = await crearOrden({ numero: 'CN-100001' });
  await crearComprobanteFixture({ ordenId: orden.id });

  const recargada = await prisma.order.findUniqueOrThrow({
    where: { id: orden.id }, include: { comprobantes: true, payments: true },
  });
  assert.equal(recargada.comprobantes.length, 1);
  assert.equal(recargada.comprobantes[0].estado, 'RECIBIDO');
  assert.equal(recargada.payments.length, 0);
  // Adjuntar evidencia NO mueve la orden.
  assert.equal(recargada.estado, 'pendiente');
});

// ─── Verificar una orden pendiente CREA la plata ─────────────────────────────

test('verificar una orden pendiente CREA el Payment y la deja pagada — en una sola llamada', async () => {
  const orden = await crearOrden({ numero: 'CN-100002', total: 45000 });
  const comprobante = await crearComprobanteFixture({ ordenId: orden.id });

  // La decisión de producto: sobre una orden pendiente, verificar COBRA.
  assert.equal(accionAlVerificar(orden.estado), 'cobrar');

  const { comprobante: sellado, pagoCreado } =
    await decidirComprobante(comprobante.id, 'VERIFICADO', VEREDICTO, TRANSFERENCIA);

  assert.equal(pagoCreado, true, 'la verificación creó la plata');
  assert.equal(sellado!.estado, 'VERIFICADO');
  assert.equal(sellado!.verificado_por_nombre, 'Dueño Test');
  assert.ok(sellado!.verificado_at, 'el sello estampa CUÁNDO se verificó');

  const pagos = await pagosDe(orden.id);
  assert.equal(pagos.length, 1);
  assert.equal(pagos[0].monto, 45000, 'el monto sale de order.total server-side, no del input');
  assert.equal(pagos[0].metodo, 'TRANSFERENCIA');

  // La orden quedó pagada, y la movió el Payment (que ahora nace de verificar).
  const recargada = await prisma.order.findUniqueOrThrow({ where: { id: orden.id } });
  assert.equal(recargada.estado, 'pagado');
});

test('la fecha del Payment es CUÁNDO ENTRÓ la plata, no cuándo se verificó', async () => {
  const orden = await crearOrden({ numero: 'CN-100002b', total: 20000 });
  const comprobante = await crearComprobanteFixture({ ordenId: orden.id });
  const entroEl = new Date('2026-08-10T15:00:00.000Z');

  await decidirComprobante(comprobante.id, 'VERIFICADO', VEREDICTO, { metodo: 'NEQUI', fecha: entroEl });

  const [pago] = await pagosDe(orden.id);
  assert.equal(pago.fecha.toISOString(), entroEl.toISOString(), 'fecha = fecha de negocio');
  // `createdAt` es la auditoría (ahora), distinta de la fecha de negocio pasada.
  assert.notEqual(pago.createdAt.toISOString(), entroEl.toISOString());
});

test('con la plata ya adentro, verificar sólo SELLA: no aparece un segundo Payment', async () => {
  const orden = await crearOrden({ numero: 'CN-100003', total: 30000 });
  await prisma.$transaction((tx) => registerOrderPaymentTx(tx, orden.id, { monto: orden.total, metodo: 'NEQUI' }));
  const comprobante = await crearComprobanteFixture({ ordenId: orden.id });

  const pagada = await prisma.order.findUniqueOrThrow({ where: { id: orden.id } });
  assert.equal(accionAlVerificar(pagada.estado), 'sellar');

  // Sin `pago`: sobre una orden ya pagada no hace falta, y el sello no crea plata.
  const { pagoCreado } = await decidirComprobante(comprobante.id, 'VERIFICADO', VEREDICTO);
  assert.equal(pagoCreado, false);
  assert.equal((await pagosDe(orden.id)).length, 1);
});

// ─── Las guardas del cobro por verificación ──────────────────────────────────

test('verificar una orden pendiente SIN método falla, y la transacción entera revierte', async () => {
  const orden = await crearOrden({ numero: 'CN-100003b' });
  const c = await crearComprobanteFixture({ ordenId: orden.id });

  await assert.rejects(() => decidirComprobante(c.id, 'VERIFICADO', VEREDICTO), PagoRequeridoParaVerificar);

  // Ni pago, ni sello: el throw va DESPUÉS del sello dentro de la tx, así que revierte.
  assert.equal((await pagosDe(orden.id)).length, 0);
  const recargado = await prisma.comprobante.findUniqueOrThrow({ where: { id: c.id } });
  assert.equal(recargado.estado, 'RECIBIDO', 'el sello se revirtió con la transacción');
  const ordenR = await prisma.order.findUniqueOrThrow({ where: { id: orden.id } });
  assert.equal(ordenR.estado, 'pendiente');
});

test('EFECTIVO con comprobante se rechaza en el SERVER, no solo en el select', async () => {
  const orden = await crearOrden({ numero: 'CN-100003c' });
  const c = await crearComprobanteFixture({ ordenId: orden.id });

  await assert.rejects(
    () => decidirComprobante(c.id, 'VERIFICADO', VEREDICTO, { metodo: 'EFECTIVO' }),
    EfectivoConComprobanteError,
  );

  assert.equal((await pagosDe(orden.id)).length, 0);
  const recargado = await prisma.comprobante.findUniqueOrThrow({ where: { id: c.id } });
  assert.equal(recargado.estado, 'RECIBIDO', 'rechazo total: ni pago ni sello');
});

test('una fecha de pago FUTURA se rechaza: un pago que aún no entró no se registra', async () => {
  const orden = await crearOrden({ numero: 'CN-100003d', total: 15000 });
  const c = await crearComprobanteFixture({ ordenId: orden.id });
  const manana = new Date(Date.now() + 24 * 3_600_000);

  await assert.rejects(
    () => decidirComprobante(c.id, 'VERIFICADO', VEREDICTO, { metodo: 'TRANSFERENCIA', fecha: manana }),
    FechaFuturaError,
  );

  // Revirtió entera: ni pago, ni sello.
  assert.equal((await pagosDe(orden.id)).length, 0);
  const recargado = await prisma.comprobante.findUniqueOrThrow({ where: { id: c.id } });
  assert.equal(recargado.estado, 'RECIBIDO');
});

// ─── Rechazar NO crea plata, NO borra, NO mueve la orden ──────────────────────

test('rechazar conserva la fila Y la url, y no crea ningún Payment', async () => {
  const orden = await crearOrden({ numero: 'CN-100004' });
  const comprobante = await crearComprobanteFixture({ ordenId: orden.id });
  const urlOriginal = comprobante.url;

  const { comprobante: rechazado, pagoCreado } = await decidirComprobante(comprobante.id, 'RECHAZADO', {
    ...VEREDICTO, notas: 'El monto no corresponde a esta orden.',
  });

  assert.equal(pagoCreado, false);
  assert.equal(rechazado!.estado, 'RECHAZADO');
  // SIN BORRADO FÍSICO: un comprobante rechazado ES la prueba de que se rechazó.
  assert.equal(rechazado!.url, urlOriginal);
  assert.equal(rechazado!.notas_verificacion, 'El monto no corresponde a esta orden.');

  assert.equal((await pagosDe(orden.id)).length, 0);
  const recargada = await prisma.order.findUniqueOrThrow({ where: { id: orden.id } });
  assert.equal(recargada.estado, 'pendiente');
});

test('verificar una orden pendiente SÍ la mueve —vía el Payment que crea—; rechazar NO', async () => {
  // Rechazar deja la orden intacta.
  const ordenR = await crearOrden({ numero: 'CN-100007r' });
  const cR = await crearComprobanteFixture({ ordenId: ordenR.id });
  await decidirComprobante(cR.id, 'RECHAZADO', VEREDICTO);
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: ordenR.id } })).estado, 'pendiente');
  assert.equal((await pagosDe(ordenR.id)).length, 0);

  // Verificar sobre pendiente la pasa a pagado — pero por el Payment, no por el sello.
  const ordenV = await crearOrden({ numero: 'CN-100007v' });
  const cV = await crearComprobanteFixture({ ordenId: ordenV.id });
  await decidirComprobante(cV.id, 'VERIFICADO', VEREDICTO, TRANSFERENCIA);
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: ordenV.id } })).estado, 'pagado');
  assert.equal((await pagosDe(ordenV.id)).length, 1);
});

// ─── El veredicto no se reescribe ────────────────────────────────────────────

test('un comprobante ya decidido no se vuelve a decidir: el sello de auditoría no se pisa', async () => {
  const orden = await crearOrden({ numero: 'CN-100005' });
  const comprobante = await crearComprobanteFixture({ ordenId: orden.id });

  await decidirComprobante(comprobante.id, 'RECHAZADO', VEREDICTO);
  const primero = await prisma.comprobante.findUniqueOrThrow({ where: { id: comprobante.id } });

  // Reintentar verificar: el sello falla (count 0) ANTES de tocar plata, así que
  // ni siquiera hace falta el método — la transacción revierte por completo.
  await assert.rejects(
    () => decidirComprobante(comprobante.id, 'VERIFICADO', { por: 'otro', nombre: 'Otra Persona' }, TRANSFERENCIA),
    (e: unknown) => e instanceof ComprobanteYaDecidido,
  );

  const despues = await prisma.comprobante.findUniqueOrThrow({ where: { id: comprobante.id } });
  assert.equal(despues.estado, 'RECHAZADO');
  assert.equal(despues.verificado_por_nombre, 'Dueño Test');
  assert.deepEqual(despues.verificado_at, primero.verificado_at);
  // Y el intento fallido NO dejó un Payment.
  assert.equal((await pagosDe(orden.id)).length, 0);
});

test('dos veredictos CONCURRENTES sobre el MISMO comprobante: uno gana, el otro es rechazado', async () => {
  const orden = await crearOrden({ numero: 'CN-100006' });
  const comprobante = await crearComprobanteFixture({ ordenId: orden.id });

  // La transición es condicional en UNA sentencia (`updateMany` con el estado en el
  // `where`), así que no hay ventana entre leer y escribir.
  const resultados = await Promise.allSettled([
    decidirComprobante(comprobante.id, 'VERIFICADO', { por: 'a', nombre: 'Persona A' }, TRANSFERENCIA),
    decidirComprobante(comprobante.id, 'RECHAZADO',  { por: 'b', nombre: 'Persona B' }),
  ]);

  const ok = resultados.filter(r => r.status === 'fulfilled');
  assert.equal(ok.length, 1, 'exactamente uno de los dos veredictos debe quedar');

  const final = await prisma.comprobante.findUniqueOrThrow({ where: { id: comprobante.id } });
  assert.notEqual(final.estado, 'RECIBIDO');
  // Si ganó VERIFICADO hay 1 Payment; si ganó RECHAZADO hay 0. Nunca 2.
  assert.ok((await pagosDe(orden.id)).length <= 1, 'jamás dos Payments');
});

// ─── LA PRUEBA CENTRAL: el FOR UPDATE contra el doble Payment ─────────────────

test('CONCURRENCIA: dos comprobantes de la MISMA orden pendiente, verificados a la vez → EXACTAMENTE 1 Payment', async () => {
  // Sin el `SELECT … FOR UPDATE` de `decidirComprobante`, los dos leen `pendiente`
  // y cada uno crea su Payment: dos pagos por una sola plata. El lock serializa —
  // el segundo ve `pagado` y cae en sellar. Corrido SIN el FOR UPDATE da 2 y falla;
  // si pasa igual, no prueba nada.
  const orden = await crearOrden({ numero: 'CN-100008', total: 50000 });
  const a = await crearComprobanteFixture({ ordenId: orden.id });
  const b = await crearComprobanteFixture({ ordenId: orden.id });

  const res = await Promise.allSettled([
    decidirComprobante(a.id, 'VERIFICADO', VEREDICTO, { metodo: 'TRANSFERENCIA' }),
    decidirComprobante(b.id, 'VERIFICADO', VEREDICTO, { metodo: 'NEQUI' }),
  ]);

  // Los dos comprobantes son distintos, así que los dos sellos quedan…
  assert.equal(res.filter(r => r.status === 'fulfilled').length, 2, 'los dos sellan');
  const comps = await prisma.comprobante.findMany({ where: { orden_id: orden.id } });
  assert.ok(comps.every(c => c.estado === 'VERIFICADO'), 'los dos quedaron verificados');

  // …pero el Payment es UNO.
  const pagos = await pagosDe(orden.id);
  assert.equal(pagos.length, 1, `EXACTAMENTE un Payment; hubo ${pagos.length}`);
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: orden.id } })).estado, 'pagado');
});

// ─── El emisor de `order.pagado` está cableado ───────────────────────────────

test('verificar-que-cobra dispara `order.pagado` — sin eso, orden pagada y cliente sin avisar', async () => {
  // El emisor vive en el route; `verificarComoLaRuta` replica su secuencia. Corrido
  // SIN el disparo, `runsDe` da 0 y este assert cae — el fallo sería silencioso.
  await soloActiva('nueva_orden');
  const orden = await crearOrden({ numero: 'CN-100009', total: 40000, cliente_telefono: '3001234567' });
  const comprobante = await crearComprobanteFixture({ ordenId: orden.id });

  const { pagoCreado } = await verificarComoLaRuta(comprobante.id, TRANSFERENCIA);
  assert.equal(pagoCreado, true);

  const runs = await runsDe('nueva_orden');
  assert.equal(runs.length, 1, 'la verificación que cobra tiene que disparar order.pagado');
  assert.equal(runs[0].targetId, orden.id);
});

test('verificar-que-sólo-SELLA (orden ya pagada) NO redispara `order.pagado`', async () => {
  await soloActiva('nueva_orden');
  const orden = await crearOrden({ numero: 'CN-100010', total: 40000, cliente_telefono: '3001234567' });
  await prisma.$transaction((tx) => registerOrderPaymentTx(tx, orden.id, { monto: orden.total, metodo: 'NEQUI' }));
  const comprobante = await crearComprobanteFixture({ ordenId: orden.id });

  const { pagoCreado } = await verificarComoLaRuta(comprobante.id);
  assert.equal(pagoCreado, false);
  // El route sólo dispara si `pagoCreado`. Sellar no crea plata nueva → no hay run.
  assert.equal((await runsDe('nueva_orden')).length, 0);
});

// ─── El puntero, no los bytes ────────────────────────────────────────────────

test('la fila guarda una URL y su metadata, jamás el archivo', async () => {
  const orden = await crearOrden({ numero: 'CN-100011' });
  const creado = await crearComprobante({
    ordenId:         orden.id,
    url:             'https://x.public.blob.vercel-storage.com/dev/comprobantes/bancolombia-abc.pdf',
    contentType:     'application/pdf',
    sizeBytes:       250_000,
    subidoPor:       'user_test',
    subidoPorNombre: 'Operador Test',
  });

  assert.equal(creado.estado, 'RECIBIDO', 'nace RECIBIDO: subir no es verificar');
  assert.equal(creado.content_type, 'application/pdf');
  assert.equal(creado.size_bytes, 250_000);
  assert.match(creado.url, /\/dev\/comprobantes\//);
});
