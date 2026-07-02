import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const updated = await prisma.payment.update({
    where: { id: id },
    data:  {
      estado:     'completado',
      fecha_pago: new Date().toISOString().split('T')[0],
      updatedAt:  new Date(),
    },
  });

  return NextResponse.json(updated);
}