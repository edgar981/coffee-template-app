import type { Customer, CustomerForm, CustomerWithOrders } from '@/types/customer';

export async function getCustomers(): Promise<Customer[]> {
  const res = await fetch('/api/customers');
  if (!res.ok) throw new Error('Error al cargar clientes');
  return res.json();
}

/** An existing customer an order would match by phone/email. */
export interface CustomerMatch {
  id:       string;
  nombre:   string;
  ordenes:  number;
  telefono: string | null;
  email?:   string | null;
}

// Proactive duplicate check for the New Order modal. Returns ALL matching
// customers (server normalizes the phone; capped + ordered most-orders-first) —
// a phone can be shared by several people. Never throws on "no match".
export async function lookupCustomers(
  params: { telefono?: string; email?: string },
): Promise<CustomerMatch[]> {
  const qs = new URLSearchParams();
  if (params.telefono) qs.set('telefono', params.telefono);
  if (params.email)    qs.set('email', params.email);
  if (![...qs.keys()].length) return [];

  const res = await fetch(`/api/customers/lookup?${qs.toString()}`);
  if (!res.ok) return []; // a lookup failure must never block order creation
  const data = await res.json();
  return Array.isArray(data?.customers) ? data.customers : [];
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
  if (!res.ok) {
    // Surface the server's reason (e.g. the 409 "tiene N órdenes") so the confirm
    // dialog can show it verbatim.
    const msg = await res.json().then((d) => d?.error).catch(() => null);
    throw new Error(msg || 'Error al eliminar cliente');
  }
}