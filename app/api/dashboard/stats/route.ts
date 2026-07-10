import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import { BUSINESS_TZ, startOfZonedDay } from '@/lib/timezone';

const RECENT_LIMIT = 6;

// Cancelled orders are excluded from all counts, revenue and average-ticket
// figures. They still appear in the recent-orders feed (it's a transaction log).
const NOT_CANCELLED = { estado: { not: 'cancelado' } };

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  // Day boundaries anchored to local midnight in America/Bogota, not UTC.
  const now            = new Date();
  const todayStart     = startOfZonedDay(now, BUSINESS_TZ, 0);
  const tomorrowStart  = startOfZonedDay(now, BUSINESS_TZ, 1);
  const yesterdayStart = startOfZonedDay(now, BUSINESS_TZ, -1);

  const [
    ordersToday,
    ordersYesterday,
    pendingOrders,
    revenueAgg,
    revenueTodayAgg,
    recentOrders,
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
  ]);

  const totalRevenue = revenueAgg._sum.total ?? 0;
  const orderCount   = revenueAgg._count;

  const ordersDeltaPct = ordersYesterday > 0
    ? Math.round(((ordersToday - ordersYesterday) / ordersYesterday) * 100)
    : null;

  return NextResponse.json({
    ordersToday,
    ordersYesterday,
    ordersDeltaPct,
    pendingOrders,
    totalRevenue,
    revenueToday: revenueTodayAgg._sum.total ?? 0,
    avgTicket:    orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0,
    recentOrders,
  });
}
