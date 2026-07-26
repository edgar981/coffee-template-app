import type { Shipping, ScheduleDeliveryInput } from '@/types/shipping';

export async function getShippings(): Promise<Shipping[]> {
  const res = await fetch('/api/shippings');
  // Surface the HTTP status so the next regression is diagnosable from the client
  // (e.g. a 500 from a Prisma error vs a 401/403 auth failure).
  if (!res.ok) throw new Error(`Error al cargar entregas (${res.status})`);
  return res.json();
}

// Ensure a schedulable Shipping exists for an order (server enforces the ORDER's
// condicion_pago: rejects cancelled always, and unpaid ANTICIPADO orders).
// Idempotent — returns the existing Shipping when there is one. Used by
// "Preparar envío" on a pending CONTRAENTREGA order: create here, then edit via
// scheduleDelivery. Surfaces the server's message on rejection.
export async function ensureOrderShipping(ordenId: string): Promise<Shipping> {
  const res = await fetch('/api/shippings', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ orden_id: ordenId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error ?? 'No se pudo preparar la entrega');
  }
  return res.json();
}

// "Programar entrega" — edit the Shipping (courier, zona, date, notes). The
// Shipping is created either by confirming the payment or, under ALLOW_UNPAID,
// by ensureOrderShipping above. The operator supplies only these fields.
export async function scheduleDelivery(
  id: string,
  data: ScheduleDeliveryInput
): Promise<Shipping> {
  return updateShipping(id, data);
}

export async function updateShipping(
  id: string,
  // `confirmarSinPago` is not a Shipping field — it's the operator's explicit
  // acknowledgement to dispatch an order with no registered payment (the server
  // then flips it to CONTRAENTREGA). Only meaningful on the en_ruta transition.
  data: Partial<Shipping> & { confirmarSinPago?: boolean }
): Promise<Shipping> {
  const res = await fetch(`/api/shippings/${id}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error ?? 'Error al actualizar entrega');
  }
  return res.json();
}