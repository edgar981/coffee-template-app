import type { Customer, CustomerForm, CustomerWithOrders } from '@/types/customer';

export async function getCustomers(): Promise<Customer[]> {
  const res = await fetch('/api/customers');
  if (!res.ok) throw new Error('Error al cargar clientes');
  return res.json();
}

/** The existing customer an order upsert WOULD match by phone/email, or null. */
export interface CustomerMatch {
  id:      string;
  nombre:  string;
  ordenes: number;
}

// Proactive duplicate check for the New Order modal. Returns the matching
// customer (server normalizes the phone) or null. Never throws on "no match".
export async function lookupCustomer(
  params: { telefono?: string; email?: string },
): Promise<CustomerMatch | null> {
  const qs = new URLSearchParams();
  if (params.telefono) qs.set('telefono', params.telefono);
  if (params.email)    qs.set('email', params.email);
  if (![...qs.keys()].length) return null;

  const res = await fetch(`/api/customers/lookup?${qs.toString()}`);
  if (!res.ok) return null; // a lookup failure must never block order creation
  const data = await res.json();
  return data?.customer ?? null;
}

// Single customer + order history for the profile page.
export async function getCustomer(id: string): Promise<CustomerWithOrders> {
  const res = await fetch(`/api/customers/${id}`);
  if (!res.ok) throw new Error('Error al cargar el cliente');
  return res.json();
}

export async function createCustomer(data: CustomerForm): Promise<Customer> {
  const res = await fetch('/api/customers', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Error al crear cliente');
  return res.json();
}

export async function updateCustomer(id: string, data: Partial<CustomerForm>): Promise<Customer> {
  const res = await fetch(`/api/customers/${id}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Error al actualizar cliente');
  return res.json();
}

export async function deleteCustomer(id: string): Promise<void> {
  const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Error al eliminar cliente');
}