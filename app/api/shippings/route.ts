import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@duna/core';
import { headers } from 'next/headers';
import { ensureShipping, decideShippingSchedulable } from '@duna/core/fulfillment';

// Order-owned fields read live via the relation — INCLUDING the delivery
// address, which lives only on the Order (the Shipping no longer keeps its own
// copy). `estado` + condición + the declared method drive the Entregas payment
// badge, the Contraentrega badge, and the "cobrar al entregar" hint.
const ORDER_SELECT = {
  select: {
    numero_orden:       true,
    cliente_nombre:     true,
    cliente_telefono:   true,
    direccion_entrega:  true,
    ciudad_entrega:     true,
    estado:             true,
    condicion_pago:     true,
    metodoPagoPrevisto: true,
    metodo_pago:        true,
  },
} as const;

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const shippings = await prisma.shipping.findMany({
    orderBy: { createdAt: 'desc' },
    take:    200,
    include: { order: ORDER_SELECT },
  });

  return NextResponse.json(shippings);
}

// POST ensures a SCHEDULABLE Shipping exists for an order. It is the ONLY create
// entry point exposed to the UI (the auto-create on payment lives in
// lib/fulfillment via transitionOrder).
//
//   • Any non-cancelled order may be prepared — "Preparar envío" while still
//     `pendiente`, regardless of payment. Preparing is harmless (no stock moves);
//     the real gate is at DISPATCH, where an unpaid order needs explicit
//     confirmation (shippings PATCH) and flips to CONTRAENTREGA.
//   • Cancelled orders are NEVER schedulable.
//   • Idempotent: if a Shipping already exists it's returned as-is (never a second
//     one, never a state reset) — so a later payment confirmation is a no-op.
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const ordenId = typeof body?.orden_id === 'string' ? body.orden_id.trim() : '';
  if (!ordenId) return NextResponse.json({ error: 'orden_id requerido' }, { status: 400 });

  const order = await prisma.order.findUnique({
    where:  { id: ordenId },
    select: { id: true, estado: true, costo_envio: true, shipping: { select: { id: true } } },
  });
  if (!order) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });

  // The whole decision lives in one pure function (server is the enforcement
  // point). Cancelled → reject; existing → return as-is; otherwise create.
  const decision = decideShippingSchedulable(order.estado, !!order.shipping);

  if (decision.action === 'reject') {
    return NextResponse.json({ error: decision.error }, { status: decision.status });
  }

  if (decision.action === 'return_existing') {
    const existing = await prisma.shipping.findUnique({
      where:   { orden_id: ordenId },
      include: { order: ORDER_SELECT },
    });
    return NextResponse.json(existing);
  }

  const shipping = await prisma.$transaction(async (tx) => {
    // "Preparar envío" es una acción MANUAL del operador → el asiento de creación
    // del envío lleva su sesión como actor.
    await ensureShipping(tx, order, { id: session.user.id, nombre: session.user.name ?? null });
    return tx.shipping.findUnique({
      where:   { orden_id: ordenId },
      include: { order: ORDER_SELECT },
    });
  });

  return NextResponse.json(shipping, { status: 201 });
}
