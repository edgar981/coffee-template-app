import type { Shipping, ScheduleDeliveryInput } from '@/types/shipping';

export async function getShippings(): Promise<Shipping[]> {
  const res = await fetch('/api/shippings');
  if (!res.ok) throw new Error('Error al cargar entregas');
  return res.json();
}

// "Programar entrega" — edit the already auto-created Shipping (courier, zona,
// date, notes). There is no create path: the Shipping exists once the order is
// paid. The operator supplies only these fields.
export async function scheduleDelivery(
  id: string,
  data: ScheduleDeliveryInput
): Promise<Shipping> {
  return updateShipping(id, data);
}

export async function updateShipping(
  id: string,
  data: Partial<Shipping>
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