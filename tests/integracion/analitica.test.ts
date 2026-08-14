import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { calcularAnalitica } from '@/lib/analitica';
import { prisma, limpiar } from './fixtures';

// LAS CONSULTAS DE ANALÍTICA, CONTRA UNA BASE REAL.
//
// POR QUÉ ESTE TEST VA EN EL CARRIL Y NO EN LA SUITE PURA: lo que se afirma no
// son los predicados —ésos ya viven en capa 1 (`margen.test.ts`,
// `cartera.test.ts`, `concentracion.test.ts`)— sino las cinco `$queryRaw` que los
// alimentan. `LATERAL`, `EXISTS` y el doble `AT TIME ZONE` no los verifica ni
// `tsc` ni un mock: un `to_char` con la zona equivocada COMPILA, corre, y
// devuelve números creíbles pero falsos. Para una página de analítica ése es el
// peor modo de falla posible, porque nada se ve roto.
//
// Las tres cosas que sólo esta capa puede afirmar:
//   1. que las exclusiones (`SN-`, canceladas) realmente excluyen,
//   2. que el bucketing por mes/día cae en el día de BOGOTÁ y no en el de UTC,
//   3. que el período de rentabilidad se mide por la fecha del PAGO.
//
// El carril no monta handlers HTTP, así que quedan fuera —y siguen siendo del
// checklist manual— la sesión, los roles y el render de la página.

before(() => limpiar());
beforeEach(() => limpiar());
after(async () => { await limpiar(); await prisma.$disconnect(); });

// Reloj FIJO. Un test cuyo resultado dependa del día en que se corre no es un
// test — mismo criterio que `soloActiva` en los tests de automatizaciones.
// 15 de agosto, mediodía en Bogotá (17:00 UTC).
const AHORA = new Date('2026-08-15T17:00:00.000Z');

/** Producto con costo conocido: el margen tiene que poder recalcularse a mano. */
async function producto(opts: { slug: string; nombre: string; precio: number; costo: number }) {
  return prisma.product.create({
    data: { ...opts, categoria: 'cafe_grano', stock: 100, stock_minimo: 5 },
  });
}

/**
 * Una orden con una línea y, opcionalmente, su pago. `pagadaEl` dispara la
 * transición a `pagado` — igual que `registrarPago`, no hay pagos parciales.
 */
async function vender(opts: {
  numero:      string;
  productoId?: string | null;
  nombre:      string;
  cantidad:    number;
  precio:      number;
  creadaEl:    Date;
  pagadaEl?:   Date | null;
  estado?:     string;
  canal?:      string;
  clienteId?:  string | null;
  envio?:      number;
}) {
  const subtotal = opts.precio * opts.cantidad;
  const envio    = opts.envio ?? 0;
  const orden = await prisma.order.create({
    data: {
      numero_orden: opts.numero,
      estado:       opts.estado ?? (opts.pagadaEl ? 'pagado' : 'pendiente'),
      canal:        opts.canal ?? 'directo',
      total:        subtotal + envio,
      costo_envio:  envio,
      createdAt:    opts.creadaEl,
      cliente_id:   opts.clienteId ?? null,
      items: {
        create: [{
          producto_id:     opts.productoId ?? null,
          producto_nombre: opts.nombre,
          cantidad:        opts.cantidad,
          precio_unitario: opts.precio,
          subtotal,
        }],
      },
    },
  });
  if (opts.pagadaEl) {
    await prisma.payment.create({
      data: { orden_id: orden.id, monto: subtotal + envio, metodo: 'EFECTIVO', fecha: opts.pagadaEl },
    });
  }
  return orden;
}

const filaDe = (r: Awaited<ReturnType<typeof calcularAnalitica>>, nombre: string) =>
  r.rentabilidad.filas.find(f => f.producto === nombre);

// ─── Rentabilidad ─────────────────────────────────────────────────────────────

test('el margen sale de las líneas reales y se recalcula a mano', async () => {
  const p = await producto({ slug: 'origen', nombre: 'Origen 500g', precio: 20_000, costo: 12_000 });
  await vender({
    numero: 'CN-100001', productoId: p.id, nombre: p.nombre, cantidad: 3, precio: 20_000,
    creadaEl: new Date('2026-08-02T15:00:00Z'), pagadaEl: new Date('2026-08-03T15:00:00Z'),
  });

  const r = await calcularAnalitica('mes', AHORA);
  const fila = filaDe(r, 'Origen 500g');
  assert.ok(fila);
  assert.equal(fila.unidades, 3);
  assert.equal(fila.ingresos, 60_000);          // 3 × 20.000
  assert.equal(fila.costoTotal, 36_000);        // 3 × 12.000
  assert.equal(fila.margenTotal, 24_000);
  assert.equal(r.rentabilidad.margenTotal, 24_000);
});

test('el ENVÍO no entra en el margen — mercancía contra costo', async () => {
  // Si el minuendo llevara envío y el sustraendo no, el margen se inflaría por
  // cada despacho. El pago fue de 68.000; el margen habla de los 60.000.
  const p = await producto({ slug: 'origen', nombre: 'Origen 500g', precio: 20_000, costo: 12_000 });
  await vender({
    numero: 'CN-100002', productoId: p.id, nombre: p.nombre, cantidad: 3, precio: 20_000, envio: 8_000,
    creadaEl: new Date('2026-08-02T15:00:00Z'), pagadaEl: new Date('2026-08-03T15:00:00Z'),
  });

  const r = await calcularAnalitica('mes', AHORA);
  assert.equal(r.rentabilidad.ingresos, 60_000);
  assert.equal(r.rentabilidad.margenTotal, 24_000);
  // Pero la TRAYECTORIA sí cuenta el pago completo: son bases distintas a
  // propósito, y el chart lo declara.
  const agosto = r.trayectoria.find(t => t.month === '2026-08');
  assert.equal(agosto?.ingresos, 68_000);
});

test('el período se mide por la fecha del PAGO, no la de creación', async () => {
  // La decisión escrita en CLAUDE.md: una orden creada en julio y cobrada en
  // agosto aporta margen a AGOSTO.
  const p = await producto({ slug: 'origen', nombre: 'Origen 500g', precio: 20_000, costo: 12_000 });
  await vender({
    numero: 'CN-100003', productoId: p.id, nombre: p.nombre, cantidad: 1, precio: 20_000,
    creadaEl: new Date('2026-07-20T15:00:00Z'), pagadaEl: new Date('2026-08-03T15:00:00Z'),
  });

  const enAgosto = await calcularAnalitica('mes', AHORA);
  assert.equal(enAgosto.rentabilidad.margenTotal, 8_000);

  const enJulio = await calcularAnalitica('mes_anterior', AHORA);
  assert.equal(enJulio.rentabilidad.filas.length, 0);
});

test('una orden PENDIENTE no aporta margen — sería utilidad y cartera a la vez', async () => {
  const p = await producto({ slug: 'origen', nombre: 'Origen 500g', precio: 20_000, costo: 12_000 });
  await vender({
    numero: 'CN-100004', productoId: p.id, nombre: p.nombre, cantidad: 5, precio: 20_000,
    creadaEl: new Date('2026-08-10T15:00:00Z'), pagadaEl: null,
  });

  const r = await calcularAnalitica('mes', AHORA);
  assert.equal(r.rentabilidad.filas.length, 0);
  assert.equal(r.cartera.total, 100_000);   // la MISMA orden, del otro lado
});

test('las órdenes SN- y las canceladas quedan fuera del margen', async () => {
  const p = await producto({ slug: 'origen', nombre: 'Origen 500g', precio: 20_000, costo: 12_000 });
  const el3 = new Date('2026-08-03T15:00:00Z');
  await vender({ numero: 'SN-900001', productoId: p.id, nombre: p.nombre, cantidad: 9, precio: 20_000, creadaEl: el3, pagadaEl: el3 });
  await vender({ numero: 'CN-100005', productoId: p.id, nombre: p.nombre, cantidad: 9, precio: 20_000, creadaEl: el3, pagadaEl: el3, estado: 'cancelado' });
  await vender({ numero: 'CN-100006', productoId: p.id, nombre: p.nombre, cantidad: 1, precio: 20_000, creadaEl: el3, pagadaEl: el3 });

  const r = await calcularAnalitica('mes', AHORA);
  assert.equal(filaDe(r, 'Origen 500g')?.unidades, 1);   // solo la real
});

test('una línea sin producto en el catálogo cae al RESIDUAL, no a margen 100%', async () => {
  await producto({ slug: 'origen', nombre: 'Origen 500g', precio: 20_000, costo: 12_000 });
  const el3 = new Date('2026-08-03T15:00:00Z');
  await vender({
    numero: 'CN-100007', productoId: null, nombre: 'Producto que ya no existe',
    cantidad: 4, precio: 25_000, creadaEl: el3, pagadaEl: el3,
  });

  const r = await calcularAnalitica('mes', AHORA);
  assert.equal(r.rentabilidad.filas.length, 0);
  assert.equal(r.rentabilidad.margenTotal, 0);           // NO 100.000
  assert.equal(r.rentabilidad.residual.ingresos, 100_000);
  assert.equal(r.rentabilidad.residual.unidades, 4);
});

test('una línea sin FK se costea por NOMBRE contra el catálogo', async () => {
  const p = await producto({ slug: 'origen', nombre: 'Origen 500g', precio: 20_000, costo: 12_000 });
  const el3 = new Date('2026-08-03T15:00:00Z');
  await vender({ numero: 'CN-100008', productoId: null,  nombre: p.nombre, cantidad: 2, precio: 20_000, creadaEl: el3, pagadaEl: el3 });
  await vender({ numero: 'CN-100009', productoId: p.id,  nombre: p.nombre, cantidad: 1, precio: 20_000, creadaEl: el3, pagadaEl: el3 });

  const r = await calcularAnalitica('mes', AHORA);
  // Las dos líneas suman en UNA fila: es el mismo SKU.
  assert.equal(r.rentabilidad.filas.length, 1);
  assert.equal(r.rentabilidad.filas[0].unidades, 3);
  assert.equal(r.rentabilidad.residual.ingresos, 0);
});

test('la tabla viene ORDENADA por margen total, no por unidades', async () => {
  const volumen = await producto({ slug: 'volumen', nombre: 'Vende Mucho', precio: 10_000, costo: 9_000 });
  const margen  = await producto({ slug: 'margen',  nombre: 'Deja Mucho',  precio: 50_000, costo: 20_000 });
  const el3 = new Date('2026-08-03T15:00:00Z');
  await vender({ numero: 'CN-100010', productoId: volumen.id, nombre: volumen.nombre, cantidad: 20, precio: 10_000, creadaEl: el3, pagadaEl: el3 });
  await vender({ numero: 'CN-100011', productoId: margen.id,  nombre: margen.nombre,  cantidad: 3,  precio: 50_000, creadaEl: el3, pagadaEl: el3 });

  const r = await calcularAnalitica('mes', AHORA);
  // 20 uds dejan 20.000; 3 uds dejan 90.000. El ranking por volumen mentiría.
  assert.deepEqual(r.rentabilidad.filas.map(f => f.producto), ['Deja Mucho', 'Vende Mucho']);
});

// ─── Cartera ──────────────────────────────────────────────────────────────────

test('la cartera bucketea por antigüedad en días de BOGOTÁ', async () => {
  const p = await producto({ slug: 'origen', nombre: 'Origen 500g', precio: 20_000, costo: 12_000 });
  // Hoy en Bogotá es 2026-08-15. Edades: 1, 10 y 30 días.
  await vender({ numero: 'CN-200001', productoId: p.id, nombre: p.nombre, cantidad: 1, precio: 10_000, creadaEl: new Date('2026-08-14T15:00:00Z') });
  await vender({ numero: 'CN-200002', productoId: p.id, nombre: p.nombre, cantidad: 1, precio: 20_000, creadaEl: new Date('2026-08-05T15:00:00Z') });
  await vender({ numero: 'CN-200003', productoId: p.id, nombre: p.nombre, cantidad: 1, precio: 30_000, creadaEl: new Date('2026-07-16T15:00:00Z') });

  const r = await calcularAnalitica('mes', AHORA);
  assert.equal(r.hoy, '2026-08-15');
  assert.deepEqual(
    r.cartera.buckets.map(b => [b.bucket, b.conteo, b.monto]),
    [['reciente', 1, 10_000], ['medio', 1, 20_000], ['vencido', 1, 30_000]],
  );
  assert.equal(r.cartera.total, 60_000);
});

test('el día de la cartera es el de BOGOTÁ, no el de UTC', async () => {
  // 2026-08-16T02:00Z es todavía el 15 en Bogotá (UTC-5). Bucketeado en UTC daría
  // una edad negativa; en Bogotá da 0. Es exactamente el fallo que un `to_char`
  // sin el doble AT TIME ZONE produciría, y que sólo esta capa puede ver.
  const p = await producto({ slug: 'origen', nombre: 'Origen 500g', precio: 20_000, costo: 12_000 });
  await vender({ numero: 'CN-200004', productoId: p.id, nombre: p.nombre, cantidad: 1, precio: 10_000, creadaEl: new Date('2026-08-16T02:00:00Z') });

  const r = await calcularAnalitica('mes', AHORA);
  assert.equal(r.cartera.buckets[0].conteo, 1);
  assert.equal(r.cartera.conteo, 1);
});

test('la cartera NO cuenta las SN- ni las canceladas', async () => {
  // Era la única excepción de exclusión de la página, y tenía su motivo: el bucket
  // linkea a la lista de pedidos, que MOSTRABA las SN-, así que excluirlas acá
  // habría dado un conteo que no cuadra con lo que se ve al hacer clic.
  //
  // La lista dejó de mostrarlas (`soloOrdenesReales` — son fixtures del seed, no
  // pedidos), así que la excepción se quedó sin causa y se retiró con ella. Este
  // test es el que obliga a que los dos lados se muevan juntos: si alguien excluye
  // en un lado y no en el otro, acá se cae.
  const p = await producto({ slug: 'origen', nombre: 'Origen 500g', precio: 20_000, costo: 12_000 });
  const ayer = new Date('2026-08-14T15:00:00Z');
  await vender({ numero: 'SN-900002', productoId: p.id, nombre: p.nombre, cantidad: 1, precio: 11_000, creadaEl: ayer });
  await vender({ numero: 'CN-200005', productoId: p.id, nombre: p.nombre, cantidad: 1, precio: 22_000, creadaEl: ayer });
  await vender({ numero: 'CN-200006', productoId: p.id, nombre: p.nombre, cantidad: 1, precio: 99_000, creadaEl: ayer, estado: 'cancelado' });

  const r = await calcularAnalitica('mes', AHORA);
  assert.equal(r.cartera.conteo, 1);            // sólo la CN- pendiente
  assert.equal(r.cartera.total, 22_000);        // ni la SN- ni la cancelada
});

// ─── Trayectoria ──────────────────────────────────────────────────────────────

test('la serie mensual cae en el mes de BOGOTÁ y trae 12 puntos zero-filled', async () => {
  const p = await producto({ slug: 'origen', nombre: 'Origen 500g', precio: 20_000, costo: 12_000 });
  // 2026-08-01T02:00Z es 31 de JULIO en Bogotá. En UTC caería en agosto.
  await vender({
    numero: 'CN-300001', productoId: p.id, nombre: p.nombre, cantidad: 1, precio: 20_000,
    creadaEl: new Date('2026-07-31T15:00:00Z'), pagadaEl: new Date('2026-08-01T02:00:00Z'),
  });

  const r = await calcularAnalitica('mes', AHORA);
  assert.equal(r.trayectoria.length, 12);
  assert.equal(r.trayectoria.at(-1)?.month, '2026-08');
  assert.equal(r.trayectoria.at(-1)?.cerrado, false);   // el mes en curso
  const julio = r.trayectoria.find(t => t.month === '2026-07');
  assert.equal(julio?.ingresos, 20_000);
  assert.equal(julio?.margen, 8_000);
  assert.equal(julio?.cerrado, true);
  // Un mes sin ventas es un 0 real, no un hueco.
  assert.equal(r.trayectoria.find(t => t.month === '2026-06')?.ingresos, 0);
});

test('el margen de la serie usa las MISMAS líneas que la tabla del período', async () => {
  const p = await producto({ slug: 'origen', nombre: 'Origen 500g', precio: 20_000, costo: 12_000 });
  await vender({
    numero: 'CN-300002', productoId: p.id, nombre: p.nombre, cantidad: 4, precio: 20_000,
    creadaEl: new Date('2026-08-02T15:00:00Z'), pagadaEl: new Date('2026-08-03T15:00:00Z'),
  });

  const r = await calcularAnalitica('mes', AHORA);
  const agosto = r.trayectoria.find(t => t.month === '2026-08');
  assert.equal(agosto?.margen, r.rentabilidad.margenTotal);
});

test('una orden con DOS pagos no duplica sus líneas en la serie', async () => {
  // Hoy no ocurre (un pago cubre el total), pero el `LATERAL MIN(fecha)` existe
  // para que el día que existan pagos parciales el margen no se cuente dos veces.
  const p = await producto({ slug: 'origen', nombre: 'Origen 500g', precio: 20_000, costo: 12_000 });
  const orden = await vender({
    numero: 'CN-300003', productoId: p.id, nombre: p.nombre, cantidad: 2, precio: 20_000,
    creadaEl: new Date('2026-08-02T15:00:00Z'), pagadaEl: new Date('2026-08-03T15:00:00Z'),
  });
  await prisma.payment.create({
    data: { orden_id: orden.id, monto: 1, metodo: 'EFECTIVO', fecha: new Date('2026-08-04T15:00:00Z') },
  });

  const r = await calcularAnalitica('mes', AHORA);
  const agosto = r.trayectoria.find(t => t.month === '2026-08');
  assert.equal(agosto?.margen, 16_000);        // 2 × (20.000 − 12.000), UNA vez
  assert.equal(agosto?.ordenes, 1);
});

// ─── Clientes y canales ───────────────────────────────────────────────────────

test('la concentración rankea por dinero PAGADO y calla sin muestra', async () => {
  const p = await producto({ slug: 'origen', nombre: 'Origen 500g', precio: 20_000, costo: 12_000 });
  const el3 = new Date('2026-08-03T15:00:00Z');
  const clientes = [];
  for (let i = 0; i < 7; i++) {
    const c = await prisma.customer.create({ data: { nombre: `Cliente ${i}`, email: `c${i}@test.co` } });
    clientes.push(c);
    await vender({
      numero: `CN-40000${i}`, productoId: p.id, nombre: p.nombre,
      cantidad: i + 1, precio: 20_000, creadaEl: el3, pagadaEl: el3, clienteId: c.id,
    });
  }

  const r = await calcularAnalitica('mes', AHORA);
  assert.equal(r.concentracion.clientes, 7);
  assert.equal(r.concentracion.top.length, 5);
  // El que más pagó primero: el cliente 6 (7 uds × 20.000).
  assert.equal(r.concentracion.top[0].nombre, 'Cliente 6');
  assert.equal(r.concentracion.top[0].total, 140_000);
  assert.notEqual(r.concentracion.pct, null);   // 7 clientes ≥ el piso de 6
});

test('con 5 clientes o menos el % de concentración se CALLA', async () => {
  const p = await producto({ slug: 'origen', nombre: 'Origen 500g', precio: 20_000, costo: 12_000 });
  const el3 = new Date('2026-08-03T15:00:00Z');
  for (let i = 0; i < 4; i++) {
    const c = await prisma.customer.create({ data: { nombre: `Cliente ${i}`, email: `c${i}@test.co` } });
    await vender({ numero: `CN-41000${i}`, productoId: p.id, nombre: p.nombre, cantidad: 1, precio: 20_000, creadaEl: el3, pagadaEl: el3, clienteId: c.id });
  }

  const r = await calcularAnalitica('mes', AHORA);
  assert.equal(r.concentracion.pct, null);
  assert.equal(r.concentracion.top.length, 4);   // la LISTA sí se muestra
});

test('la recurrencia cuenta órdenes NO canceladas, con el "N de M"', async () => {
  const p = await producto({ slug: 'origen', nombre: 'Origen 500g', precio: 20_000, costo: 12_000 });
  const el3 = new Date('2026-08-03T15:00:00Z');
  const recurrente = await prisma.customer.create({ data: { nombre: 'Recurrente', email: 'r@test.co' } });
  const unaVez     = await prisma.customer.create({ data: { nombre: 'Una vez',    email: 'u@test.co' } });
  await vender({ numero: 'CN-420001', productoId: p.id, nombre: p.nombre, cantidad: 1, precio: 20_000, creadaEl: el3, pagadaEl: el3, clienteId: recurrente.id });
  await vender({ numero: 'CN-420002', productoId: p.id, nombre: p.nombre, cantidad: 1, precio: 20_000, creadaEl: el3, pagadaEl: el3, clienteId: recurrente.id });
  await vender({ numero: 'CN-420003', productoId: p.id, nombre: p.nombre, cantidad: 1, precio: 20_000, creadaEl: el3, pagadaEl: el3, clienteId: unaVez.id });
  // Una cancelada NO puede volver recurrente a nadie.
  await vender({ numero: 'CN-420004', productoId: p.id, nombre: p.nombre, cantidad: 1, precio: 20_000, creadaEl: el3, estado: 'cancelado', clienteId: unaVez.id });

  const r = await calcularAnalitica('mes', AHORA);
  assert.equal(r.recurrencia.recurrentes, 1);
  assert.equal(r.recurrencia.clientes, 2);
  assert.equal(r.recurrencia.pct, 50);
});

test('los canales excluyen SN- y canceladas, y los % suman 100', async () => {
  const p = await producto({ slug: 'origen', nombre: 'Origen 500g', precio: 20_000, costo: 12_000 });
  const el3 = new Date('2026-08-03T15:00:00Z');
  await vender({ numero: 'CN-430001', productoId: p.id, nombre: p.nombre, cantidad: 1, precio: 20_000, creadaEl: el3, canal: 'directo' });
  await vender({ numero: 'CN-430002', productoId: p.id, nombre: p.nombre, cantidad: 1, precio: 20_000, creadaEl: el3, canal: 'directo' });
  await vender({ numero: 'CN-430003', productoId: p.id, nombre: p.nombre, cantidad: 1, precio: 20_000, creadaEl: el3, canal: 'whatsapp' });
  await vender({ numero: 'SN-900003', productoId: p.id, nombre: p.nombre, cantidad: 1, precio: 20_000, creadaEl: el3, canal: 'whatsapp' });
  await vender({ numero: 'CN-430004', productoId: p.id, nombre: p.nombre, cantidad: 1, precio: 20_000, creadaEl: el3, canal: 'whatsapp', estado: 'cancelado' });

  const r = await calcularAnalitica('mes', AHORA);
  assert.deepEqual(r.canales.map(c => [c.name, c.value]), [['Directo', 2], ['Whatsapp', 1]]);
  assert.equal(Math.round(r.canales.reduce((s, c) => s + c.pct, 0)), 100);
});

// ─── Base vacía ───────────────────────────────────────────────────────────────

test('base sin ventas: todo en cero, sin explotar y sin inventar', async () => {
  const r = await calcularAnalitica('mes', AHORA);
  assert.deepEqual(r.rentabilidad.filas, []);
  assert.equal(r.rentabilidad.margenPct, null);
  assert.equal(r.cartera.conteo, 0);
  assert.equal(r.cartera.buckets.length, 3);          // los tres, en cero
  assert.equal(r.trayectoria.length, 12);
  assert.ok(r.trayectoria.every(t => t.ingresos === 0 && t.margen === 0));
  assert.equal(r.concentracion.pct, null);
  assert.deepEqual(r.canales, []);
  assert.equal(r.recurrencia.pct, 0);
});

test('el payload hace ECO del período resuelto — el cliente deriva su carga de eso', async () => {
  const r = await calcularAnalitica('mes_anterior', AHORA);
  assert.equal(r.periodo.key, 'mes_anterior');
  assert.equal(r.periodo.label, 'Mes pasado');
});

// ─── El chip mueve TODOS los bloques del período ──────────────────────────────
// Punto que motiva esta tanda: en el primer pase, clientes y canales quedaron
// clavados en "año en curso" mientras el chip decía otra cosa. Era un defecto
// SILENCIOSO —nada en pantalla lo delataba— y por eso se afirma acá, no en el
// checklist manual: un humano no puede ver que un número no se movió.

/** Siembra ventas en tres meses distintos, cada una con su cliente y canal. */
async function sembrarTresMeses() {
  const p = await producto({ slug: 'origen', nombre: 'Origen 500g', precio: 20_000, costo: 12_000 });
  const meses = [
    { etiqueta: 'mayo',   fecha: new Date('2026-05-10T15:00:00Z'), canal: 'instagram' },
    { etiqueta: 'julio',  fecha: new Date('2026-07-10T15:00:00Z'), canal: 'whatsapp'  },
    { etiqueta: 'agosto', fecha: new Date('2026-08-10T15:00:00Z'), canal: 'directo'   },
  ];
  for (const [i, m] of meses.entries()) {
    const c = await prisma.customer.create({ data: { nombre: `Cliente ${m.etiqueta}`, email: `${m.etiqueta}@test.co` } });
    await vender({
      numero: `CN-5000${i}0`, productoId: p.id, nombre: p.nombre, cantidad: 1, precio: 20_000,
      creadaEl: m.fecha, pagadaEl: m.fecha, canal: m.canal, clienteId: c.id,
    });
  }
}

test('CLIENTES respeta el chip — no queda clavado en el año', async () => {
  await sembrarTresMeses();

  const agosto = await calcularAnalitica('mes', AHORA);
  assert.deepEqual(agosto.concentracion.top.map(c => c.nombre), ['Cliente agosto']);

  const julio = await calcularAnalitica('mes_anterior', AHORA);
  assert.deepEqual(julio.concentracion.top.map(c => c.nombre), ['Cliente julio']);

  // El año los ve a los tres: es el conjunto más amplio, no el default de todos.
  const anio = await calcularAnalitica('anio', AHORA);
  assert.equal(anio.concentracion.clientes, 3);
});

test('CANALES respeta el chip — no queda clavado en el año', async () => {
  await sembrarTresMeses();

  const agosto = await calcularAnalitica('mes', AHORA);
  assert.deepEqual(agosto.canales.map(c => c.name), ['Directo']);

  const julio = await calcularAnalitica('mes_anterior', AHORA);
  assert.deepEqual(julio.canales.map(c => c.name), ['Whatsapp']);

  const anio = await calcularAnalitica('anio', AHORA);
  assert.equal(anio.canales.length, 3);
});

test('ÚLTIMOS 3 MESES es ventana móvil: incluye el mes en curso y deja fuera el 4º', async () => {
  // Hoy es agosto → la ventana es junio, julio y agosto. Mayo queda fuera. Un
  // trimestre CALENDARIO habría mostrado julio-septiembre y perdido junio.
  await sembrarTresMeses();

  const r = await calcularAnalitica('ultimos_3_meses', AHORA);
  assert.equal(r.rentabilidad.filas[0]?.unidades, 2);          // julio + agosto
  assert.equal(r.concentracion.clientes, 2);
  assert.deepEqual(r.canales.map(c => c.name).sort(), ['Directo', 'Whatsapp']);   // sin Instagram (mayo)
});

test('la RECURRENCIA es acumulada y NO se mueve con el chip', async () => {
  // Deliberado, y afirmado para que nadie lo "arregle": es una métrica de la BASE
  // de clientes y tiene que cuadrar con la página de Clientes, que es acumulada.
  // Restringirla al período respondería otra pregunta ("quién compró 2+ veces
  // este mes") con muestras minúsculas.
  await sembrarTresMeses();

  const agosto = await calcularAnalitica('mes', AHORA);
  const anio   = await calcularAnalitica('anio', AHORA);
  assert.equal(agosto.recurrencia.clientes, anio.recurrencia.clientes);
  assert.equal(agosto.recurrencia.recurrentes, anio.recurrencia.recurrentes);
});

test('la CARTERA es saldo vigente y tampoco se mueve con el chip', async () => {
  const p = await producto({ slug: 'origen', nombre: 'Origen 500g', precio: 20_000, costo: 12_000 });
  await vender({ numero: 'CN-510001', productoId: p.id, nombre: p.nombre, cantidad: 1, precio: 40_000, creadaEl: new Date('2026-08-14T15:00:00Z') });

  const agosto = await calcularAnalitica('mes', AHORA);
  const julio  = await calcularAnalitica('mes_anterior', AHORA);
  assert.equal(agosto.cartera.total, 40_000);
  assert.equal(julio.cartera.total, 40_000);
});

test('la TRAYECTORIA es la serie larga y tampoco se recorta con el chip', async () => {
  await sembrarTresMeses();
  const agosto = await calcularAnalitica('mes', AHORA);
  const julio  = await calcularAnalitica('mes_anterior', AHORA);
  assert.deepEqual(
    agosto.trayectoria.map(t => t.ingresos),
    julio.trayectoria.map(t => t.ingresos),
  );
  // Y sigue viendo mayo, que ningún chip corto alcanza.
  assert.equal(agosto.trayectoria.find(t => t.month === '2026-05')?.ingresos, 20_000);
});
