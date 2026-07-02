import type { Shipping } from '@/types/shipping';

export async function getShippings(): Promise<Shipping[]> {
  const res = await fetch('/api/shippings');
  if (!res.ok) throw new Error('Error al cargar entregas');
  return res.json();
}

export async function createShipping(
  data: Omit<Shipping, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Shipping> {
  const res = await fetch('/api/shippings', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Error al crear entrega');
  return res.json();
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
  if (!res.ok) throw new Error('Error al actualizar entrega');
  return res.json();
}