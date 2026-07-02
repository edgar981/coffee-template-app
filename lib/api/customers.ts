import type { Customer, CustomerForm } from '@/types/customer';

export async function getCustomers(): Promise<Customer[]> {
  const res = await fetch('/api/customers');
  if (!res.ok) throw new Error('Error al cargar clientes');
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