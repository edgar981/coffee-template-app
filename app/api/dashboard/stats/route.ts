import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import { BUSINESS_TZ, startOfZonedDay, startOfZonedMonth } from '@/lib/timezone';

const RECENT_LIMIT = 6;

// Cancelled orders are excluded from all counts, revenue and average-ticket
// figures. They still appear in the recent-orders feed (it's a transaction log).
const NOT_CANCELLED = { estado: { not: 'cancelado' } };

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  // Day + month boundaries anchored to local midnight in America/Bogota, not UTC.
  const now            = new Date();
  const todayStart     = startOfZonedDay(now, BUSINESS_TZ, 0);
  const tomorrowStart  = startOfZonedDay(now, BUSINESS_TZ, 1);
  const yesterdayStart = startOfZonedDay(now, BUSINESS_TZ, -1);
  // Trend window (see lib/metrics/trend.ts): current calendar month in progress
  // vs. the previous complete month.
  const monthStart     = startOfZonedMonth(now, BUSINESS_TZ, 0);
  const nextMonthStart = startOfZonedMonth(now, BUSINESS_TZ, 1);
  const prevMonthStart = startOfZonedMonth(now, BUSINESS_TZ, -1);

  const [
    ordersToday,
    ordersYesterday,
    pendingOrders,
    revenueAgg,
    revenueTodayAgg,
    recentOrders,
    curMonthAgg,
    prevMonthAgg,
  ] = await Promise.all([
    prisma.order.count({
      where: { ...NOT_CANCELLED, createdAt: { gte: todayStart, lt: tomorrowStart } },
    }),
    prisma.order.count({
      where: { ...NOT_CANCELLED, createdAt: { gte: yesterdayStart, lt: todayStart } },
    }),
    prisma.order.count({ where: { estado: 'pendiente' } }),
    prisma.order.aggregate({
      where: NOT_CANCELLED,
      _sum:  { total: true },
      _count: true,
    }),
    prisma.order.aggregate({
      where: { ...NOT_CANCELLED, createdAt: { gte: todayStart, lt: tomorrowStart } },
      _sum:  { total: true },
    }),
    prisma.order.findMany({
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take:    RECENT_LIMIT,
    }),
    // Current calendar month (in progress) — revenue + order count.
    prisma.order.aggregate({
      where:  { ...NOT_CANCELLED, createdAt: { gte: monthStart, lt: nextMonthStart } },
      _sum:   { total: true },
      _count: true,
    }),
    // Previous complete month — revenue + order count (also the anti-noise base).
    prisma.order.aggregate({
      where:  { ...NOT_CANCELLED, createdAt: { gte: prevMonthStart, lt: monthStart } },
      _sum:   { total: true },
      _count: true,
    }),
  ]);

  const totalRevenue = revenueAgg._sum.total ?? 0;
  const orderCount   = revenueAgg._count;

  const ordersDeltaPct = ordersYesterday > 0
    ? Math.round(((ordersToday - ordersYesterday) / ordersYesterday) * 100)
    : null;

  // Month-over-month (Order-based, non-cancelled). Per-month avg ticket derived.
  const curRev = curMonthAgg._sum.total ?? 0;
  const curCnt = curMonthAgg._count;
  const prevRev = prevMonthAgg._sum.total ?? 0;
  const prevCnt = prevMonthAgg._count;
  const monthly = {
    revenue:   { current: curRev, previous: prevRev },
    orders:    { current: curCnt, previous: prevCnt },
    avgTicket: {
      current:  curCnt  > 0 ? Math.round(curRev / curCnt)   : 0,
      previous: prevCnt > 0 ? Math.round(prevRev / prevCnt) : 0,
    },
    prevMonthOrders: prevCnt,
  };

  return NextResponse.json({
    ordersToday,
    ordersYesterday,
    ordersDeltaPct,
    pendingOrders,
    totalRevenue,
    revenueToday: revenueTodayAgg._sum.total ?? 0,
    avgTicket:    orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0,
    recentOrders,
    monthly,
  });
}
