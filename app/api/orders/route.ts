import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import { fireOrderTrigger } from '@/lib/automations/triggers';
import { ensureShippingForPaidOrder } from '@/lib/fulfillment';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const orders = await prisma.order.findMany({
    // shipping drives the "Programar entrega" edit flow and fulfillment display.
    include:  { items: true, shipping: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(orders);
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await req.json();
  const n    = String(Math.floor(Math.random() * 9000) + 1000);

  // Create + (if it starts paid) auto-create its Shipping in one transaction,
  // using the same idempotent hook as the status-change path.
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
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
    });

    if (order.estado === 'pagado') {
      await ensureShippingForPaidOrder(tx, order);
    }

    return tx.order.findUnique({
      where:   { id: order.id },
      include: { items: true, shipping: true },
    });
  });

  fireOrderTrigger('nueva_orden', result as any).catch(console.error);

  return NextResponse.json(result, { status: 201 });
}