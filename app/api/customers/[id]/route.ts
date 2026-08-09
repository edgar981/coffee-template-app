import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@duna/core';
import { Prisma } from '@duna/core';
import { headers } from 'next/headers';
import { normalizeCustomerPhone } from '@/lib/whatsapp-link';

// Customer + their order history for the dedicated profile page. Orders link to
// the customer by SNAPSHOT (there's no FK): email OR normalized phone — matching
// the identity rules in createOrderWithCustomer, so WhatsApp orders that carry
// only a phone show up in the customer's history too. A customer with neither —
// or no matching orders — simply has an empty history.
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

  // Primary link is the FK (`cliente_id`) — exact and format-proof, so it keeps
  // working after phones are canonicalized. Email/phone snapshots stay as a
  // fallback for any legacy order that was never linked (null cliente_id).
  const orClauses: Prisma.OrderWhereInput[] = [{ cliente_id: id }];
  if (customer.email)    orClauses.push({ cliente_email: customer.email });
  if (customer.telefono) orClauses.push({ cliente_telefono: customer.telefono });

  const [orders, paidAgg] = await Promise.all([
    prisma.order.findMany({
      where:   { OR: orClauses },
      select:  { id: true, numero_orden: true, estado: true, total: true, createdAt: true, shipping: { select: { estado: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    // Real money paid by this customer (same order set), for the "Total comprado"
    // stat — sum of Payments, not the demo `total_compras`.
    prisma.payment.aggregate({ where: { order: { OR: orClauses } }, _sum: { monto: true } }),
  ]);

  return NextResponse.json({ ...customer, orders, comprasPagadas: paidAgg._sum.monto ?? 0 });
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
      // Canonicalize on write — same normalizer as order matching (raw fallback
      // for non-mobile numbers).
      telefono:  normalizeCustomerPhone(body.telefono) ?? (body.telefono || null),
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

  // Auditable-record guard (the REAL enforcement — the UI gate is only a courtesy):
  // a customer with orders is NOT deletable. Their orders are financial history and
  // must keep pointing at them (the FK is onDelete: SetNull, so a delete would
  // silently orphan that history). `_count.orders` counts the FK relation.
  const customer = await prisma.customer.findUnique({
    where:   { id },
    include: { _count: { select: { orders: true } } },
  });
  if (!customer) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });

  const n = customer._count.orders;
  if (n > 0) {
    return NextResponse.json(
      // Este texto es el que ve el operador tal cual (el 409 sube al diálogo y
      // se muestra en el toast), así que dice lo esencial y nada más: por qué no
      // se puede y cuántas. Sin paréntesis aclaratorios ni coda tranquilizadora.
      { error: `No se puede eliminar: tiene ${n} ${n === 1 ? 'orden asociada' : 'órdenes asociadas'}.` },
      { status: 409 },
    );
  }

  await prisma.customer.delete({ where: { id: id } });

  return NextResponse.json({ ok: true });
}