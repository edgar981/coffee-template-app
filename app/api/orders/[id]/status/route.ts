import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import { fireOrderTrigger } from '@/lib/automations/triggers';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const { estado } = await req.json();

  const updated = await prisma.order.update({
    where:   { id: id },
    data:    { estado, updatedAt: new Date() },
    include: { items: true },
  });

  if (estado === 'entregado') {
    fireOrderTrigger('orden_entregada', updated as any).catch(console.error);
  }

  return NextResponse.json(updated);
}