import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@duna/core';
import { headers } from 'next/headers';
import { normalizeCustomerPhone } from '@duna/core/whatsapp-link';
import { pedidosDelCliente } from '@/lib/clientes/detalle';

// Cliente + su historial de pedidos, para el panel de detalle.
//
// QUÉ PEDIDOS SON SUYOS lo decide `pedidosDelCliente` (lib/clientes/detalle), no
// este handler: la regla es la decisión y tiene que poder afirmarse contra una
// base real. Su docstring cuenta por qué el `OR` por snapshot que había acá
// cruzaba clientes que comparten teléfono — y por qué eso no es un borde sino la
// consecuencia de que `Customer.telefono` no sea único a propósito.
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

  const [orders, paidAgg] = await Promise.all([
    pedidosDelCliente(id),
    // "Total comprado" del perfil viejo: plata REAL (suma de Payments), no el
    // campo semilla `total_compras`. Va por la MISMA FK que el historial — con el
    // `OR` de antes le sumaba a este cliente los pagos de otro.
    //
    // MUERE CON EL PERFIL VIEJO, que es su único lector: la pantalla nueva toma
    // el número del endpoint de LISTA, que siempre agregó por FK. Se conserva en
    // este commit para no dejarle un `$ 0` a una pantalla que todavía existe.
    prisma.payment.aggregate({ where: { order: { cliente_id: id } }, _sum: { monto: true } }),
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