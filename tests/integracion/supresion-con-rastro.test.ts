import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { runEventAutomations } from '@/lib/automations/engine';
import { prisma, limpiar, soloActiva, crearProducto, runsDe, notificacionesDe } from './fixtures';

// LA SUPRESIÓN DEBE DEJAR RASTRO — item 1 del backlog.
//
// Hoy `ejecutarObjetivo` retorna DUPLICADO ANTES de `registrarRun`, así que un
// silencio deliberado no escribe nada: desde la base, "callé porque el cooldown
// lo pidió" y "callé porque estoy roto" se ven idénticos. Eso costó el
// diagnóstico completo de una tarde.
//
// Se escribe ANTES del arreglo y se lo ve fallar.

before(() => limpiar());
beforeEach(() => limpiar());
after(async () => { await limpiar(); await prisma.$disconnect(); });

/** Envejece TODOS los runs de una key para simular el paso del tiempo. */
async function envejecerRuns(automationKey: string, horas: number) {
  await prisma.automationRun.updateMany({
    where: { automationKey },
    data:  { createdAt: new Date(Date.now() - horas * 3_600_000) },
  });
}

/** Envejece un run puntual por id. */
async function envejecerRun(id: string, horas: number) {
  await prisma.automationRun.update({
    where: { id },
    data:  { createdAt: new Date(Date.now() - horas * 3_600_000) },
  });
}

test('cooldown: el silencio deliberado deja fila DUPLICADO, no cero filas', async () => {
  await soloActiva('stock_bajo');
  const prod = await crearProducto({ slug: 'p-rastro', stock: 3, stock_minimo: 8 });

  await runEventAutomations({ tipo: 'stock.cruzo_minimo', productoId: prod.id });
  await runEventAutomations({ tipo: 'stock.cruzo_minimo', productoId: prod.id });

  const runs = await runsDe('stock_bajo');
  assert.equal(runs.length, 2,
    'el segundo intento tiene que dejar rastro: sin fila, el silencio deliberado es indistinguible de la cadena rota');
  assert.equal(runs[0].estado, 'ENVIADO');
  assert.equal(runs[1].estado, 'DUPLICADO');

  // El rastro es del INTENTO, no del envío: solo hay una notificación.
  assert.equal((await notificacionesDe('stock_bajo')).length, 1);
});

test('LA TERCERA PATA: una fila DUPLICADO NO alimenta la ventana de cooldown', async () => {
  // El test que impide que el arreglo sea peor que el bug. Si `estaEnCooldown`
  // contara las filas de supresión, cada silencio generaría la evidencia que
  // causa el siguiente: con el cron horario, un producto bajo mínimo dejaría la
  // automatización MUDA PARA SIEMPRE.
  //
  // El montaje es lo que lo hace discriminante: el ENVIADO se envejece MÁS ALLÁ
  // de la ventana (25 h) y la fila DUPLICADO se deja RECIENTE (2 h). Si las
  // supresiones contaran, esa fila de 2 h suprimiría el tercer cruce.
  await soloActiva('stock_bajo');
  const prod = await crearProducto({ slug: 'p-ventana', stock: 3, stock_minimo: 8 });

  // (1) Cruce → ENVIADO
  await runEventAutomations({ tipo: 'stock.cruzo_minimo', productoId: prod.id });
  const [enviado] = await runsDe('stock_bajo');
  assert.equal(enviado.estado, 'ENVIADO');

  // (2) Segundo cruce dentro de la ventana → DUPLICADO
  await runEventAutomations({ tipo: 'stock.cruzo_minimo', productoId: prod.id });
  const trasSegundo = await runsDe('stock_bajo');
  assert.equal(trasSegundo.length, 2);
  assert.equal(trasSegundo[1].estado, 'DUPLICADO');

  // El ENVIADO sale de la ventana; la supresión queda DENTRO y reciente.
  await envejecerRun(enviado.id, 25);
  await envejecerRun(trasSegundo[1].id, 2);

  // (3) Tercer cruce, pasada la ventana original → ENVIADO otra vez
  await runEventAutomations({ tipo: 'stock.cruzo_minimo', productoId: prod.id });

  const finales = await runsDe('stock_bajo');
  assert.equal(finales.length, 3);
  assert.equal(finales[2].estado, 'ENVIADO',
    'la ventana venció: si esto es DUPLICADO, las supresiones se están contando y el cooldown se auto-perpetúa');
  assert.equal((await notificacionesDe('stock_bajo')).length, 2, 'dos avisos reales, tres intentos');
});

test('el rastro NO se confunde con un fallo: DUPLICADO y FALLIDO son distintos', async () => {
  // La razón de ser del item. Un run FALLIDO dice "el canal reventó"; un
  // DUPLICADO dice "callé porque ya estaba hecho". Antes los dos casos de
  // silencio producían el mismo vacío.
  await soloActiva('stock_bajo');
  const prod = await crearProducto({ slug: 'p-distingue', stock: 3, stock_minimo: 8 });

  await runEventAutomations({ tipo: 'stock.cruzo_minimo', productoId: prod.id });
  await runEventAutomations({ tipo: 'stock.cruzo_minimo', productoId: prod.id });

  const runs = await runsDe('stock_bajo');
  const estados = runs.map(r => r.estado);
  assert.ok(estados.includes('DUPLICADO'));
  assert.ok(!estados.includes('FALLIDO'), 'una supresión no es un fallo');
});

test('el cooldown por producto sigue siendo por producto', async () => {
  // Guarda de regresión: la fila de supresión de un producto no puede afectar a
  // otro. El scope del gate es (key, targetId).
  await soloActiva('stock_bajo');
  const a = await crearProducto({ slug: 'p-scope-a', stock: 3, stock_minimo: 8 });
  const b = await crearProducto({ slug: 'p-scope-b', stock: 3, stock_minimo: 8 });

  await runEventAutomations({ tipo: 'stock.cruzo_minimo', productoId: a.id });
  await runEventAutomations({ tipo: 'stock.cruzo_minimo', productoId: a.id }); // suprimido
  await runEventAutomations({ tipo: 'stock.cruzo_minimo', productoId: b.id }); // debe avisar

  assert.equal((await notificacionesDe('stock_bajo')).length, 2);
});

test('una_vez: el silencio NO deja fila, y la que ya existe lo explica', async () => {
  // Asimetría DELIBERADA. El unique (key, target, periodo) ya está ocupado por el
  // run original —periodo 'evt'—, así que una fila de supresión chocaría. No es
  // una carencia: para estas estrategias la fila existente ES la explicación del
  // silencio, y basta una query por target para verla.
  await soloActiva('orden_recibida');
  const orden = await prisma.order.create({
    data: { numero_orden: 'CN-300001', cliente_nombre: 'Test', total: 1000 },
  });

  await runEventAutomations({ tipo: 'order.creada', orderId: orden.id, origen: 'storefront' });
  await runEventAutomations({ tipo: 'order.creada', orderId: orden.id, origen: 'storefront' });

  const runs = await runsDe('orden_recibida');
  assert.equal(runs.length, 1, 'el unique impide la segunda fila — por diseño');
  assert.equal(runs[0].estado, 'ENVIADO');
  assert.equal(runs[0].periodo, 'evt');
  assert.equal((await notificacionesDe('orden_recibida')).length, 1);
});

// Se deja envejecerRuns en uso para que el helper no quede muerto si algún test
// futuro necesita mover toda la serie de golpe.
test('cooldown vencido sin supresiones de por medio (control)', async () => {
  await soloActiva('stock_bajo');
  const prod = await crearProducto({ slug: 'p-control', stock: 3, stock_minimo: 8 });

  await runEventAutomations({ tipo: 'stock.cruzo_minimo', productoId: prod.id });
  await envejecerRuns('stock_bajo', 25);
  await runEventAutomations({ tipo: 'stock.cruzo_minimo', productoId: prod.id });

  assert.equal((await notificacionesDe('stock_bajo')).length, 2);
});
