import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import { dispatchStockDecrement, restockShippingStock, DispatchStockError } from '@/lib/fulfillment';
import { markContraentregaAtDispatch } from '@/lib/orders';
import { notifyOrderEnRoute } from '@/lib/notifications';
import { runEventAutomations } from '@/lib/automations/engine';
import { TipoEnvio } from '@/src/generated/prisma/client';

const TIPOS_ENVIO = Object.values(TipoEnvio);

const ORDER_SELECT = {
  select: {
    numero_orden:       true,
    cliente_nombre:     true,
    cliente_telefono:   true,
    direccion_entrega:  true,
    ciudad_entrega:     true,
    // Kept in sync with the collection route so the Entregas payment badge and
    // "cobrar al entregar" hint survive a state change (this response replaces
    // the row in the board).
    estado:             true,
    condicion_pago:     true,
    metodoPagoPrevisto: true,
    metodo_pago:        true,
  },
} as const;

// PATCH is the "Programar entrega" path — it EDITS the already auto-created
// Shipping (adds courier/zona/date, advances fulfillment state). It never
// creates one; address/city/cost snapshots are set at auto-creation.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await params;
  const body    = await req.json();

  const current = await prisma.shipping.findUnique({
    where:   { id },
    include: { order: { select: { direccion_entrega: true, estado: true, condicion_pago: true } } },
  });
  if (!current) return NextResponse.json({ error: 'Entrega no encontrada' }, { status: 404 });

  // tipo_envio must be a valid enum value when sent (transportadora/numero_guia
  // are free text, trimmed; they matter when NACIONAL).
  if (body.tipo_envio !== undefined && !TIPOS_ENVIO.includes(body.tipo_envio)) {
    return NextResponse.json({ error: 'Tipo de envío inválido' }, { status: 400 });
  }

  // A voided delivery is terminal: it can't be scheduled or advanced. Only the
  // Order-cancellation path (order PATCH) ever sets `cancelado`.
  if (current.estado === 'cancelado') {
    return NextResponse.json(
      { error: 'La entrega está cancelada y no puede modificarse' },
      { status: 409 },
    );
  }

  // A "scheduling" edit touches courier/zona/date. State-only transitions (from
  // the Entregas next-state buttons) don't and are always allowed.
  const isScheduling =
    body.zona !== undefined ||
    body.mensajero !== undefined ||
    body.fecha_programada !== undefined;

  if (isScheduling) {
    // Can't (re)schedule a delivery already dispatched — it would overwrite a
    // real fulfillment record. Only preparando/fallido may be scheduled.
    if (current.estado === 'en_ruta' || current.estado === 'entregado') {
      return NextResponse.json(
        { error: 'No se puede reprogramar una entrega en ruta o entregada' },
        { status: 409 },
      );
    }
    // Never schedule a delivery with no destination. The address lives on the
    // ORDER (read via the relation) — the single source of truth.
    if (!current.order?.direccion_entrega?.trim()) {
      return NextResponse.json(
        { error: 'La orden no tiene dirección de entrega; complétala antes de programar' },
        { status: 400 },
      );
    }
  }

  // The ONLY state change scheduling may perform: rescheduling a failed delivery
  // re-queues it for dispatch (fallido → preparando). Server-enforced, only from
  // fallido; otherwise scheduling never touches estado (state transitions come
  // from the Entregas next-state buttons via body.estado).
  const nextEstado =
    isScheduling && current.estado === 'fallido' ? 'preparando' : (body.estado ?? undefined);

  // THE dispatch transition (preparando → en_ruta). Two gates + side effects:
  const justDispatched = nextEstado === 'en_ruta' && current.estado !== 'en_ruta';
  // Dispatching an order with no registered payment: allowed, but only with the
  // operator's explicit confirmation. On confirm, the order becomes CONTRAENTREGA
  // (goods left before the money) — computed once here, applied in the tx below.
  const dispatchingUnpaid = justDispatched && current.order?.estado !== 'pagado';

  if (justDispatched) {
    // 1. A delivery can't be dispatched until it's scheduled: courier AND
    //    fecha_programada. Enforced for every caller (Entregas board, Ordenes)
    //    since all transitions funnel through here.
    const mensajero = (body.mensajero ?? current.mensajero)?.trim();
    const fecha     = (body.fecha_programada ?? current.fecha_programada)?.trim();
    if (!mensajero || !fecha) {
      return NextResponse.json(
        { error: 'La entrega debe tener mensajero y fecha programada antes de marcarla En Ruta' },
        { status: 400 },
      );
    }
    // 2. Unpaid dispatch requires an EXPLICIT confirmation flag — protects against
    //    accidental dispatch and against stale clients that don't know about it.
    //    Paid orders dispatch freely (no flag). "La acción define la condición":
    //    confirming here is what turns the order into CONTRAENTREGA (below).
    if (dispatchingUnpaid && body.confirmarSinPago !== true) {
      return NextResponse.json(
        { error: 'Esta orden no tiene un pago registrado. Confirma el despacho sin pago para continuar; la orden quedará contraentrega (por cobrar).' },
        { status: 409 },
      );
    }
  }

  // Restock trigger: a dispatched delivery coming back as fallido. (The other
  // return path — order cancelled after dispatch — restocks via transitionOrder.)
  const justFailed = nextEstado === 'fallido' && current.estado !== 'fallido';

  // Capture the real delivery timestamp server-side the moment it transitions to
  // entregado (distinct from fecha_programada). Authoritative — not client-set.
  const justDelivered = nextEstado === 'entregado' && current.estado !== 'entregado';

  try {
    // ONE transaction: the stock movement (decrement at dispatch / restock on
    // fallido, both marker-guarded and atomic per product) and the state write
    // commit together or not at all — a blocked dispatch changes nothing.
    // Productos que cruzaron su mínimo con ESTE despacho. Se recogen dentro de la
    // transacción (es el único punto donde se conoce el stock anterior) y el evento
    // se emite abajo, ya comiteado.
    let cruzaronMinimo: string[] = [];

    const updated = await prisma.$transaction(async (tx) => {
      if (justDispatched) cruzaronMinimo = await dispatchStockDecrement(tx, current);
      // Confirmed unpaid dispatch → the order is now cash-on-delivery. Flip its
      // condición in the SAME transaction (last permitted mutation of condición),
      // so a rolled-back dispatch never leaves a stray CONTRAENTREGA. No-op if it
      // was already CONTRAENTREGA (e.g. an Efectivo order).
      if (dispatchingUnpaid && current.order?.condicion_pago !== 'CONTRAENTREGA') {
        await markContraentregaAtDispatch(tx, current.orden_id);
      }
      if (justFailed)     await restockShippingStock(tx, current, 'Entrega fallida');

      return tx.shipping.update({
        where: { id: id },
        data:  {
          estado:           nextEstado,
          zona:             body.zona             ?? undefined,
          mensajero:        body.mensajero        ?? undefined,
          fecha_programada: body.fecha_programada ?? undefined,
          fecha_entrega:    justDelivered ? new Date().toISOString() : (body.fecha_entrega ?? undefined),
          notas_entrega:    body.notas_entrega    ?? undefined,
          tipo_envio:       body.tipo_envio       ?? undefined,
          transportadora:   typeof body.transportadora === 'string' ? (body.transportadora.trim() || null) : undefined,
          numero_guia:      typeof body.numero_guia === 'string' ? (body.numero_guia.trim() || null) : undefined,
          updatedAt:        new Date(),
        },
        include: { order: ORDER_SELECT },
      });
    });

    // Dispatch COMMITTED. Fire the "on its way" notification here — AFTER the
    // transaction, once (justDispatched is the single preparando→en_ruta edge, and
    // the transition is idempotent, so the email hangs off it, not off re-renders).
    // Fully guarded — the email can never affect the dispatch outcome.
    if (justDispatched) {
      try { await notifyOrderEnRoute(current.orden_id); }
      catch (e) { console.error(`[notify] order.enRoute orden ${current.orden_id}:`, e); }

      // Cruces de stock mínimo provocados por este despacho. Post-commit: el stock
      // ya bajó de verdad, así que el aviso no puede referirse a algo que se
      // revirtió. `runEventAutomations` nunca lanza.
      for (const productoId of cruzaronMinimo) {
        await runEventAutomations({ tipo: 'stock.cruzo_minimo', productoId });
      }
    }

    // Entrega COMPLETADA. Mismo criterio que el despacho: colgado del ÚNICO borde
    // (…→ entregado), post-commit, y con la idempotencia de AutomationRun detrás
    // por si un cliente reenvía el PATCH.
    if (justDelivered) {
      await runEventAutomations({
        tipo: 'shipping.entregado', shippingId: id, orderId: current.orden_id,
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    // Insufficient stock blocks the dispatch — 409 naming the product(s); the
    // transaction already rolled back every partial decrement.
    if (error instanceof DispatchStockError) {
      return NextResponse.json(
        { error: error.message, productosSinStock: error.productos },
        { status: 409 },
      );
    }
    throw error;
  }
}

// NO DELETE — a Shipping is an auditable fulfillment record: it is CANCELLED
// (estado → 'cancelado', driven by the order-cancellation path), never
// hard-deleted. Do not reintroduce a delete handler here (see CLAUDE.md /
// AGENTS.md immutability policy).