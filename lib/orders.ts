import { Prisma } from '@/src/generated/prisma/client';
import { ensureShippingForPaidOrder } from '@/lib/fulfillment';

// Fields any caller may change on an order. `?? undefined` semantics (a null/
// absent value is left untouched) match the original PATCH handler.
export interface OrderTransitionData {
  estado?: string | null;
  metodo_pago?: string | null;
  notas_internas?: string | null;
  notas_entrega?: string | null;
  direccion_entrega?: string | null;
}

// THE single write path for Order.estado. Updates the order and runs the
// state-driven fulfillment side effects — auto-create the Shipping in
// `preparando` on `pagado`, void it on `cancelado` — inside the SAME transaction
// the caller supplies. Every flow that moves an order (the status dropdown, the
// order-edit modal, and payment registration) funnels through here, so a paid
// order can never be left without its Shipping and the logic lives in one place.
// Returns the order WITH items + shipping so callers can reflect it immediately.
export async function transitionOrder(
  tx: Prisma.TransactionClient,
  id: string,
  data: OrderTransitionData,
) {
  const updated = await tx.order.update({
    where: { id },
    data: {
      estado:            data.estado            ?? undefined,
      metodo_pago:       data.metodo_pago       ?? undefined,
      notas_internas:    data.notas_internas    ?? undefined,
      notas_entrega:     data.notas_entrega     ?? undefined,
      direccion_entrega: data.direccion_entrega ?? undefined,
      updatedAt:         new Date(),
    },
  });

  if (updated.estado === 'pagado') {
    await ensureShippingForPaidOrder(tx, updated);
  } else if (updated.estado === 'cancelado') {
    // Cancelling voids the delivery as a STATE TRANSITION (never a delete) — an
    // auditable trail. updateMany is a no-op when there's no shipping yet.
    await tx.shipping.updateMany({
      where: { orden_id: id },
      data:  { estado: 'cancelado', updatedAt: new Date() },
    });
  }

  return tx.order.findUnique({
    where:   { id },
    include: { items: true, shipping: true },
  });
}
