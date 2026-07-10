import type { Order, OrderStatus, TrackedOrder } from '@/types/order';

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

export async function createOrder(
  data: Omit<Order, 'id' | 'numero_orden' | 'createdAt' | 'updatedAt'>
): Promise<Order> {
  const res = await fetch('/api/orders', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Error al crear orden');
  return res.json();
}

export async function updateOrderStatus(id: string, estado: OrderStatus): Promise<Order> {
  const res = await fetch(`/api/orders/${id}/status`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ estado }),
  });
  if (!res.ok) throw new Error('Error al actualizar estado');
  return res.json();
}

export async function updateOrder(id: string, data: Partial<Order>): Promise<Order> {
  const res = await fetch(`/api/orders/${id}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Error al actualizar orden');
  return res.json();
}