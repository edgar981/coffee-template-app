import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@duna/core';
import { headers } from 'next/headers';
import { BUSINESS_TZ, startOfZonedDay, startOfZonedMonth, startOfZonedYear, zonedDayKey } from '@duna/core/timezone';
import { currentMonthRange } from '@duna/core/metrics/order-stat-filters';
import { necesitaAtencion } from '@/lib/pedidos/atencion';
import type { OrderStatus } from '@/types/order';
import { plegarDistribuciones, plegarMetodosPago, type DistribucionRow, type MetodoPagoRow } from '@/lib/metrics/distribuciones';
import type { InsightMonthPoint } from '@/lib/metrics/insights';
// Los scopes de plata/órdenes viven en el módulo compartido: los reportes de las
// automatizaciones (semanal, diario) cuentan con ESTAS mismas definiciones, así que
// el correo del lunes no puede contradecir al dashboard.
import { NOT_CANCELLED, REVENUE_ORDER_SCOPE, POR_COBRAR_WHERE, ORDENES_REALES } from '@duna/core/metrics/prisma-scopes';

const RECENT_LIMIT = 6;

// Meses de la serie que alimenta los insights: 7 CERRADOS + el mes en curso. Los
// 7 no son arbitrarios — la regla semestral compara el último mes cerrado contra
// el promedio de los 6 anteriores (lib/metrics/insights.ts), así que con menos
// puntos esa regla nunca podría dispararse.
const SERIE_MESES = 8;

// Prefijo de las órdenes reales. Las `SN-` son data de demo heredada y no cuentan
// como ingreso.
const ORDER_PREFIX = 'CN-%';

type MesRow  = { month: string; total: number };
type MesCountRow = { month: string; n: number };

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  // Day + month boundaries anchored to local midnight in America/Bogota, not UTC.
  const now           = new Date();
  const todayStart    = startOfZonedDay(now, BUSINESS_TZ, 0);
  const tomorrowStart = startOfZonedDay(now, BUSINESS_TZ, 1);
  // Current calendar month in progress vs the previous complete month. The
  // current-month boundary comes from the SHARED helper the "Órdenes del mes"
  // link also uses — that shared definition is what keeps the card's count and
  // the filtered list identical.
  const { start: monthStart, end: nextMonthStart } = currentMonthRange(now);
  const prevMonthStart = startOfZonedMonth(now, BUSINESS_TZ, -1);
  // Ventana de la serie de insights: inicio del mes más antiguo que se muestra.
  const serieStart = startOfZonedMonth(now, BUSINESS_TZ, -(SERIE_MESES - 1));
  // El pie mantiene el período que YA cubría (año en curso), ahora anclado a
  // America/Bogota en vez de a la medianoche local del servidor.
  const yearStart = startOfZonedYear(now, BUSINESS_TZ);
  // `YYYY-MM` del mes en curso: el único punto de la serie que NO está cerrado.
  const currentMonthKey = zonedDayKey(now, BUSINESS_TZ).slice(0, 7);

  const [
    ventasHoyAgg,
    revenueTotalAgg,
    revenueMonthAgg,
    revenuePrevMonthAgg,
    porCobrarAgg,
    ordenesParaAtencion,
    despachosHoy,
    pedidosHoy,
    recentOrders,
    curMonthOrders,
    prevMonthOrders,
    firstPayment,
    lastPayment,
    lastDispatch,
    lastOrder,
    serieRevenueRows,
    serieOrdersRows,
    distRows,
    metodoPagoRows,
  ] = await Promise.all([
    // ── Ingresos (Payments) ──
    // Ventas de hoy: money received today.
    prisma.payment.aggregate({
      where: { ...REVENUE_ORDER_SCOPE, fecha: { gte: todayStart, lt: tomorrowStart } },
      _sum:  { monto: true },
    }),
    // Histórico: money received all-time.
    prisma.payment.aggregate({ where: REVENUE_ORDER_SCOPE, _sum: { monto: true } }),
    // Current calendar month (in progress) — revenue + payment count (avg base).
    prisma.payment.aggregate({
      where:  { ...REVENUE_ORDER_SCOPE, fecha: { gte: monthStart, lt: nextMonthStart } },
      _sum:   { monto: true },
      _count: true,
    }),
    // Previous complete month — revenue + payment count.
    prisma.payment.aggregate({
      where:  { ...REVENUE_ORDER_SCOPE, fecha: { gte: prevMonthStart, lt: monthStart } },
      _sum:   { monto: true },
      _count: true,
    }),
    // ── Cuentas por cobrar ── count + pesos owed, one aggregate, one definition.
    prisma.order.aggregate({ where: POR_COBRAR_WHERE, _sum: { total: true }, _count: true }),
    // ── Pedidos que piden acción ──
    // NO se traduce la regla a SQL: se trae un `select` ANGOSTO —sólo los campos
    // que `necesitaAtencion` mira— y decide la MISMA función que filtra el pill y
    // que enciende el punto del nav. Es la decisión que ya tomó
    // `/api/atencion`, y por el mismo motivo: un `where` con los cuatro
    // predicados escritos a mano es donde la tarjeta y la lista empiezan a
    // divergir, y la divergencia sería invisible (dos números plausibles).
    prisma.order.findMany({
      where:  { estado: { not: 'cancelado' }, ...ORDENES_REALES },
      select: {
        estado: true, condicion_pago: true,
        shipping:     { select: { estado: true, mensajero: true, fecha_programada: true } },
        comprobantes: { select: { estado: true } },
      },
    }),
    // ── Despachos de hoy ── shipments that LEFT today. `stock_descontado_at` is
    // stamped in the dispatch transaction (preparando → en_ruta) and cleared on
    // restock (fallido/cancelled), so this is exactly "currently-out, dispatched
    // today". THE authoritative dispatch instant (not fecha_programada).
    prisma.shipping.count({
      where: { stock_descontado_at: { gte: todayStart, lt: tomorrowStart } },
    }),
    // ── Pedidos de hoy ── real orders created today (excl. cancelled and SN-).
    prisma.order.count({
      where: { ...NOT_CANCELLED, numero_orden: { startsWith: 'CN-' }, createdAt: { gte: todayStart, lt: tomorrowStart } },
    }),
    // Recent orders EXCLUDE cancelled (same definition as every other metric).
    prisma.order.findMany({
      where:   NOT_CANCELLED,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take:    RECENT_LIMIT,
    }),
    // Order counts per month (for the "Órdenes del mes" value + its MoM pill).
    prisma.order.count({ where: { ...NOT_CANCELLED, createdAt: { gte: monthStart, lt: nextMonthStart } } }),
    prisma.order.count({ where: { ...NOT_CANCELLED, createdAt: { gte: prevMonthStart, lt: monthStart } } }),
    // Primer pago del libro — el "Desde …" del widget histórico. Mismo scope que
    // `revenueTotal`, así que el sub describe exactamente lo que suma el valor.
    prisma.payment.findFirst({
      where:   REVENUE_ORDER_SCOPE,
      orderBy: { fecha: 'asc' },
      select:  { fecha: true },
    }),
    // ── Último evento de cada tarjeta de scope HOY ──
    // Son el insight de esas tres tarjetas: sin serie mensual, el hecho
    // disponible es cuándo ocurrió el último evento real. Cada query hereda el
    // scope de SU tarjeta para que la línea no hable de un conjunto distinto del
    // número que acompaña.
    // Último pago: mismo scope que "Ventas de hoy" (CN-, no cancelada).
    prisma.payment.findFirst({
      where:   REVENUE_ORDER_SCOPE,
      orderBy: { fecha: 'desc' },
      select:  { fecha: true },
    }),
    // Último despacho: mismo scope que "Despachos de hoy" — que NO filtra SN-,
    // así que esto tampoco (la línea y el conteo deben mirar lo mismo).
    prisma.shipping.findFirst({
      where:   { stock_descontado_at: { not: null } },
      orderBy: { stock_descontado_at: 'desc' },
      select:  { stock_descontado_at: true },
    }),
    // Última orden creada: mismo scope que "Pedidos de hoy" (CN-, no cancelada).
    prisma.order.findFirst({
      where:   { ...NOT_CANCELLED, numero_orden: { startsWith: 'CN-' } },
      orderBy: { createdAt: 'desc' },
      select:  { createdAt: true },
    }),
    // ── Serie mensual para los insights ──
    // Bucketing por mes EN SQL y en America/Bogota (mismo doble AT TIME ZONE que
    // el endpoint del chart: las columnas son `timestamp without time zone` con
    // instantes UTC, así que hay que etiquetar y luego convertir).
    prisma.$queryRaw<MesRow[]>`
      SELECT to_char(pay."fecha" AT TIME ZONE 'UTC' AT TIME ZONE ${BUSINESS_TZ}, 'YYYY-MM') AS month,
             SUM(pay."monto")::float8 AS total
      FROM "Payment" pay
      JOIN "Order" o ON o."id" = pay."orden_id"
      WHERE pay."fecha" >= ${serieStart}
        AND pay."fecha" <  ${nextMonthStart}
        AND o."numero_orden" LIKE ${ORDER_PREFIX}
        AND o."estado" <> 'cancelado'
      GROUP BY 1
    `,
    // Órdenes por mes: MISMA definición que el valor de la tarjeta "Órdenes del
    // mes" (no canceladas, sin filtro de prefijo) — un insight que hablara de un
    // conjunto distinto del que muestra la tarjeta sería peor que no tenerlo.
    // Este conteo hereda por tanto la inconsistencia de SN- ya existente en esa
    // tarjeta; se reporta aparte, no se arregla a medias aquí.
    prisma.$queryRaw<MesCountRow[]>`
      SELECT to_char(o."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${BUSINESS_TZ}, 'YYYY-MM') AS month,
             COUNT(*)::int AS n
      FROM "Order" o
      WHERE o."createdAt" >= ${serieStart}
        AND o."createdAt" <  ${nextMonthStart}
        AND o."estado" <> 'cancelado'
      GROUP BY 1
    `,
    // ── Distribuciones del pie ── UN query base, dos agrupaciones (abajo, en
    // JS). Métrica = suma de `OrderItem.subtotal` (% de ingresos atribuibles),
    // la misma que ya usaba el pie de categoría; período = año en curso.
    // LEFT JOIN a Product: un item sin producto vivo no se descarta — cae en el
    // bucket residual de cada vista.
    // `moliendaSeleccionada` YA NO se selecciona ni agrupa: su vista se retiró y
    // el repo no calcula métricas que nadie consume.
    prisma.$queryRaw<DistribucionRow[]>`
      SELECT p."categoria"             AS categoria,
             p."peso_gramos"           AS peso,
             SUM(oi."subtotal")::float8 AS total
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orden_id"
      LEFT JOIN "Product" p ON p."id" = oi."producto_id"
      WHERE o."createdAt" >= ${yearStart}
        AND o."numero_orden" LIKE ${ORDER_PREFIX}
        AND o."estado" <> 'cancelado'
      GROUP BY 1, 2
    `,
    // ── Tercera vista del pie: reparto del DINERO RECIBIDO por método ──
    // Base distinta a la de arriba (pagos, no subtotales de items: incluye
    // envío), mismo período y misma exclusión de SN-. Se filtra por la fecha del
    // PAGO, no la de la orden: es cuándo entró la plata.
    prisma.$queryRaw<MetodoPagoRow[]>`
      SELECT pay."metodo"::text AS metodo,
             SUM(pay."monto")::float8 AS total
      FROM "Payment" pay
      JOIN "Order" o ON o."id" = pay."orden_id"
      WHERE pay."fecha" >= ${yearStart}
        AND o."numero_orden" LIKE ${ORDER_PREFIX}
        AND o."estado" <> 'cancelado'
      GROUP BY 1
    `,
  ]);

  const revenueMonth    = revenueMonthAgg._sum.monto     ?? 0;
  const revenuePrev     = revenuePrevMonthAgg._sum.monto ?? 0;
  const monthPayCount   = revenueMonthAgg._count;
  const prevPayCount    = revenuePrevMonthAgg._count;
  // Avg received per sale (payment) — month-based, so the MoM pill is coherent
  // (unlike a histórico value carrying a month-over-month arrow).
  const avgTicketCur    = monthPayCount > 0 ? Math.round(revenueMonth / monthPayCount) : 0;
  const avgTicketPrev   = prevPayCount  > 0 ? Math.round(revenuePrev  / prevPayCount)  : 0;

  const porCobrar = porCobrarAgg._count;

  // `Order.estado` es columna String en el schema (cada eje tiene su vocabulario);
  // `OrderStatus` es la lectura que hace la app. El cast vive acá, en la frontera,
  // y no dentro de la regla — la regla es pura y no debe saber de dónde vienen sus
  // datos. Mismo movimiento que en `/api/atencion`.
  const porAtender = ordenesParaAtencion
    .map(o => ({ ...o, estado: o.estado as OrderStatus }))
    .filter(necesitaAtencion)
    .length;

  // ── Serie mensual (insights) ──
  // Zero-fill sobre los meses de la ventana: un mes sin ventas es un 0 real, y
  // omitirlo convertiría un hueco en una "racha" falsa al juntar los extremos.
  const revenueByMonth = new Map(serieRevenueRows.map(r => [r.month, r.total]));
  const ordersByMonth  = new Map(serieOrdersRows.map(r => [r.month, r.n]));
  const monthKeys = Array.from({ length: SERIE_MESES }, (_, i) => {
    const d = startOfZonedMonth(now, BUSINESS_TZ, -(SERIE_MESES - 1 - i));
    return zonedDayKey(d, BUSINESS_TZ).slice(0, 7);
  });
  // `ordenes` (base de muestra) es el conteo mensual de órdenes en AMBAS series:
  // es lo que decide si el % es señal o ruido, también cuando el valor ya es un
  // conteo. `cerrado: false` SOLO para el mes en curso.
  const puntos = (valor: (month: string) => number): InsightMonthPoint[] =>
    monthKeys.map(month => ({
      month,
      value:   valor(month),
      ordenes: ordersByMonth.get(month) ?? 0,
      cerrado: month !== currentMonthKey,
    }));

  // ── Distribuciones del pie ── plegado puro y testeado (los buckets residuales
  // "Grano entero"/"Otros" son reglas de producto, no detalle de este handler).
  const distribuciones = {
    ...plegarDistribuciones(distRows),
    metodoPago: plegarMetodosPago(metodoPagoRows),
  };

  return NextResponse.json({
    // Fila "Hoy"
    ventasHoy:      ventasHoyAgg._sum.monto ?? 0,
    pedidosHoy,
    despachosHoy,
    // Cuentas por cobrar (count + pesos)
    porCobrar,
    porCobrarMonto: porCobrarAgg._sum.total ?? 0,
    // Pedidos que piden acción. `porCobrar` es UNO de los cuatro motivos, así que
    // es un subconjunto de éste — ya no su complemento (§ types/dashboard).
    porAtender,
    // Ingresos (Payments)
    revenueMonth,
    revenueTotal:   revenueTotalAgg._sum.monto ?? 0,
    revenueSince:   firstPayment?.fecha?.toISOString() ?? null,
    // Últimos eventos (insight de las tarjetas de hoy). `null` = nunca ocurrió.
    ultimoPago:     lastPayment?.fecha?.toISOString() ?? null,
    ultimoDespacho: lastDispatch?.stock_descontado_at?.toISOString() ?? null,
    ultimaOrden:    lastOrder?.createdAt?.toISOString() ?? null,
    /** Día de referencia (America/Bogota) para calcular "hace N días" en cliente. */
    hoyKey:         zonedDayKey(now, BUSINESS_TZ),
    avgTicket:      avgTicketCur,
    recentOrders,
    monthly: {
      revenue:   { current: revenueMonth, previous: revenuePrev },
      orders:    { current: curMonthOrders, previous: prevMonthOrders },
      avgTicket: { current: avgTicketCur, previous: avgTicketPrev },
      prevMonthOrders,
    },
    serieMensual: {
      revenue: puntos(m => revenueByMonth.get(m) ?? 0),
      orders:  puntos(m => ordersByMonth.get(m)  ?? 0),
    },
    distribuciones,
  });
}
