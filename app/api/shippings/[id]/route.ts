import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const body    = await req.json();
  const updated = await prisma.shipping.update({
    where: { id: id },
    data:  {
      estado:        body.estado        ?? undefined,
      mensajero:     body.mensajero     ?? undefined,
      fecha_entrega: body.fecha_entrega ?? undefined,
      notas_entrega: body.notas_entrega ?? undefined,
      updatedAt:     new Date(),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  await prisma.shipping.delete({ where: { id: id } });
  return NextResponse.json({ ok: true });
}