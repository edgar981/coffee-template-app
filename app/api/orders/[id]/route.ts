import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@duna/core';
import { headers } from 'next/headers';
import { transitionOrder, CondicionPagoLockedError, CobroEstadoNoEscribibleError, assertEstadoNoEsCobro, type OrderTransitionData } from '@/lib/orders';
import { runEventAutomations } from '@/lib/automations/engine';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await params;
  const body   = await req.json();

  // El eje de COBRO no se escribe por esta ruta: `pagado` solo lo pone el path de
  // Payment y `pendiente` su reverso con asiento. Solo `cancelado` (y no tocar
  // estado) pasan por acá. Rechazo temprano → 422, ANTES de abrir transacción.
  // Cierra las dos direcciones del bug de plata fantasma por imposibilidad.
  try {
    assertEstadoNoEsCobro(body.estado);
  } catch (error) {
    if (error instanceof CobroEstadoNoEscribibleError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    throw error;
  }

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
  // Estado ANTES de la transición: el disparador de "Notificación Nueva Orden" es
  // el BORDE (→ pagado), no el estado. Sin esto, cada PATCH sobre una orden ya
  // pagada volvería a considerarse un cruce (la idempotencia lo frenaría, pero a
  // costa de una consulta y un run espurio por cada guardado del modal).
  const previo = await prisma.order.findUnique({ where: { id }, select: { estado: true } });

  try {
    const result = await prisma.$transaction((tx) => transitionOrder(tx, id, data));

    // Transición COMITEADA. Fire-and-forget, jamás afecta la respuesta.
    if (result?.estado === 'pagado' && previo?.estado !== 'pagado') {
      await runEventAutomations({ tipo: 'order.pagado', orderId: id });
    }

    return NextResponse.json(result);
  } catch (error) {
    // condicion_pago is lifecycle-locked (Shipping/Payment exists) → 409.
    if (error instanceof CondicionPagoLockedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}

// NO DELETE — Orders are auditable financial records: they are CANCELLED
// (estado → 'cancelado' via PATCH/transitionOrder), never hard-deleted. Do not
// reintroduce a delete handler here (see CLAUDE.md / AGENTS.md immutability policy).