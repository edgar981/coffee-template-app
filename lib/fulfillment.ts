import { Prisma } from '@/src/generated/prisma/client';

interface PaidOrderSnapshot {
  id: string;
  costo_envio: number;
}

// When an order is `pagado`, ensure it has a fulfillment Shipping in
// `preparando`. This is the ONLY path that creates a Shipping.
//
// The delivery address is NOT copied here — it lives only on the Order and is
// read through the relation, so an added/edited address is always reflected.
// Only `costo_envio` is snapshotted (a stable figure at payment time).
//
// State-based and idempotent: the unique orden_id + upsert means calling it
// repeatedly (or for an order that already has a shipping) is a no-op — an
// existing shipping the operator already scheduled is never clobbered. Takes a
// Prisma transaction client so it runs in the SAME transaction as the status
// write. Zona and courier start empty. An order with no address is allowed here
// (it simply has none); scheduling it is blocked by the PATCH guard.
export async function ensureShippingForPaidOrder(
  tx: Prisma.TransactionClient,
  order: PaidOrderSnapshot,
): Promise<void> {
  await tx.shipping.upsert({
    where:  { orden_id: order.id },
    update: {},
    create: {
      orden_id:    order.id,
      costo_envio: order.costo_envio,
      estado:      'preparando',
    },
  });
}
