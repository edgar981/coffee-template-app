import type { Order, TrackedOrder, DeliveryContext, DeliveryAddressPayload, OrderAddressResult, AdminOrderPayload } from '@/types/order';

export async function getOrders(): Promise<Order[]> {
  const res = await fetch('/api/orders');
  if (!res.ok) throw new Error('Error al cargar órdenes');
  return res.json();
}

// Public order tracking: requires order number + customer email. Any failure
// (missing/mismatched email, unknown order) resolves to `null` ("not found")
// without revealing which field was wrong. POST keeps the email out of URLs
// and server access logs.
export async function trackOrder(
  numero: string,
  email: string,
): Promise<TrackedOrder | null> {
  const res = await fetch('/api/orders/track', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ numero, email }),
  });
  if (res.status === 429) throw new Error('Demasiadas solicitudes. Intenta de nuevo en un momento.');
  if (!res.ok) return null;
  return res.json();
}

// Admin manual order: real product lines (priced server-side), no typed total,
// always created `pendiente`. Surfaces the server's error message (e.g. "Cantidad
// no disponible", "Molienda no disponible…") so the modal can show it.
export async function createOrder(payload: AdminOrderPayload): Promise<Order> {
  const res = await fetch('/api/orders', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error ?? 'Error al crear orden');
  }
  return res.json();
}

// Single write path for ALL order mutations — status changes (dropdown) and
// full edits (modal) both go through here. The endpoint owns the Shipping
// auto-create hook (in a transaction) and returns the order WITH its shipping,
// so no caller re-implements the hook and every path stays consistent.
export async function updateOrder(id: string, data: Partial<Order>): Promise<Order> {
  const res = await fetch(`/api/orders/${id}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Error al actualizar orden');
  return res.json();
}

// Contact + address context for the "Programar entrega" modal (resolves the
// linked Customer and the effective phone server-side).
export async function getDeliveryContext(orderId: string): Promise<DeliveryContext> {
  const res = await fetch(`/api/orders/${orderId}/delivery-context`);
  if (!res.ok) throw new Error('Error al cargar los datos de la orden');
  return res.json();
}

// Agregar/actualizar la dirección de entrega en la ORDEN (validada como el
// checkout). Returns the persisted address fields.
export async function updateOrderAddress(
  orderId: string,
  data: DeliveryAddressPayload,
): Promise<OrderAddressResult> {
  const res = await fetch(`/api/orders/${orderId}/address`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error ?? 'Error al guardar la dirección');
  }
  return res.json();
}