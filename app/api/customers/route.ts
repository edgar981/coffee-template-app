import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import { normalizeCustomerPhone } from '@/lib/whatsapp-link';
import { nonCancelledOrderCountByCustomer, paidTotalByCustomer } from '@/lib/metrics/customer-order-stats';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const [customers, ordenesById, pagadoById] = await Promise.all([
    prisma.customer.findMany({
      orderBy: { createdAt: 'desc' },
      // Referential order count = raw FK references (Order.cliente_id), NO filter —
      // the SAME thing the delete guard counts, so the row's delete affordance can
      // match it exactly (no deletable row that still 409s). Distinct from the
      // DISPLAYED count below, which excludes cancelled.
      include: { _count: { select: { orders: true } } },
    }),
    nonCancelledOrderCountByCustomer(),
    paidTotalByCustomer(),
  ]);

  const withStats = customers.map(({ _count, ...c }) => ({
    ...c,
    // `ordenes` (visible "N órdenes") = LIVE non-cancelled count — a pending order
    // IS an order. The client reads THIS, not the spread-through `numero_ordenes`
    // (seed-only, never incremented at order creation → 0 for runtime customers).
    ordenes:       ordenesById.get(c.id) ?? 0,
    // `$` = real money paid (sum of Payments); overrides the demo `total_compras`.
    total_compras: pagadoById.get(c.id) ?? 0,
    // Referential (delete affordance + 409 guard) — includes cancelled.
    ordenesRef:    _count.orders,
  }));

  return NextResponse.json(withStats);
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await req.json();

  const customer = await prisma.customer.create({
    data: {
      nombre:    body.nombre,
      email:     body.email     || null,
      // Canonicalize on write (same normalizer as order matching) so a manually
      // added customer is found by the order upsert instead of duplicated. Falls
      // back to the raw input when it isn't a Colombian mobile (keep what they typed).
      telefono:  normalizeCustomerPhone(body.telefono) ?? (body.telefono || null),
      ciudad:    body.ciudad    || null,
      direccion: body.direccion || null,
      canal:     body.canal     || 'directo',
      notas:     body.notas     || null,
      activo:    body.activo    ?? true,
    },
  });

  return NextResponse.json(customer, { status: 201 });
}