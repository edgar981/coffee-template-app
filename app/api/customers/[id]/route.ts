import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';

// Customer + their order history for the dedicated profile page. Orders link to
// the customer by the email snapshot (there's no FK), so a customer with no
// email — or none matching — simply has an empty history.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await params;
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });

  const orders = customer.email
    ? await prisma.order.findMany({
        where:   { cliente_email: customer.email },
        select:  { id: true, numero_orden: true, estado: true, total: true, createdAt: true, shipping: { select: { estado: true } } },
        orderBy: { createdAt: 'desc' },
      })
    : [];

  return NextResponse.json({ ...customer, orders });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { id } = await params;
  const body    = await req.json();
  const updated = await prisma.customer.update({
    where: { id: id },
    data: {
      nombre:    body.nombre,
      email:     body.email     || null,
      telefono:  body.telefono  || null,
      ciudad:    body.ciudad    || null,
      direccion: body.direccion || null,
      canal:     body.canal     || 'directo',
      notas:     body.notas     || null,
      activo:    body.activo    ?? true,
      updatedAt: new Date(),
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
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await params;
  await prisma.customer.delete({ where: { id: id } });

  return NextResponse.json({ ok: true });
}