import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { runScheduledAutomations } from '@/lib/automations/engine';
import {
  prisma, limpiar, soloActiva, crearOrden, crearEnvio, haceHoras,
  runsDe, notificacionesDe,
} from './fixtures';

// CADENAS PROGRAMADAS — las que dispara el cron horario, afirmadas sobre el
// estado final en la base igual que las de evento.
//
// `entrega_sin_cobro` es la que más gana con este carril: su condición cruza
// tres tablas (Order pendiente + Shipping entregado + fecha_entrega vencida),
// filtra por una columna de TEXTO con comparación lexicográfica, y se re-verifica
// en JS. Ningún test puro puede tocar eso.

before(() => limpiar());
beforeEach(() => limpiar());
after(async () => { await limpiar(); await prisma.$disconnect(); });

/** Orden entregada hace `h` horas y sin pago registrado. */
async function ordenEntregadaSinCobrar(numero: string, h: number) {
  const orden = await crearOrden({ numero, estado: 'pendiente', condicion_pago: 'CONTRAENTREGA' });
  await crearEnvio({ ordenId: orden.id, estado: 'entregado', fecha_entrega: haceHoras(h) });
  return orden;
}

test('entregado hace 25 h sin pago → run ENVIADO + notificación', async () => {
  await soloActiva('entrega_sin_cobro');
  const orden = await ordenEntregadaSinCobrar('CN-200001', 25);

  const reporte = await runScheduledAutomations(new Date());

  assert.ok(reporte.ejecutadas.includes('entrega_sin_cobro'), 'el barrido tiene que considerarla');
  assert.equal(reporte.degradado, false);

  const runs = await runsDe('entrega_sin_cobro');
  assert.equal(runs.length, 1);
  assert.equal(runs[0].estado, 'ENVIADO');
  assert.equal(runs[0].targetId, orden.id);
  assert.equal(runs[0].periodo, 'evt');

  const notis = await notificacionesDe('entrega_sin_cobro');
  assert.equal(notis.length, 1);
  assert.equal(notis[0].href, '/admin/ordenes?order=CN-200001');
  assert.match(notis[0].mensaje, /CN-200001/);
});

test('entregado hace 2 h: todavía no vence, silencio', async () => {
  await soloActiva('entrega_sin_cobro');
  await ordenEntregadaSinCobrar('CN-200002', 2);

  await runScheduledAutomations(new Date());

  assert.equal((await notificacionesDe('entrega_sin_cobro')).length, 0);
});

test('una_vez por orden: la segunda corrida del cron no repite', async () => {
  await soloActiva('entrega_sin_cobro');
  await ordenEntregadaSinCobrar('CN-200003', 30);

  await runScheduledAutomations(new Date());
  await runScheduledAutomations(new Date());

  assert.equal((await runsDe('entrega_sin_cobro')).length, 1, 'un aviso por orden, no uno por corrida');
  assert.equal((await notificacionesDe('entrega_sin_cobro')).length, 1);
});

test('orden ya PAGADA: no es candidata aunque la entrega sea vieja', async () => {
  await soloActiva('entrega_sin_cobro');
  const orden = await crearOrden({ numero: 'CN-200004', estado: 'pagado' });
  await crearEnvio({ ordenId: orden.id, estado: 'entregado', fecha_entrega: haceHoras(48) });

  await runScheduledAutomations(new Date());

  assert.equal((await notificacionesDe('entrega_sin_cobro')).length, 0);
});

test('entrega EN RUTA: el dinero todavía no debía haber entrado', async () => {
  await soloActiva('entrega_sin_cobro');
  const orden = await crearOrden({ numero: 'CN-200005' });
  await crearEnvio({ ordenId: orden.id, estado: 'en_ruta', fecha_entrega: haceHoras(48) });

  await runScheduledAutomations(new Date());

  assert.equal((await notificacionesDe('entrega_sin_cobro')).length, 0);
});

test('sin fecha_entrega NO avisa — un dato roto no fabrica un aviso', async () => {
  await soloActiva('entrega_sin_cobro');
  const orden = await crearOrden({ numero: 'CN-200006' });
  await crearEnvio({ ordenId: orden.id, estado: 'entregado', fecha_entrega: null });

  await runScheduledAutomations(new Date());

  assert.equal((await notificacionesDe('entrega_sin_cobro')).length, 0,
    'mandar al operador a revisar una orden que quizá ya se cobró cuesta más que callar');
});

test('la orden de DEMO (SN-) queda fuera del barrido', async () => {
  await soloActiva('entrega_sin_cobro');
  await ordenEntregadaSinCobrar('SN-999001', 30);

  await runScheduledAutomations(new Date());

  assert.equal((await notificacionesDe('entrega_sin_cobro')).length, 0);
});

test('el pre-filtro de TEXTO no deja fuera una orden que sí venció', async () => {
  // `fecha_entrega` es una columna de texto y el `where` la compara
  // lexicográficamente contra un corte ISO. Este test es el que se caería si esa
  // comparación divergiera del `entregaVencidaSinCobro` que decide en JS: el
  // falso negativo ahí es plata sin cobrar y SIN rastro de que se calló.
  await soloActiva('entrega_sin_cobro');
  await ordenEntregadaSinCobrar('CN-200007', 24.5);

  await runScheduledAutomations(new Date());

  assert.equal((await notificacionesDe('entrega_sin_cobro')).length, 1);
});

test('inactiva por AutomationSetting: el barrido la reporta y no dispara', async () => {
  await soloActiva('contraentrega_sin_cobrar');   // deja entrega_sin_cobro en false
  await ordenEntregadaSinCobrar('CN-200008', 30);

  const reporte = await runScheduledAutomations(new Date());

  assert.ok(reporte.inactivas.includes('entrega_sin_cobro'));
  assert.equal((await notificacionesDe('entrega_sin_cobro')).length, 0);
});
