import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';

// Read-only payments ledger. Every row is a received payment tied to an order;
// the customer + order number are read live through the relation. Registration
// happens at POST /api/orders/[id]/payments — there is no independent create here.
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const payments = await prisma.payment.findMany({
    orderBy: { fecha: 'desc' },
    take:    500,
    include: { order: { select: { numero_orden: true, cliente_nombre: true } } },
  });

  return NextResponse.json(payments);
}
