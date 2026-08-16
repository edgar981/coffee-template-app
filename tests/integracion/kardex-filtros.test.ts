import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { logsDeInventario } from '@duna/core/inventory';
import { prisma, limpiar } from './fixtures';

// LOS FILTROS DE LA AUDITORÍA · server-side, y contra una base real.
//
// Van en el carril y no en la suite pura porque lo que se afirma es qué FILAS
// devuelve la consulta —incluida la frontera de día, que depende de la zona—, y
// eso no se puede simular con mocks. El filtro es server-side (no client-side como
// Pedidos) porque el kardex tiene tope: filtrar la ventana cargada respondería
// "no hubo nada en marzo" cuando marzo está más allá de la fila 200. Estos tests
// afirman que el `where` filtra sobre TODA la historia.

before(() => limpiar());
beforeEach(() => limpiar());
after(async () => { await limpiar(); await prisma.$disconnect(); });

// Inserta un asiento con `createdAt` y `tipo` controlados. Se escribe directo (no
// vía `aplicarAjusteInventario`, que usa `now()`) porque lo que se prueba es la
// LECTURA con fechas fijas. `producto_id` no tiene FK, así que un string basta.
async function asiento(over: { producto_id?: string; tipo?: string; createdAt?: Date }) {
  return prisma.inventoryLog.create({
    data: {
      producto_id:     over.producto_id ?? 'p1',
      producto_nombre: 'Producto X',
      tipo:            over.tipo ?? 'ajuste',
      cantidad:        1, stock_anterior: 0, stock_nuevo: 1,
      ...(over.createdAt ? { createdAt: over.createdAt } : {}),
    },
  });
}

test('filtro por PRODUCTO: sólo los de ese producto (regresión de la frontera con Productos)', async () => {
  await asiento({ producto_id: 'a' });
  await asiento({ producto_id: 'a' });
  await asiento({ producto_id: 'b' });
  const soloA = await logsDeInventario({ productoId: 'a' });
  assert.equal(soloA.length, 2);
  assert.ok(soloA.every(l => l.producto_id === 'a'));
});

test('filtro por TIPO: sólo ese tipo', async () => {
  await asiento({ tipo: 'entrada' });
  await asiento({ tipo: 'salida' });
  await asiento({ tipo: 'salida' });
  const salidas = await logsDeInventario({ tipo: 'salida' });
  assert.equal(salidas.length, 2);
  assert.ok(salidas.every(l => l.tipo === 'salida'));
});

test('un TIPO desconocido matchea cero, no rompe', async () => {
  await asiento({ tipo: 'entrada' });
  assert.equal((await logsDeInventario({ tipo: 'inventado' })).length, 0);
});

test('RANGO por día de BOGOTÁ, no UTC — la propiedad que hace verdad la auditoría', async () => {
  // Bogotá es UTC−5. La frontera del día NO es medianoche UTC:
  //   2026-03-31T04:00Z = 30 mar 23:00 Bogotá  → todavía marzo 30
  //   2026-03-31T05:00Z = 31 mar 00:00 Bogotá  → ya marzo 31
  //   2026-03-31T20:00Z = 31 mar 15:00 Bogotá  → marzo 31
  //   2026-04-01T05:00Z =  1 abr 00:00 Bogotá  → ya abril 1
  await asiento({ createdAt: new Date('2026-03-31T04:00:00Z') });                 // fuera (30 Bogotá)
  const d1 = await asiento({ createdAt: new Date('2026-03-31T05:00:00Z') });      // dentro
  const d2 = await asiento({ createdAt: new Date('2026-03-31T20:00:00Z') });      // dentro
  await asiento({ createdAt: new Date('2026-04-01T05:00:00Z') });                 // fuera (1 abr Bogotá)

  const mar31 = await logsDeInventario({ desde: '2026-03-31', hasta: '2026-03-31' });
  // Si el rango usara medianoche UTC, el de las 04:00Z entraría (es 31 en UTC) y
  // el de las 20:00Z quedaría fuera del `lte 23:59:59Z` — justo al revés. Este
  // deepEqual falla con la implementación naíf.
  assert.deepEqual(mar31.map(l => l.id).sort(), [d1.id, d2.id].sort());
});

test('rango ABIERTO por un extremo: sólo desde, sólo hasta', async () => {
  const viejo  = await asiento({ createdAt: new Date('2026-03-10T12:00:00Z') });
  const nuevo  = await asiento({ createdAt: new Date('2026-03-20T12:00:00Z') });

  const desdeMed = await logsDeInventario({ desde: '2026-03-15' });
  assert.deepEqual(desdeMed.map(l => l.id), [nuevo.id]);

  const hastaMed = await logsDeInventario({ hasta: '2026-03-15' });
  assert.deepEqual(hastaMed.map(l => l.id), [viejo.id]);
});

test('los filtros COMPONEN: producto + tipo + rango a la vez', async () => {
  await asiento({ producto_id: 'a', tipo: 'salida', createdAt: new Date('2026-03-31T12:00:00Z') }); // ✓
  await asiento({ producto_id: 'a', tipo: 'entrada', createdAt: new Date('2026-03-31T12:00:00Z') }); // tipo ✗
  await asiento({ producto_id: 'b', tipo: 'salida', createdAt: new Date('2026-03-31T12:00:00Z') }); // producto ✗
  await asiento({ producto_id: 'a', tipo: 'salida', createdAt: new Date('2026-04-05T12:00:00Z') }); // rango ✗

  const r = await logsDeInventario({ productoId: 'a', tipo: 'salida', desde: '2026-03-01', hasta: '2026-03-31' });
  assert.equal(r.length, 1);
});

test('sin filtros: el kardex completo (regresión — ningún llamador de siempre cambia)', async () => {
  await asiento({}); await asiento({}); await asiento({});
  assert.equal((await logsDeInventario()).length, 3);
});
