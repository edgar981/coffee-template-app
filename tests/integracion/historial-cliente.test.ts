import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { pedidosDelCliente } from '@/lib/clientes/detalle';
import { prisma, limpiar } from './fixtures';

// EL HISTORIAL DE UN CLIENTE CONTIENE SÓLO SUS PEDIDOS.
//
// Suena a tautología y no lo es: `GET /api/customers/[id]` resolvía el conjunto
// con un `OR` de tres ramas —la FK más los snapshots `cliente_email` y
// `cliente_telefono`— y por la del TELÉFONO le metía adentro los pedidos de OTRO
// cliente. `Customer.telefono` no es único **a propósito** (§ Matching de
// clientes: un teléfono puede ser de varias personas, y `rankPhoneMatches` existe
// justamente porque ese match devuelve varios), así que el `OR` asumía un
// invariante que el modelo niega.
//
// La rama del correo NO podía cruzar —`email` sí es `@unique`—, y eso está
// afirmado abajo en vez de quedar como un hueco.
//
// Medido en `development` el día del retiro: 2 de 13 clientes recibían pedidos y
// plata ajena, y el panel se contradecía solo —"1 pedido" en su cifra, dos filas
// en la lista de abajo—.
//
// ── POR QUÉ VA EN EL CARRIL Y NO EN LA SUITE PURA ───────────────────────────
//
// Lo que se afirma no es la forma de un objeto: es QUÉ FILAS VUELVEN de una base
// con dos clientes que comparten número. Con mocks el test pasa en verde contra
// el código defectuoso, porque el defecto está en el `where`, no en el mapeo.
//
// SE LO VIO FALLAR con el `OR` restaurado — es la condición de que discrimine.
// **No borrar este archivo** al tocar `lib/clientes/detalle.ts`: es lo único que
// prueba que el conjunto no se vuelva a ensanchar.

before(() => limpiar());
beforeEach(() => limpiar());
after(async () => { await limpiar(); await prisma.$disconnect(); });

/** El número compartido: el corazón del caso. */
const TELEFONO = '+573120000000';

async function crearCliente(nombre: string, email: string | null, telefono: string | null) {
  return prisma.customer.create({ data: { nombre, email, telefono } });
}

/** Una orden ATADA por FK a `clienteId`, con los snapshots de OTRA identidad. */
async function crearOrdenDe(opts: {
  numero: string;
  clienteId: string;
  email?: string | null;
  telefono?: string | null;
  total?: number;
}) {
  return prisma.order.create({
    data: {
      numero_orden:     opts.numero,
      cliente_nombre:   'Quien sea',
      cliente_id:       opts.clienteId,
      cliente_email:    opts.email    ?? null,
      cliente_telefono: opts.telefono ?? null,
      estado:           'pagado',
      condicion_pago:   'ANTICIPADO',
      total:            opts.total ?? 28000,
    },
  });
}

test('dos clientes con el MISMO teléfono no se prestan pedidos', async () => {
  const ana  = await crearCliente('Ana',  'ana@correo.com',  TELEFONO);
  const beto = await crearCliente('Beto', 'beto@correo.com', TELEFONO);

  await crearOrdenDe({ numero: 'CN-100001', clienteId: ana.id,  telefono: TELEFONO });
  await crearOrdenDe({ numero: 'CN-100002', clienteId: beto.id, telefono: TELEFONO });

  const deAna  = await pedidosDelCliente(ana.id);
  const deBeto = await pedidosDelCliente(beto.id);

  // La aserción es sobre el CONJUNTO COMPLETO, no sobre "contiene el suyo": con
  // `OR` por teléfono los dos traían las DOS órdenes, y un `.some()` habría
  // pasado en verde contra el código defectuoso.
  assert.deepEqual(deAna.map(o => o.numero_orden),  ['CN-100001']);
  assert.deepEqual(deBeto.map(o => o.numero_orden), ['CN-100002']);
});

test('LA RAMA DEL CORREO NO PUEDE CRUZAR: el schema lo impide', async () => {
  // No hay test del caso simétrico porque el caso NO EXISTE, y eso hay que
  // afirmarlo en vez de dejarlo como un hueco: `Customer.email` es `@unique` y
  // `Customer.telefono` NO lo es, a propósito (§ Matching de clientes).
  //
  // O sea que de las dos ramas de snapshot que tenía el `OR`, sólo una podía
  // ensanchar el conjunto. Se quitaron las dos igual —la FK es la respuesta— pero
  // el registro honesto es que el defecto vivía entero en la del teléfono.
  //
  // Se descubrió escribiendo el test simétrico y viéndolo reventar con P2002.
  await crearCliente('Ana', 'compartido@correo.com', null);
  await assert.rejects(
    () => crearCliente('Beto', 'compartido@correo.com', null),
    (e: { code?: string }) => e.code === 'P2002',
    'dos clientes no pueden compartir correo — si esto deja de fallar, el unique se cayó',
  );
});

test('una orden SIN FK no es de nadie, ni siquiera de quien comparte sus datos', async () => {
  // Es el caso que el `OR` decía venir a rescatar ("legacy order never linked").
  // Se declara que NO se rescata: atribuir por snapshot es justo lo que cruza
  // clientes. Si algún día aparecen huérfanas de verdad —hoy son cero—, se
  // reparan atándolas, no adivinando a quién se parecen.
  const ana = await crearCliente('Ana', 'ana@correo.com', TELEFONO);
  await prisma.order.create({
    data: {
      numero_orden: 'CN-100005', cliente_nombre: 'Ana', cliente_id: null,
      cliente_email: 'ana@correo.com', cliente_telefono: TELEFONO,
      estado: 'pagado', condicion_pago: 'ANTICIPADO', total: 28000,
    },
  });

  assert.deepEqual(await pedidosDelCliente(ana.id), []);
});

test('el historial INCLUYE las canceladas, y va del más reciente al más viejo', async () => {
  // Una cancelada es parte de la historia del cliente y su badge ya la marca. El
  // CONTEO de la lista sí las excluye, y esa asimetría es correcta —"cuántos
  // pedidos tiene" y "qué le pasó a este cliente" son dos preguntas—; lo que no
  // puede pasar es que el conjunto sea otro.
  const ana = await crearCliente('Ana', null, null);
  await crearOrdenDe({ numero: 'CN-100006', clienteId: ana.id });
  await prisma.order.create({
    data: {
      numero_orden: 'CN-100007', cliente_nombre: 'Ana', cliente_id: ana.id,
      estado: 'cancelado', condicion_pago: 'ANTICIPADO', total: 9000,
    },
  });

  const filas = await pedidosDelCliente(ana.id);
  assert.equal(filas.length, 2);
  assert.ok(filas[0].createdAt >= filas[1].createdAt, 'del más reciente al más viejo');
  assert.ok(filas.some(o => o.estado === 'cancelado'));
});

test('un cliente sin pedidos tiene historial vacío, no un error', async () => {
  const solo = await crearCliente('Sin compras', null, null);
  assert.deepEqual(await pedidosDelCliente(solo.id), []);
});
