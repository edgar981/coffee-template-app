import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import { BUSINESS_TZ, startOfZonedDay, startOfZonedMonth } from '@/lib/timezone';
import { currentMonthRange, PENDING_ESTADO } from '@/lib/metrics/order-stat-filters';
// Los scopes de plata/órdenes viven en el módulo compartido: los reportes de las
// automatizaciones (semanal, diario) cuentan con ESTAS mismas definiciones, así que
// el correo del lunes no puede contradecir al dashboard.
import { NOT_CANCELLED, REVENUE_ORDER_SCOPE, POR_COBRAR_WHERE } from '@/lib/metrics/prisma-scopes';

const RECENT_LIMIT = 6;

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

  const [
    ventasHoyAgg,
    revenueTotalAgg,
    revenueMonthAgg,
    revenuePrevMonthAgg,
    porCobrarAgg,
    pendingTotal,
    despachosHoy,
    pedidosHoy,
    recentOrders,
    curMonthOrders,
    prevMonthOrders,
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
    // Every `pendiente` order (por-cobrar is carved out of this below).
    prisma.order.count({ where: { estado: PENDING_ESTADO } }),
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

  return NextResponse.json({
    // Fila "Hoy"
    ventasHoy:      ventasHoyAgg._sum.monto ?? 0,
    pedidosHoy,
    despachosHoy,
    // Cuentas por cobrar (count + pesos)
    porCobrar,
    porCobrarMonto: porCobrarAgg._sum.total ?? 0,
    // Órdenes pendientes = pendiente MINUS por-cobrar (la plata en la calle no
    // "requiere atención"). pendingOrders + porCobrar = todo `pendiente`.
    pendingOrders:  pendingTotal - porCobrar,
    // Ingresos (Payments)
    revenueMonth,
    revenueTotal:   revenueTotalAgg._sum.monto ?? 0,
    avgTicket:      avgTicketCur,
    recentOrders,
    monthly: {
      revenue:   { current: revenueMonth, previous: revenuePrev },
      orders:    { current: curMonthOrders, previous: prevMonthOrders },
      avgTicket: { current: avgTicketCur, previous: avgTicketPrev },
      prevMonthOrders,
    },
  });
}
