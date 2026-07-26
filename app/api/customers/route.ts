import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import { normalizeCustomerPhone } from '@/lib/whatsapp-link';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: 'desc' },
    // Referential order count = raw FK references (Order.cliente_id), NO filter —
    // the SAME thing the delete guard counts, so the row's delete affordance can
    // match it exactly (no "0 órdenes" row that still 409s). One query, no per-row
    // fetch. Distinct from the displayed `numero_ordenes` (business count).
    include: { _count: { select: { orders: true } } },
  });

  const withRefs = customers.map(({ _count, ...c }) => ({ ...c, ordenesRef: _count.orders }));

  return NextResponse.json(withRefs);
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