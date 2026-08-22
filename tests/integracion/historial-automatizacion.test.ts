import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { historialDe } from '@/lib/automations/historial-server';
import { CAP_HISTORIAL } from '@/lib/automations/historial';
import { prisma, limpiar } from './fixtures';

// EL HISTORIAL MUESTRA SÓLO LO QUE CAMBIÓ ALGO — el corte contra base real.
//
// Un test con mocks pasaría en verde contra una consulta que trajera DUPLICADO y
// OMITIDO: el defecto viviría en el `where`, no en el mapeo. Sólo releer contra
// Postgres lo delata, y por eso va en el carril.
//
// SE LO VIO FALLAR quitando el `where` de estado en `historialDe`: con un DUPLICADO
// y un OMITIDO sembrados, devuelve 4 en vez de 2. **No borrar este archivo.**

before(() => limpiar());
beforeEach(() => limpiar());
after(async () => { await limpiar(); await prisma.$disconnect(); });

const KEY = 'stock_bajo';
let n = 0;
async function run(estado: string, opts: { canal?: string; payload?: unknown; min?: number } = {}) {
  // periodo único por fila: el unique (key,target,periodo) no debe estorbar al sembrar.
  await prisma.automationRun.create({
    data: {
      automationKey: KEY,
      targetType:    'product',
      targetId:      `p${n}`,
      periodo:       `evt-${n++}`,
      canal:         opts.canal ?? 'interno',
      estado:        estado as never,
      payload:       (opts.payload ?? {}) as never,
      // createdAt escalonado para un orden determinista (más nuevo = mayor min).
      createdAt:     new Date(Date.UTC(2026, 7, 1, 0, opts.min ?? n, 0)),
    },
  });
}

test('el corte deja pasar ENVIADO y FALLIDO, y NADA más', async () => {
  await run('ENVIADO',         { min: 1 });
  await run('FALLIDO',         { min: 2 });
  await run('DUPLICADO',       { min: 3 });   // silencio deliberado
  await run('OMITIDO',         { min: 4 });   // no había a quién avisar
  await run('PENDIENTE_CANAL', { min: 5 });   // WhatsApp sin conectar

  const { entradas } = await historialDe(KEY);

  // DOS, no cinco. Sin el corte (where quitado) serían cinco — el discriminador.
  assert.equal(entradas.length, 2, 'sólo ENVIADO y FALLIDO son hechos de historial');
  const labels = entradas.map(e => e.resultado).sort();
  assert.deepEqual(labels, ['fallo', 'ok']);
});

test('viene en orden, más reciente primero, con el "sobre qué" del payload', async () => {
  await run('ENVIADO', { min: 1, payload: { mensaje: 'El más viejo' } });
  await run('ENVIADO', { min: 9, payload: { mensaje: 'El más nuevo', href: '/admin/pedidos?pedido=PED-1' } });

  const { entradas } = await historialDe(KEY);
  assert.equal(entradas[0].sobreQue, 'El más nuevo');
  assert.equal(entradas[0].href, '/admin/pedidos?pedido=PED-1');
  assert.equal(entradas[1].sobreQue, 'El más viejo');
});

test('el cap corta en 50 y DECLARA que hay más', async () => {
  for (let i = 0; i < CAP_HISTORIAL + 5; i++) await run('ENVIADO', { min: i + 1 });
  const { entradas, hayMas } = await historialDe(KEY);
  assert.equal(entradas.length, CAP_HISTORIAL, 'no más de 50');
  assert.equal(hayMas, true, 'con 55 sembrados, hay más');
});

test('justo en el cap, hayMas es false — el +1 no miente', async () => {
  for (let i = 0; i < CAP_HISTORIAL; i++) await run('ENVIADO', { min: i + 1 });
  const { entradas, hayMas } = await historialDe(KEY);
  assert.equal(entradas.length, CAP_HISTORIAL);
  assert.equal(hayMas, false);
});
