import type { Customer } from '@/types/customer';
import { MOCK_CUSTOMERS } from '@/lib/mock/customers';

export async function getCustomers(): Promise<Customer[]> {
  return new Promise(resolve => setTimeout(() => resolve(MOCK_CUSTOMERS), 400));
}

export async function createCustomer(data: Omit<Customer, 'id' | 'createdAt'>): Promise<Customer> {
  return new Promise(resolve =>
    setTimeout(() => resolve({
      ...data,
      id:        crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }), 300)
  );
}

export async function updateCustomer(id: string, data: Partial<Customer>): Promise<Customer> {
  const customer = MOCK_CUSTOMERS.find(c => c.id === id);
  if (!customer) throw new Error(`Customer ${id} not found`);
  return new Promise(resolve =>
    setTimeout(() => resolve({ ...customer, ...data }), 300)
  );
}

export async function deleteCustomer(id: string): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 300));
}