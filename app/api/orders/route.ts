import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import { fireOrderTrigger } from '@/lib/automations/triggers';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const orders = await prisma.order.findMany({
    include:  { items: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(orders);
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json();
  const n    = String(Math.floor(Math.random() * 9000) + 1000);

  const order = await prisma.order.create({
    data: {
      numero_orden:      `SN-${n}`,
      cliente_nombre:    body.cliente_nombre    || null,
      cliente_telefono:  body.cliente_telefono  || null,
      canal:             body.canal             || 'directo',
      estado:            body.estado            || 'pendiente',
      metodo_pago:       body.metodo_pago       || null,
      total:             Number(body.total)     || 0,
      costo_envio:       Number(body.costo_envio) || 0,
      direccion_entrega: body.direccion_entrega || null,
      ciudad_entrega:    body.ciudad_entrega    || null,
      notas_internas:    body.notas_internas    || null,
      notas_entrega:     body.notas_entrega     || null,
      items: {
        create: (body.items ?? []).map((item: { producto_nombre: string; cantidad: number; subtotal: number }) => ({
          producto_nombre: item.producto_nombre,
          cantidad:        item.cantidad,
          subtotal:        item.subtotal,
        })),
      },
    },
    include: { items: true },
  });

  fireOrderTrigger('nueva_orden', order as any).catch(console.error);

  return NextResponse.json(order, { status: 201 });
}