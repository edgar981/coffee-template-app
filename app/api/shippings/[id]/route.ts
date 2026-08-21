import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@duna/core';
import { headers } from 'next/headers';
import { DispatchStockError } from '@duna/core/fulfillment';
import { aplicarTransicionEnvio } from '@duna/core/shipping-transition';
import { notifyOrderEnRoute } from '@duna/core/notifications';
import { buildBrand } from '@/lib/config/brand';
import { runEventAutomations } from '@/lib/automations/engine';
import { TipoEnvio } from '@duna/core';
import { ZONAS } from '@/constants/shippings';

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

  // zona_sugerida es AUDITORÍA de la heurística de dirección, no una decisión:
  // se guarda tal cual llega (o null si no hubo sugerencia) y jamás sustituye a
  // `zona`, que es lo que el operador dejó en el Select. Se valida contra el
  // mismo conjunto de zonas para que la comparación `zona_sugerida != zona`
  // siga significando algo.
  if (
    body.zona_sugerida !== undefined && body.zona_sugerida !== null &&
    !(ZONAS as readonly string[]).includes(body.zona_sugerida)
  ) {
    return NextResponse.json({ error: 'Zona sugerida inválida' }, { status: 400 });
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


  try {
    // La transición vive en `aplicarTransicionEnvio` (@duna/core): lockea la ORDEN
    // (Orden → Shipping, el orden de adquisición de TODO el eje de fulfillment), re-lee
    // el shipping FRESCO bajo el lock, y recién ahí decide los gates + los movimientos
    // de stock. Se extrajo para afirmar su concurrencia en el carril: el defecto era una
    // carrera —dos PATCH concurrentes leían el estado sin lock y descontaban dos veces—.
    const resultado = await aplicarTransicionEnvio({
      shippingId:    id,
      ordenId:       current.orden_id,
      estadoDeseado: body.estado,
      isScheduling,
      campos: {
        zona:             body.zona,
        // `!== undefined` para zona_sugerida/transportadora/guía: un null explícito SÍ
        // se escribe (lo maneja la función). Acá sólo se normaliza el string.
        zona_sugerida:    body.zona_sugerida,
        mensajero:        body.mensajero,
        fecha_programada: body.fecha_programada,
        fecha_entrega:    body.fecha_entrega,
        notas_entrega:    body.notas_entrega,
        tipo_envio:       body.tipo_envio,
        transportadora:   typeof body.transportadora === 'string' ? (body.transportadora.trim() || null) : undefined,
        numero_guia:      typeof body.numero_guia === 'string' ? (body.numero_guia.trim() || null) : undefined,
      },
      actor: { id: session.user.id, nombre: session.user.name ?? null },
    });

    // La respuesta: el shipping ya transicionado, con la forma que el cliente espera.
    const updated = await prisma.shipping.findUniqueOrThrow({
      where: { id }, include: { order: ORDER_SELECT },
    });

    // Dispatch COMMITTED. Fire the "on its way" notification here — AFTER the
    // transaction, once (justDispatched is the single preparando→en_ruta edge, and
    // the transition is idempotent, so the email hangs off it, not off re-renders).
    // Fully guarded — the email can never affect the dispatch outcome.
    if (resultado.justDispatched) {
      try { await notifyOrderEnRoute(current.orden_id, buildBrand()); }
      catch (e) { console.error(`[notify] order.enRoute orden ${current.orden_id}:`, e); }

      // Cruces de stock mínimo provocados por este despacho. Post-commit: el stock
      // ya bajó de verdad, así que el aviso no puede referirse a algo que se
      // revirtió. `runEventAutomations` nunca lanza.
      for (const productoId of resultado.cruzaronMinimo) {
        await runEventAutomations({ tipo: 'stock.cruzo_minimo', productoId });
      }
    }

    // Entrega COMPLETADA. Mismo criterio que el despacho: colgado del ÚNICO borde
    // (…→ entregado), post-commit, y con la idempotencia de AutomationRun detrás
    // por si un cliente reenvía el PATCH.
    if (resultado.justDelivered) {
      await runEventAutomations({
        tipo: 'shipping.entregado', shippingId: id, orderId: current.orden_id,
      });
    }

    // Entrega FALLIDA. Mismo patrón: el único borde (… → fallido), post-commit —
    // el stock ya se restituyó, así que el aviso no puede referirse a una
    // devolución que se revirtió. Una entrega reprogramada que vuelve a fallar
    // pasa por acá otra vez y SÍ avisa de nuevo (la automatización usa cooldown,
    // no `una_vez`): cada intento perdido es un hecho nuevo.
    if (resultado.justFailed) {
      await runEventAutomations({
        tipo: 'shipping.fallido', shippingId: id, orderId: current.orden_id,
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