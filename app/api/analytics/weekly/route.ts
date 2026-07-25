import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import { BUSINESS_TZ, startOfZonedDay, startOfZonedWeek, zonedDayKey } from '@/lib/timezone';
import type { WeeklyActivityData } from '@/types/analytics';

// Actividad Semanal: orders per weekday for ONE Monday–Sunday week in
// America/Bogota, navigated with ?week=YYYY-MM-DD (any day key — the server
// snaps it to that week's Monday and echoes the normalized key back).
//
// SCOPE — only `CN-` orders and non-cancelled states, matching the dashboard
// chart convention (SN- is demo/seed data and must never read as activity).
// NOTE: the REST of /api/analytics does not yet filter SN- — deliberately left
// as-is here; flagged for a separate cleanup rather than fixed card-by-card.
//
// DAY-OF-WEEK BUCKETING — in SQL, in Bogota wall clock. The timestamp columns
// hold UTC instants in `timestamp without time zone`, so the conversion needs
// both `AT TIME ZONE` steps (same pattern as /api/dashboard/chart). ISODOW:
// 1 = Monday … 7 = Sunday, matching the Lun→Dom card order.

const ORDER_PREFIX = 'CN-%';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const weekParamSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();

type WeekdayRow = { dow: number; ordenes: number; ingresos: number };

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const parsed = weekParamSchema.safeParse(req.nextUrl.searchParams.get('week') ?? undefined);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Parámetro week inválido (formato YYYY-MM-DD)' }, { status: 400 });
  }

  // Resolve the requested week. The day key is anchored at NOON UTC (07:00 in
  // Bogota) so it can never bleed into a neighbouring local day, then snapped
  // to its Monday. No param → current week.
  const now = new Date();
  let ref = now;
  if (parsed.data) {
    const [y, m, d] = parsed.data.split('-').map(Number);
    const anchor = new Date(Date.UTC(y, m - 1, d, 12));
    if (isNaN(anchor.getTime())) {
      return NextResponse.json({ error: 'Parámetro week inválido (fecha inexistente)' }, { status: 400 });
    }
    ref = anchor;
  }
  const weekStart    = startOfZonedWeek(ref, BUSINESS_TZ, 0);
  const currentStart = startOfZonedWeek(now, BUSINESS_TZ, 0);
  // No future weeks: there is nothing to show and the UI disables ›.
  if (weekStart > currentStart) {
    return NextResponse.json({ error: 'No hay semanas futuras' }, { status: 400 });
  }
  const weekEnd = startOfZonedDay(weekStart, BUSINESS_TZ, 7);

  const rows = await prisma.$queryRaw<WeekdayRow[]>`
    SELECT EXTRACT(ISODOW FROM o."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${BUSINESS_TZ})::int AS dow,
           COUNT(*)::int AS ordenes,
           COALESCE(SUM(o."total"), 0)::float8 AS ingresos
    FROM "Order" o
    WHERE o."createdAt" >= ${weekStart}
      AND o."createdAt" <  ${weekEnd}
      AND o."numero_orden" LIKE ${ORDER_PREFIX}
      AND o."estado" <> 'cancelado'
    GROUP BY 1
  `;

  // Zero-fill all 7 days so the bars always render Lun→Dom.
  const byDow = new Map(rows.map(r => [r.dow, r]));
  const payload: WeeklyActivityData = {
    week: zonedDayKey(weekStart, BUSINESS_TZ),
    days: DIAS.map((dia, i) => ({
      dia,
      ordenes:  byDow.get(i + 1)?.ordenes  ?? 0,
      ingresos: byDow.get(i + 1)?.ingresos ?? 0,
    })),
  };

  return NextResponse.json(payload);
}
