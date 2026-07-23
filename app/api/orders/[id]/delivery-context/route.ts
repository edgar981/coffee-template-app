import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';

// Everything the "Programar entrega" modal needs about an order's delivery:
// contact (name/email/phone), the address (read from the ORDER, the single
// source of truth), and the linked Customer if one exists. Fetched fresh when
// the modal opens, so it stays caller-agnostic (Entregas and Ordenes both use it)
// and always reflects the latest address.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      numero_orden: true, cliente_nombre: true, cliente_email: true, cliente_telefono: true,
      direccion_entrega: true, ciudad_entrega: true, direccion_detalle: true,
    },
  });
  if (!order) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });

  // Customer is linked by email (upsert-by-email at checkout) — there's no FK, so
  // resolve it explicitly. A guest order (or one whose email has no Customer)
  // returns customer: null → the name renders without a link.
  const customer = order.cliente_email
    ? await prisma.customer.findUnique({
        where:  { email: order.cliente_email },
        select: { id: true, nombre: true, telefono: true },
      })
    : null;

  // Phone priority: order snapshot first, then the Customer record.
  const telefono = order.cliente_telefono ?? customer?.telefono ?? null;

  return NextResponse.json({
    numero_orden:      order.numero_orden,
    cliente_nombre:    order.cliente_nombre,
    cliente_email:     order.cliente_email,
    telefono,
    direccion_entrega: order.direccion_entrega,
    ciudad_entrega:    order.ciudad_entrega,
    direccion_detalle: order.direccion_detalle,
    customer:          customer ? { id: customer.id, nombre: customer.nombre } : null,
  });
}
