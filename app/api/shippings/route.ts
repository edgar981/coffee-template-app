import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';

// Order-owned fields read live via the relation — INCLUDING the delivery
// address, which lives only on the Order (the Shipping no longer keeps its own
// copy). There is no POST here — a Shipping is only ever auto-created when its
// order is paid (see lib/fulfillment.ts).
const ORDER_SELECT = {
  select: {
    numero_orden:      true,
    cliente_nombre:    true,
    cliente_telefono:  true,
    direccion_entrega: true,
    ciudad_entrega:    true,
  },
} as const;

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const shippings = await prisma.shipping.findMany({
    orderBy: { createdAt: 'desc' },
    take:    200,
    include: { order: ORDER_SELECT },
  });

  return NextResponse.json(shippings);
}
