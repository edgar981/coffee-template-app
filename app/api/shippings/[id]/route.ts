import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';

const ORDER_SELECT = {
  select: {
    numero_orden:      true,
    cliente_nombre:    true,
    cliente_telefono:  true,
    direccion_entrega: true,
    ciudad_entrega:    true,
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
    include: { order: { select: { direccion_entrega: true } } },
  });
  if (!current) return NextResponse.json({ error: 'Entrega no encontrada' }, { status: 404 });

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

  // A delivery can't be dispatched until it's scheduled: it must have a courier
  // AND a fecha_programada before it may go En Ruta. Enforced for every caller
  // (Entregas board, Ordenes) since all transitions funnel through here.
  if (nextEstado === 'en_ruta' && current.estado !== 'en_ruta') {
    const mensajero = (body.mensajero ?? current.mensajero)?.trim();
    const fecha     = (body.fecha_programada ?? current.fecha_programada)?.trim();
    if (!mensajero || !fecha) {
      return NextResponse.json(
        { error: 'La entrega debe tener mensajero y fecha programada antes de marcarla En Ruta' },
        { status: 400 },
      );
    }
  }

  // Capture the real delivery timestamp server-side the moment it transitions to
  // entregado (distinct from fecha_programada). Authoritative — not client-set.
  const justDelivered = nextEstado === 'entregado' && current.estado !== 'entregado';

  const updated = await prisma.shipping.update({
    where: { id: id },
    data:  {
      estado:           nextEstado,
      zona:             body.zona             ?? undefined,
      mensajero:        body.mensajero        ?? undefined,
      fecha_programada: body.fecha_programada ?? undefined,
      fecha_entrega:    justDelivered ? new Date().toISOString() : (body.fecha_entrega ?? undefined),
      notas_entrega:    body.notas_entrega    ?? undefined,
      updatedAt:        new Date(),
    },
    include: { order: ORDER_SELECT },
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
  await prisma.shipping.delete({ where: { id: id } });
  return NextResponse.json({ ok: true });
}