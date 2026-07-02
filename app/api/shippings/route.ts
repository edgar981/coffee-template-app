import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const shippings = await prisma.shipping.findMany({
    orderBy: { createdAt: 'desc' },
    take:    200,
  });

  return NextResponse.json(shippings);
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body     = await req.json();
  const shipping = await prisma.shipping.create({
    data: {
      orden_id:        body.orden_id        || null,
      numero_orden:    body.numero_orden    || null,
      cliente_nombre:  body.cliente_nombre  || null,
      direccion:       body.direccion,
      ciudad:          body.ciudad          || 'Bogotá',
      zona:            body.zona            || 'centro',
      estado:          body.estado          || 'programado',
      costo_envio:     Number(body.costo_envio) || 8000,
      mensajero:       body.mensajero       || null,
      notas_entrega:   body.notas_entrega   || null,
      fecha_programada: body.fecha_programada || null,
      fecha_entrega:   body.fecha_entrega   || null,
    },
  });

  return NextResponse.json(shipping, { status: 201 });
}