import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const payments = await prisma.payment.findMany({
    orderBy: { createdAt: 'desc' },
    take:    200,
  });

  return NextResponse.json(payments);
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body    = await req.json();
  const payment = await prisma.payment.create({
    data: {
      cliente_nombre: body.cliente_nombre || null,
      monto:          Number(body.monto),
      metodo:         body.metodo         || 'nequi',
      estado:         body.estado         || 'pendiente',
      referencia:     body.referencia     || null,
      notas:          body.notas          || null,
      fecha_pago:     body.estado === 'completado'
                        ? new Date().toISOString().split('T')[0]
                        : null,
    },
  });

  return NextResponse.json(payment, { status: 201 });
}