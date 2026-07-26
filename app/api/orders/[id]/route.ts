import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import { transitionOrder, CondicionPagoLockedError, type OrderTransitionData } from '@/lib/orders';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await params;
  const body   = await req.json();

  // Whitelist the mutable fields. `condicion_pago` is NEVER accepted raw — it is
  // derived from `metodoPagoPrevisto` inside transitionOrder (a value sent in the
  // body is ignored by construction). Editing the method re-derives the condición
  // (locked once a Shipping/Payment exists → 409 below).
  const data: OrderTransitionData = {
    estado:             body.estado,
    metodo_pago:        body.metodo_pago,
    notas_internas:     body.notas_internas,
    notas_entrega:      body.notas_entrega,
    direccion_entrega:  body.direccion_entrega,
    metodoPagoPrevisto: body.metodoPagoPrevisto,
  };

  // Status write + Shipping auto-create happen in ONE transaction, so a paid
  // order can never be left without its Shipping. Every UI path (dropdown, modal,
  // payment registration) funnels through the shared `transitionOrder` helper.
  try {
    const result = await prisma.$transaction((tx) => transitionOrder(tx, id, data));
    return NextResponse.json(result);
  } catch (error) {
    // condicion_pago is lifecycle-locked (Shipping/Payment exists) → 409.
    if (error instanceof CondicionPagoLockedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await params;
  await prisma.order.delete({ where: { id: id } });

  return NextResponse.json({ ok: true });
}