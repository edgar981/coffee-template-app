import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@duna/core';
import { headers } from 'next/headers';
import { registerOrderPaymentTx, FechaFuturaError } from '@duna/core/orders';
import { dayKeyStart, BUSINESS_TZ } from '@duna/core/timezone';
import { runEventAutomations } from '@/lib/automations/engine';
import { MetodoPago } from '@duna/core';

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

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

  // Fecha de negocio como CLAVE DE DÍA (`YYYY-MM-DD`), anclada al inicio de ese día
  // en Bogotá (§ la trampa TZ de `lib/day-key`). Omitida → default now(). El veto a
  // futuro lo impone `registerOrderPaymentTx`.
  const dayKey = typeof body?.fecha === 'string' ? body.fecha : null;
  if (dayKey !== null && !DAY_KEY.test(dayKey)) {
    return NextResponse.json({ error: 'Fecha de pago inválida' }, { status: 400 });
  }
  const fecha = dayKey ? dayKeyStart(dayKey, BUSINESS_TZ) : undefined;

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

      // Shared money-in path: create the Payment (monto snapshotted from the
      // order total) + move order → pagado + auto-create the Shipping.
      const { payment, order: updatedOrder } = await registerOrderPaymentTx(tx, id, {
        monto:                 order.total,
        metodo:                metodo as MetodoPago,
        referencia:            typeof body?.referencia === 'string' ? body.referencia : null,
        notas:                 typeof body?.notas === 'string' ? body.notas : null,
        registrado_por:        session.user.id,
        registrado_por_nombre: session.user.name ?? null,
        fecha,
      });

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

    // Pago COMITEADO → la orden quedó `pagado`. Uno de los dos bordes que disparan
    // "Notificación Nueva Orden" (el otro es el PATCH de estado). Ambos pueden
    // ocurrir sobre la misma orden; la idempotencia de AutomationRun garantiza un
    // solo mensaje. Post-commit y fire-and-forget: jamás afecta el registro del pago.
    await runEventAutomations({ tipo: 'order.pagado', orderId: id });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    // Fecha futura: dato del cliente, no fallo del server.
    if (error instanceof FechaFuturaError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Register payment failed:', error);
    return NextResponse.json({ error: 'No se pudo registrar el pago' }, { status: 500 });
  }
}
