import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@duna/core';
import { headers } from 'next/headers';
import { transitionOrder, CondicionPagoLockedError, CobroEstadoNoEscribibleError, assertEstadoNoEsCobro, type OrderTransitionData } from '@duna/core/orders';
import { runEventAutomations } from '@/lib/automations/engine';

// LA ORDEN COMPLETA — lo que el panel de detalle pide al ABRIRSE.
//
// No existía un GET por id: la lista traía todo y el detalle se derivaba de ella.
// Deja de alcanzar con el Recorrido, porque el libro de transiciones es
// append-only y mandarlo entero para cada orden de la lista sería pagar N×M por
// un dato que el detalle consume de a uno (ver el comentario del GET de la
// lista). Acá sí va completo: es UNA orden.
//
// Y hay un segundo motivo, que es el del incidente del 2026-08-06 con los
// comprobantes: al abrir, la verdad la trae el SERVIDOR. Las mutaciones que el
// propio detalle dispara —despachar, cobrar, cancelar— escriben asientos, así que
// el panel tiene que poder repreguntar en vez de confiar en una copia de la lista
// que puede haber quedado atrás.
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
    include: {
      items:        true,
      shipping:     true,
      comprobantes: { orderBy: { createdAt: 'asc' } },
      // Los pagos son la plata: de acá sale el MÉTODO REAL del detalle (que puede
      // diferir del previsto) y la `fecha` con la que el Recorrido de una orden
      // ANTERIOR al libro deriva su punto "Pagado". El eje de cobro de la lista NO
      // los necesita: `Order.estado` es su espejo fiel por construcción.
      payments:     { orderBy: { fecha: 'asc' } },
      // EL LIBRO, cronológico ascendente y con los DOS ejes mezclados — que es
      // exactamente lo que `occurred_at` significa: la clave de orden global.
      //
      // El desempate por `id` no es adorno defensivo sin causa: `occurred_at` tiene
      // `DEFAULT CURRENT_TIMESTAMP`, y en Postgres eso es la hora de INICIO DE
      // TRANSACCIÓN, así que tres asientos de una misma tx empatarían y su orden
      // quedaría indefinido. Se midió contra Postgres real y NO empatan —Prisma
      // genera el `now()` por fila en el cliente, así que el default del DDL nunca
      // se ejerce (3 asientos de una misma tx: .464, .473, .480)—. Pero eso es
      // comportamiento del CLIENTE, no una garantía de la base: un INSERT por SQL
      // crudo sí caería en el default, y `appendOrderStatusTransition` acepta un
      // `occurredAt` explícito que un llamador podría repetir. El segundo criterio
      // cuesta cero y vuelve la lectura determinista en los tres casos.
      transiciones: { orderBy: [{ occurred_at: 'asc' }, { id: 'asc' }] },
    },
  });
  if (!order) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });

  return NextResponse.json(order);
}

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
    const result = await prisma.$transaction((tx) => transitionOrder(tx, id, data, {
      id: session.user.id, nombre: session.user.name ?? null,
    }));

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