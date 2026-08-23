import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { pedidosPorHoraDeHoy, topHoyVendido } from '@/lib/dashboard/hoy-server';
import { bucketsPorHora } from '@/lib/dashboard/hoy';
import { prisma, limpiar, crearProducto } from './fixtures';

// LAS DOS CONSULTAS DE "HOY", afirmadas contra Postgres real.
//
// Los dos ejes NO comparten filtro, y ése es el HECHO que un test con mocks no
// vería —el defecto viviría en el `where`, no en el mapeo—:
//   · CONTEO (curva)  → EXCLUYE canceladas y SN- (= tarjeta "Pedidos de hoy").
//   · DINERO (top-hoy)→ INCLUYE canceladas, EXCLUYE SN-.
// Ambas por `createdAt` de hoy. La hora se extrae en reloj de Bogotá.
//
// El día de prueba es fijo (2026-08-22, Bogotá) para que las horas sean
// deterministas: Bogotá = UTC-5, así que 14:00Z = 09:00 → hora 9.

before(() => limpiar());
beforeEach(() => limpiar());
after(async () => { await limpiar(); await prisma.$disconnect(); });

const TZ = 'America/Bogota';
// Ventana del día de Bogotá 2026-08-22: [00:00, 24:00) en hora local = [05:00Z, +1d 05:00Z).
const DESDE = new Date('2026-08-22T05:00:00.000Z');
const HASTA = new Date('2026-08-23T05:00:00.000Z');

/** Crea una orden con su ítem, con `createdAt` explícito para fijar la hora.
 *  `productoId` opcional: sin él el ítem queda SIN producto (id null → texto plano). */
async function orden(opts: {
  numero:   string;
  estado:   string;
  createdAt: string;   // instante UTC
  producto: string;
  subtotal: number;
  productoId?: string;
}) {
  const o = await prisma.order.create({
    data: {
      numero_orden:   opts.numero,
      cliente_nombre: 'Cliente de prueba',
      estado:         opts.estado,
      total:          opts.subtotal,
      createdAt:      new Date(opts.createdAt),
      items: { create: [{ producto_nombre: opts.producto, cantidad: 1, subtotal: opts.subtotal, producto_id: opts.productoId ?? null }] },
    },
  });
  return o;
}

/** El escenario compartido: cinco órdenes de hoy, con una cancelada y una SN-. */
async function sembrarDiaHoy() {
  // hora 9 (Bogotá): dos reales + una cancelada
  await orden({ numero: 'CN-000001', estado: 'pagado',    createdAt: '2026-08-22T14:00:00Z', producto: 'Café Nariño', subtotal: 30_000 });
  await orden({ numero: 'CN-000002', estado: 'pendiente', createdAt: '2026-08-22T14:30:00Z', producto: 'Café Nariño', subtotal: 20_000 });
  await orden({ numero: 'CN-000003', estado: 'cancelado', createdAt: '2026-08-22T14:15:00Z', producto: 'Café Nariño', subtotal: 15_000 });
  // hora 15 (Bogotá): una real + una SN- de demo
  await orden({ numero: 'CN-000004', estado: 'pagado',    createdAt: '2026-08-22T20:00:00Z', producto: 'Café Huila',  subtotal: 40_000 });
  await orden({ numero: 'SN-000001', estado: 'pagado',    createdAt: '2026-08-22T20:15:00Z', producto: 'Café Huila',  subtotal: 99_000 });
}

test('la curva CUENTA por hora en Bogotá y EXCLUYE canceladas y SN-', async () => {
  await sembrarDiaHoy();
  const rows = await pedidosPorHoraDeHoy({ desde: DESDE, hasta: HASTA, tz: TZ });
  const buckets = bucketsPorHora(rows);

  // hora 9: dos reales (la cancelada NO cuenta). hora 15: una (la SN- NO cuenta).
  assert.equal(buckets[9], 2, 'la cancelada de las 9 no puede contar (con el eje mal daría 3)');
  assert.equal(buckets[15], 1, 'la SN- de las 15 no puede contar');
  assert.equal(buckets.reduce((s, n) => s + n, 0), 3, 'la suma de la curva = "Pedidos de hoy" (3)');
});

test('top-hoy SUMA el dinero por producto, INCLUYE canceladas y EXCLUYE SN-', async () => {
  await sembrarDiaHoy();
  const top = await topHoyVendido({ desde: DESDE, hasta: HASTA, tz: TZ, limite: 5 });

  // Nariño = 30.000 + 20.000 + 15.000 (la cancelada SÍ suma) = 65.000.
  // Huila = 40.000 (los 99.000 de la SN- NO entran).
  // `producto_id` null: `sembrarDiaHoy` no linkea producto → RAMA DE TEXTO PLANO.
  assert.deepEqual(top, [
    { nombre: 'Café Nariño', total: 65_000, producto_id: null },
    { nombre: 'Café Huila',  total: 40_000, producto_id: null },
  ], 'incluye la cancelada, excluye la SN-, y ordena por dinero desc');
});

test('producto_id INEQUÍVOCO navega; AMBIGUO (homónimos) o SIN producto → null (texto plano)', async () => {
  // Un producto real (id) vendido dos veces → su id inequívoco.
  const p = await crearProducto({ slug: 'cafe-narino', stock: 10, stock_minimo: 2, nombre: 'Café Nariño' });
  await orden({ numero: 'CN-100001', estado: 'pagado', createdAt: '2026-08-22T14:00:00Z', producto: 'Café Nariño', subtotal: 30_000, productoId: p.id });
  await orden({ numero: 'CN-100002', estado: 'pagado', createdAt: '2026-08-22T15:00:00Z', producto: 'Café Nariño', subtotal: 20_000, productoId: p.id });

  // DOS productos HOMÓNIMOS (mismo nombre, distinto slug/id) → ambiguo → null.
  const a = await crearProducto({ slug: 'huila-a', stock: 10, stock_minimo: 2, nombre: 'Café Huila' });
  const b = await crearProducto({ slug: 'huila-b', stock: 10, stock_minimo: 2, nombre: 'Café Huila' });
  await orden({ numero: 'CN-100003', estado: 'pagado', createdAt: '2026-08-22T16:00:00Z', producto: 'Café Huila', subtotal: 50_000, productoId: a.id });
  await orden({ numero: 'CN-100004', estado: 'pagado', createdAt: '2026-08-22T17:00:00Z', producto: 'Café Huila', subtotal: 15_000, productoId: b.id });

  // Un producto real con UNA línea sin producto (id null) mezclada → ambiguo → null.
  const c = await crearProducto({ slug: 'tolima', stock: 10, stock_minimo: 2, nombre: 'Café Tolima' });
  await orden({ numero: 'CN-100005', estado: 'pagado', createdAt: '2026-08-22T18:00:00Z', producto: 'Café Tolima', subtotal: 40_000, productoId: c.id });
  await orden({ numero: 'CN-100006', estado: 'pagado', createdAt: '2026-08-22T19:00:00Z', producto: 'Café Tolima', subtotal: 10_000 }); // sin producto

  const top = await topHoyVendido({ desde: DESDE, hasta: HASTA, tz: TZ, limite: 5 });
  const porNombre = new Map(top.map(t => [t.nombre, t.producto_id]));
  assert.equal(porNombre.get('Café Nariño'), p.id, 'id único y no nulo → navega');
  assert.equal(porNombre.get('Café Huila'), null, 'dos homónimos → sin destino, texto plano');
  assert.equal(porNombre.get('Café Tolima'), null, 'una línea sin producto contamina el grupo → texto plano');
});

test('el LÍMITE recorta a los N de más dinero', async () => {
  await sembrarDiaHoy();
  const top = await topHoyVendido({ desde: DESDE, hasta: HASTA, tz: TZ, limite: 1 });
  assert.equal(top.length, 1);
  assert.equal(top[0].nombre, 'Café Nariño', 'el de más dinero primero');
});

test('un día SIN pedidos: la consulta no trae filas y la curva no dibuja', async () => {
  // Órdenes de OTRO día quedan fuera de la ventana.
  await orden({ numero: 'CN-000009', estado: 'pagado', createdAt: '2026-08-20T14:00:00Z', producto: 'Café Nariño', subtotal: 10_000 });
  const rows = await pedidosPorHoraDeHoy({ desde: DESDE, hasta: HASTA, tz: TZ });
  assert.deepEqual(rows, [], 'sin pedidos hoy, sin filas');
  assert.equal(bucketsPorHora(rows).every(n => n === 0), true, 'buckets todos en 0 → curva declara');
});
