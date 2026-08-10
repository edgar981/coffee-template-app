import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@duna/core';
import { headers } from 'next/headers';
import { BUSINESS_TZ, startOfZonedDay, zonedDayKeyRange } from '@duna/core/timezone';
import { METODO_CATEGORIA } from '@/types/payment';
import type { MetodoPago } from '@/types/payment';
import {
  CHART_RANGE_DAYS, CHART_RANGES,
  type ChartRange, type DashboardChartData,
  type PedidosDailyPoint, type VentasDailyPoint,
} from '@/types/dashboard';

// Daily aggregates for the dashboard chart module (Ventas + Pedidos).
//
// SOURCE OF TRUTH — Ventas reads the PAYMENTS ledger, not Order.metodo_pago.
// The latter is what the customer DECLARED at checkout (free text, nullable, and
// never rewritten when the payment is registered — see transitionOrder); the
// former is the method the money actually arrived by. Bucketing goes through the
// existing METODO_CATEGORIA map, so this chart reconciles with the Pagos page.
//
// SCOPE — only `CN-` orders. `SN-` is grandfathered demo/seed data and must
// never show up as revenue.
//
// DAY BUCKETING — in SQL, in America/Bogota. The timestamp columns are
// `timestamp without time zone` holding UTC instants, so converting needs BOTH
// steps: `AT TIME ZONE 'UTC'` (tag it as UTC) then `AT TIME ZONE <tz>` (read it
// as local wall clock). Bucketing on the raw column would push a 21:00 Bogota
// order onto the next day.

const ORDER_PREFIX = 'CN-%';

function parseRange(value: string | null): ChartRange | null {
  return CHART_RANGES.includes(value as ChartRange) ? (value as ChartRange) : null;
}

type VentasRow  = { day: string; metodo: string; total: number };
type PedidosRow = { day: string; peso: number | null; lines: number };

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const range = parseRange(req.nextUrl.searchParams.get('range'));
  if (!range) {
    return NextResponse.json(
      { error: `Rango inválido. Valores permitidos: ${CHART_RANGES.join(', ')}` },
      { status: 400 },
    );
  }

  // Window = the last N local days, ending at tomorrow's local midnight so
  // today is fully included.
  const now   = new Date();
  const days  = CHART_RANGE_DAYS[range];
  const start = startOfZonedDay(now, BUSINESS_TZ, -(days - 1));
  const end   = startOfZonedDay(now, BUSINESS_TZ, 1);

  const [ventasRows, pedidosRows] = await Promise.all([
    // Revenue per day per registered payment method. Cancelled orders are
    // excluded (a refunded sale isn't revenue) — same convention as the KPIs.
    prisma.$queryRaw<VentasRow[]>`
      SELECT to_char(pay."fecha" AT TIME ZONE 'UTC' AT TIME ZONE ${BUSINESS_TZ}, 'YYYY-MM-DD') AS day,
             pay."metodo"::text AS metodo,
             SUM(pay."monto")::float8 AS total
      FROM "Payment" pay
      JOIN "Order" o ON o."id" = pay."orden_id"
      WHERE pay."fecha" >= ${start}
        AND pay."fecha" <  ${end}
        AND o."numero_orden" LIKE ${ORDER_PREFIX}
        AND o."estado" <> 'cancelado'
      GROUP BY 1, 2
    `,
    // Order lines per day per product weight. LEFT JOIN keeps lines whose
    // product was deleted (producto_id is nullable) — they fall into `otros`.
    prisma.$queryRaw<PedidosRow[]>`
      SELECT to_char(o."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${BUSINESS_TZ}, 'YYYY-MM-DD') AS day,
             p."peso_gramos" AS peso,
             COUNT(*)::int AS lines
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orden_id"
      LEFT JOIN "Product" p ON p."id" = oi."producto_id"
      WHERE o."createdAt" >= ${start}
        AND o."createdAt" <  ${end}
        AND o."numero_orden" LIKE ${ORDER_PREFIX}
        AND o."estado" = 'pagado'
      GROUP BY 1, 2
    `,
  ]);

  // Zero-fill: index the sparse rows by day, then walk every day in the window
  // so the chart never skips a date.
  const ventasByDay = new Map<string, VentasDailyPoint>();
  for (const row of ventasRows) {
    const point = ventasByDay.get(row.day)
      ?? { date: row.day, efectivo: 0, transferencia: 0, otro: 0 };
    const categoria = METODO_CATEGORIA[row.metodo as MetodoPago] ?? 'OTRO';
    if (categoria === 'EFECTIVO')           point.efectivo      += row.total;
    else if (categoria === 'TRANSFERENCIA') point.transferencia += row.total;
    else                                    point.otro          += row.total;
    ventasByDay.set(row.day, point);
  }

  const pedidosByDay = new Map<string, PedidosDailyPoint>();
  for (const row of pedidosRows) {
    const point = pedidosByDay.get(row.day)
      ?? { date: row.day, g250: 0, g500: 0, otros: 0 };
    if (row.peso === 250)      point.g250  += row.lines;
    else if (row.peso === 500) point.g500  += row.lines;
    else                       point.otros += row.lines;
    pedidosByDay.set(row.day, point);
  }

  const dayKeys = zonedDayKeyRange(now, BUSINESS_TZ, days);

  const payload: DashboardChartData = {
    range,
    ventas:  dayKeys.map(d => ventasByDay.get(d)  ?? { date: d, efectivo: 0, transferencia: 0, otro: 0 }),
    pedidos: dayKeys.map(d => pedidosByDay.get(d) ?? { date: d, g250: 0, g500: 0, otros: 0 }),
  };

  return NextResponse.json(payload);
}
