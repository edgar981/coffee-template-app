import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import { transitionOrder } from '@/lib/orders';
import { MetodoPago } from '@/src/generated/prisma/client';

const METODOS = Object.values(MetodoPago);

// Registrar pago DE una orden. In ONE transaction: snapshot the amount from the
// order total (never trust a client-sent monto), create the Payment, and move
// the order to `pagado` via the shared `transitionOrder` helper (which owns the
// Shipping auto-create). Only orders `pendiente` de pago qualify — already-paid
// or cancelled orders are rejected server-side, not just in the UI.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await params;
  const body   = await req.json().catch(() => null);

  const metodo = String(body?.metodo ?? '').toUpperCase();
  if (!METODOS.includes(metodo as MetodoPago)) {
    return NextResponse.json({ error: 'Método de pago inválido' }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Lock the order row for the tx: two concurrent "registrar pago" submits
      // can't both pass the `pendiente` check — the second blocks here, then
      // sees `pagado` and is rejected below.
      const locked = await tx.$queryRaw<{ estado: string; total: number }[]>`
        SELECT "estado", "total" FROM "Order" WHERE "id" = ${id} FOR UPDATE
      `;
      const order = locked[0];
      if (!order) return { error: 'not_found' as const };
      if (order.estado !== 'pendiente') {
        return { error: 'invalid_state' as const, estado: order.estado };
      }

      const payment = await tx.payment.create({
        data: {
          orden_id:              id,
          monto:                 order.total,          // snapshot, server-side
          metodo:                metodo as MetodoPago,
          referencia:            typeof body?.referencia === 'string' && body.referencia.trim() ? body.referencia.trim() : null,
          notas:                 typeof body?.notas === 'string' && body.notas.trim() ? body.notas.trim() : null,
          registrado_por:        session.user.id,
          registrado_por_nombre: session.user.name ?? null,
        },
      });

      // Moves order → pagado AND auto-creates the Shipping in `preparando`.
      const updatedOrder = await transitionOrder(tx, id, { estado: 'pagado' });

      return { payment, order: updatedOrder };
    });

    if ('error' in result) {
      if (result.error === 'not_found') {
        return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
      }
      return NextResponse.json(
        { error: `No se puede registrar un pago sobre una orden en estado "${result.estado}".` },
        { status: 409 },
      );
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Register payment failed:', error);
    return NextResponse.json({ error: 'No se pudo registrar el pago' }, { status: 500 });
  }
}
