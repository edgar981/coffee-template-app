import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { runEventAutomations } from '@/lib/automations/engine';
import { AUTOMATION_MAP } from '@/constants/automations';
import {
  prisma, limpiar, soloActiva, setActivo, crearProducto, crearOrden,
  runsDe, notificacionesDe,
} from './fixtures';

// CADENAS POR EVENTO, afirmadas sobre el estado FINAL en la base.
//
// El criterio de estos tests es el que la suite pura no podía cumplir: deben
// FALLAR si la cadena muere en CUALQUIER eslabón — emisor, gate de activo,
// handler, canal, o el INSERT. Por eso no hay un solo mock: se llama a
// `runEventAutomations` igual que lo llama un route handler y después se lee la
// base. Si el canal interno dejara de escribir la fila, el assert de
// `Notification` se cae, que es exactamente lo que pasó en producción y ningún
// test vio (2026-08-04: 143/143 en verde con la cadena muerta).

before(() => limpiar());
beforeEach(() => limpiar());
after(async () => { await limpiar(); await prisma.$disconnect(); });

// ─── Orden nueva del storefront ──────────────────────────────────────────────

test('storefront: evento → run ENVIADO → fila en Notification con su shape', async () => {
  await soloActiva('orden_recibida');
  const orden = await crearOrden({ numero: 'CN-100001', cliente_nombre: 'Ana Pérez', total: 28000 });

  await runEventAutomations({ tipo: 'order.creada', orderId: orden.id, origen: 'storefront' });

  const runs = await runsDe('orden_recibida');
  assert.equal(runs.length, 1, 'debe quedar exactamente un run');
  assert.equal(runs[0].estado, 'ENVIADO');
  assert.equal(runs[0].targetId, orden.id);
  assert.equal(runs[0].canal, 'interno');
  assert.equal(runs[0].periodo, 'evt', 'idempotencia una_vez usa periodo evt');

  const notis = await notificacionesDe('orden_recibida');
  assert.equal(notis.length, 1, 'la cadena tiene que llegar hasta el INSERT');
  assert.equal(notis[0].leida, false);
  // El deep link es la mitad útil del aviso: sin él el operador tiene que buscar
  // la orden a mano, que es el trabajo que la campana debía ahorrar.
  assert.equal(notis[0].href, '/admin/ordenes?order=CN-100001');
  assert.match(notis[0].mensaje, /Ana/);
  // `tipo` es la key del registry — es lo que el bell usa para el ícono y el
  // tono del badge. Si dejara de calzar, la campana pintaría gris sin fallar.
  assert.ok(AUTOMATION_MAP[notis[0].tipo], 'el tipo debe ser una key viva del registry');
});

test('admin: la MISMA cadena con origen admin no escribe nada', async () => {
  await soloActiva('orden_recibida');
  const orden = await crearOrden({ numero: 'CN-100002' });

  await runEventAutomations({ tipo: 'order.creada', orderId: orden.id, origen: 'admin' });

  assert.equal((await runsDe('orden_recibida')).length, 0);
  assert.equal((await notificacionesDe('orden_recibida')).length, 0);
});

test('una_vez: repetir el evento no duplica la notificación', async () => {
  await soloActiva('orden_recibida');
  const orden = await crearOrden({ numero: 'CN-100003' });

  await runEventAutomations({ tipo: 'order.creada', orderId: orden.id, origen: 'storefront' });
  await runEventAutomations({ tipo: 'order.creada', orderId: orden.id, origen: 'storefront' });

  assert.equal((await runsDe('orden_recibida')).length, 1, 'el unique (key,target,periodo) es el gate');
  assert.equal((await notificacionesDe('orden_recibida')).length, 1);
});

// ─── El gate de activo/inactivo ──────────────────────────────────────────────

test('una fila activo=false GANA sobre defaultActivo=true — el bug que casi fue', async () => {
  // `orden_recibida` nace encendida en el registry. Este test existe porque el
  // 2026-08-04 la campana calló con todo lo demás correcto: había una fila vieja
  // de AutomationSetting en false, y desde la base el silencio deliberado se ve
  // igual que la cadena rota. La precedencia es POR DISEÑO — el toggle del owner
  // manda sobre el default — y por eso hay que testearla, no arreglarla.
  assert.equal(AUTOMATION_MAP['orden_recibida'].defaultActivo, true);

  await soloActiva('orden_recibida');
  await setActivo('orden_recibida', false);
  const orden = await crearOrden({ numero: 'CN-100004' });

  await runEventAutomations({ tipo: 'order.creada', orderId: orden.id, origen: 'storefront' });

  assert.equal((await runsDe('orden_recibida')).length, 0, 'el motor la salta antes del handler');
  assert.equal((await notificacionesDe('orden_recibida')).length, 0);
});

test('sin fila en AutomationSetting corre el defaultActivo del registry', async () => {
  // Complemento del anterior: una automatización nueva no necesita backfill.
  await prisma.automationSetting.deleteMany({});
  const orden = await crearOrden({ numero: 'CN-100005' });

  await runEventAutomations({ tipo: 'order.creada', orderId: orden.id, origen: 'storefront' });

  assert.equal((await notificacionesDe('orden_recibida')).length, 1);
});

// ─── Stock: cruce del mínimo y cooldown por producto ─────────────────────────

test('stock bajo: el cruce escribe run y notificación', async () => {
  await soloActiva('stock_bajo');
  // El handler RE-VERIFICA `isLowStock` sobre el producto ya persistido, así que
  // el fixture tiene que estar bajo mínimo de verdad: 5 <= 8.
  const prod = await crearProducto({ slug: 'p-cruce', stock: 5, stock_minimo: 8, nombre: 'Café Cruce' });

  await runEventAutomations({ tipo: 'stock.cruzo_minimo', productoId: prod.id });

  const runs = await runsDe('stock_bajo');
  assert.equal(runs.length, 1);
  assert.equal(runs[0].estado, 'ENVIADO');
  assert.equal(runs[0].targetId, prod.id);

  const notis = await notificacionesDe('stock_bajo');
  assert.equal(notis.length, 1);
  assert.match(notis[0].mensaje, /Café Cruce/);
  assert.match(notis[0].mensaje, /5 unidades/);
  assert.match(notis[0].mensaje, /mínimo: 8/);
});

test('stock repuesto: el handler calla aunque el evento llegue', async () => {
  await soloActiva('stock_bajo');
  // Evento tardío: entre el cruce y esto alguien repuso. Avisar sería mentir.
  const prod = await crearProducto({ slug: 'p-repuesto', stock: 40, stock_minimo: 8 });

  await runEventAutomations({ tipo: 'stock.cruzo_minimo', productoId: prod.id });

  assert.equal((await runsDe('stock_bajo')).length, 0);
  assert.equal((await notificacionesDe('stock_bajo')).length, 0);
});

test('cooldown por PRODUCTO: el segundo cruce dentro de la ventana no avisa', async () => {
  await soloActiva('stock_bajo');
  const a = await crearProducto({ slug: 'p-cool-a', stock: 3, stock_minimo: 8 });
  const b = await crearProducto({ slug: 'p-cool-b', stock: 3, stock_minimo: 8 });

  await runEventAutomations({ tipo: 'stock.cruzo_minimo', productoId: a.id });
  await runEventAutomations({ tipo: 'stock.cruzo_minimo', productoId: a.id });
  // Otro producto NO comparte la ventana: el cooldown es por target.
  await runEventAutomations({ tipo: 'stock.cruzo_minimo', productoId: b.id });

  const notis = await notificacionesDe('stock_bajo');
  assert.equal(notis.length, 2, 'uno por producto, no uno por evento');

  // Y la asimetría que costó una tarde de diagnóstico, fijada como test: la
  // supresión por cooldown NO deja fila, así que desde la base no se distingue
  // de una cadena rota. Está en el backlog (item 2); si algún día se persiste,
  // este assert se cae y hay que actualizarlo A CONCIENCIA.
  assert.equal((await runsDe('stock_bajo')).length, 2, 'hoy la supresión es invisible — ver backlog item 1');
});

test('cooldown vencido: pasada la ventana vuelve a avisar', async () => {
  await soloActiva('stock_bajo');
  const prod = await crearProducto({ slug: 'p-cool-viejo', stock: 3, stock_minimo: 8 });

  await runEventAutomations({ tipo: 'stock.cruzo_minimo', productoId: prod.id });
  // Se envejece el run existente más allá de las 24 h configuradas, que es la
  // única forma de ejercitar el vencimiento sin esperar un día.
  await prisma.automationRun.updateMany({
    where: { automationKey: 'stock_bajo' },
    data:  { createdAt: new Date(Date.now() - 25 * 3_600_000) },
  });

  await runEventAutomations({ tipo: 'stock.cruzo_minimo', productoId: prod.id });

  assert.equal((await notificacionesDe('stock_bajo')).length, 2, 'la ventana venció: avisa de nuevo');
});

// ─── Entrega fallida ─────────────────────────────────────────────────────────

test('entrega fallida: evento → notificación con el motivo del mensajero', async () => {
  await soloActiva('entrega_fallida');
  const orden = await crearOrden({ numero: 'CN-100006' });
  const envio = await prisma.shipping.create({
    data: {
      orden_id: orden.id, estado: 'fallido',
      mensajero: 'Carlos', notas_entrega: 'Nadie contestó',
    },
  });

  await runEventAutomations({ tipo: 'shipping.fallido', shippingId: envio.id, orderId: orden.id });

  const runs = await runsDe('entrega_fallida');
  assert.equal(runs.length, 1);
  // El target es el ENVÍO, no la orden: un reintento que vuelve a fallar es un
  // hecho nuevo sobre el mismo envío.
  assert.equal(runs[0].targetId, envio.id);

  const notis = await notificacionesDe('entrega_fallida');
  assert.equal(notis.length, 1);
  assert.match(notis[0].mensaje, /CN-100006/);
  assert.match(notis[0].mensaje, /Carlos/);
  assert.match(notis[0].mensaje, /Nadie contestó/);
});
