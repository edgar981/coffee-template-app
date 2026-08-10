import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { decidirComprobante, crearComprobante, ComprobanteYaDecidido } from '@duna/core/comprobantes';
import { registerOrderPaymentTx } from '@duna/core/orders';
import { accionAlVerificar } from '@/lib/comprobante';
import { prisma, limpiar, crearOrden, crearComprobanteFixture } from './fixtures';

// LA EVIDENCIA Y LA PLATA SON DOS HECHOS, Y LA CADENA QUE LOS UNE VA EN UN ORDEN.
//
// `Payment` es la plata; `Comprobante` es la foto que el cliente mandó (§3.1).
// Lo que este archivo afirma no es la forma de un objeto —eso lo cubre
// `lib/comprobante.test.ts` en capa 1— sino qué FILAS quedan después de escribir:
//
//   • verificar un soporte de una orden sin pago CREA la plata y sella la
//     evidencia, y las dos cosas quedan en la base;
//   • rechazar NO crea ningún Payment y NO borra nada;
//   • ningún veredicto mueve `Order.estado` por su cuenta.
//
// Nada de esto se puede simular con mocks: el objeto que se construye al
// verificar es exactamente el que Prisma escribiría en los dos casos. Lo que
// delata la diferencia es releer las filas.

before(() => limpiar());
beforeEach(() => limpiar());
after(async () => { await limpiar(); await prisma.$disconnect(); });

const VEREDICTO = { por: 'user_owner', nombre: 'Dueño Test' };

const pagosDe = (ordenId: string) => prisma.payment.findMany({ where: { orden_id: ordenId } });

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

// ─── Verificar CREA la plata ─────────────────────────────────────────────────

test('verificar con la orden pendiente: primero el Payment, después el sello — y los dos quedan', async () => {
  const orden = await crearOrden({ numero: 'CN-100002', total: 45000 });
  const comprobante = await crearComprobanteFixture({ ordenId: orden.id });

  // La decisión de producto: sobre una orden pendiente, verificar COBRA.
  assert.equal(accionAlVerificar(orden.estado), 'cobrar');

  // 1. La plata. Mismo camino que el endpoint de pagos.
  await prisma.$transaction(async (tx) => {
    await registerOrderPaymentTx(tx, orden.id, {
      monto:                 orden.total,
      metodo:                'TRANSFERENCIA',
      registrado_por:        VEREDICTO.por,
      registrado_por_nombre: VEREDICTO.nombre,
    });
  });

  // 2. El sello.
  const sellado = await decidirComprobante(comprobante.id, 'VERIFICADO', VEREDICTO);

  assert.equal(sellado!.estado, 'VERIFICADO');
  assert.equal(sellado!.verificado_por_nombre, 'Dueño Test');
  assert.ok(sellado!.verificado_at, 'el sello tiene que estampar CUÁNDO');

  const pagos = await pagosDe(orden.id);
  assert.equal(pagos.length, 1);
  assert.equal(pagos[0].monto, 45000);

  // Y la orden quedó pagada — pero la movió el Payment, no el comprobante.
  const recargada = await prisma.order.findUniqueOrThrow({ where: { id: orden.id } });
  assert.equal(recargada.estado, 'pagado');
});

test('con la plata ya adentro, verificar sólo SELLA: no aparece un segundo Payment', async () => {
  const orden = await crearOrden({ numero: 'CN-100003', total: 30000 });
  await prisma.$transaction(async (tx) => {
    await registerOrderPaymentTx(tx, orden.id, { monto: orden.total, metodo: 'NEQUI' });
  });
  const comprobante = await crearComprobanteFixture({ ordenId: orden.id });

  const pagada = await prisma.order.findUniqueOrThrow({ where: { id: orden.id } });
  assert.equal(accionAlVerificar(pagada.estado), 'sellar');

  await decidirComprobante(comprobante.id, 'VERIFICADO', VEREDICTO);

  assert.equal((await pagosDe(orden.id)).length, 1);
});

// ─── Rechazar NO crea plata y NO borra nada ──────────────────────────────────

test('rechazar conserva la fila Y la url, y no crea ningún Payment', async () => {
  const orden = await crearOrden({ numero: 'CN-100004' });
  const comprobante = await crearComprobanteFixture({ ordenId: orden.id });
  const urlOriginal = comprobante.url;

  const rechazado = await decidirComprobante(comprobante.id, 'RECHAZADO', {
    ...VEREDICTO, notas: 'El monto no corresponde a esta orden.',
  });

  assert.equal(rechazado!.estado, 'RECHAZADO');
  // SIN BORRADO FÍSICO: un comprobante rechazado ES la prueba de que se rechazó.
  assert.equal(rechazado!.url, urlOriginal);
  assert.equal(rechazado!.notas_verificacion, 'El monto no corresponde a esta orden.');

  assert.equal((await pagosDe(orden.id)).length, 0);
  // Y la orden intacta.
  const recargada = await prisma.order.findUniqueOrThrow({ where: { id: orden.id } });
  assert.equal(recargada.estado, 'pendiente');
});

// ─── El veredicto no se reescribe ────────────────────────────────────────────

test('un comprobante ya decidido no se vuelve a decidir: el sello de auditoría no se pisa', async () => {
  const orden = await crearOrden({ numero: 'CN-100005' });
  const comprobante = await crearComprobanteFixture({ ordenId: orden.id });

  await decidirComprobante(comprobante.id, 'RECHAZADO', VEREDICTO);
  const primero = await prisma.comprobante.findUniqueOrThrow({ where: { id: comprobante.id } });

  await assert.rejects(
    () => decidirComprobante(comprobante.id, 'VERIFICADO', { por: 'otro', nombre: 'Otra Persona' }),
    (e: unknown) => e instanceof ComprobanteYaDecidido,
  );

  const despues = await prisma.comprobante.findUniqueOrThrow({ where: { id: comprobante.id } });
  assert.equal(despues.estado, 'RECHAZADO');
  assert.equal(despues.verificado_por_nombre, 'Dueño Test');
  assert.deepEqual(despues.verificado_at, primero.verificado_at);
});

test('dos veredictos CONCURRENTES sobre el mismo comprobante: uno gana, el otro es rechazado', async () => {
  const orden = await crearOrden({ numero: 'CN-100006' });
  const comprobante = await crearComprobanteFixture({ ordenId: orden.id });

  // La transición es condicional en UNA sentencia (`updateMany` con el estado en
  // el `where`), así que no hay ventana entre leer y escribir. Sin eso, los dos
  // leerían RECIBIDO y el segundo pisaría el nombre del primero.
  const resultados = await Promise.allSettled([
    decidirComprobante(comprobante.id, 'VERIFICADO', { por: 'a', nombre: 'Persona A' }),
    decidirComprobante(comprobante.id, 'RECHAZADO',  { por: 'b', nombre: 'Persona B' }),
  ]);

  const ok = resultados.filter(r => r.status === 'fulfilled');
  assert.equal(ok.length, 1, 'exactamente uno de los dos veredictos debe quedar');

  const final = await prisma.comprobante.findUniqueOrThrow({ where: { id: comprobante.id } });
  assert.notEqual(final.estado, 'RECIBIDO');
});

// ─── El comprobante nunca mueve la orden ─────────────────────────────────────

test('ningún veredicto toca Order.estado por su cuenta', async () => {
  const orden = await crearOrden({ numero: 'CN-100007' });
  const a = await crearComprobanteFixture({ ordenId: orden.id });

  await decidirComprobante(a.id, 'VERIFICADO', VEREDICTO);

  const recargada = await prisma.order.findUniqueOrThrow({ where: { id: orden.id } });
  // Sellar la evidencia SIN registrar el pago deja la orden pendiente. Es un
  // estado legible y es el correcto: la plata no entró. Que la UI cobre primero
  // es una decisión del flujo, no una garantía de esta capa.
  assert.equal(recargada.estado, 'pendiente');
  assert.equal((await pagosDe(orden.id)).length, 0);
});

// ─── El puntero, no los bytes ────────────────────────────────────────────────

test('la fila guarda una URL y su metadata, jamás el archivo', async () => {
  const orden = await crearOrden({ numero: 'CN-100008' });
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
  // El prefijo `dev/` es lo que impide que un entorno de pruebas toque un blob
  // real (§ Storage de imágenes). Acá se afirma que la ruta que se guarda lo trae.
  assert.match(creado.url, /\/dev\/comprobantes\//);
});
