import type { Payment } from '@/types/payment';
import { mockPayments } from '@/lib/mock/payments';

export async function getPayments(): Promise<Payment[]> {
  return new Promise(resolve => setTimeout(() => resolve(mockPayments), 400));
}

export async function createPayment(data: Omit<Payment, 'id' | 'createdAt'>): Promise<Payment> {
  return new Promise(resolve =>
    setTimeout(() => resolve({
      ...data,
      id:        crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }), 300)
  );
}

export async function markPaymentComplete(id: string): Promise<Payment> {
  const payment = mockPayments.find(p => p.id === id);
  if (!payment) throw new Error(`Payment ${id} not found`);
  return new Promise(resolve =>
    setTimeout(() => resolve({
      ...payment,
      estado:     'completado',
      fecha_pago: new Date().toISOString().split('T')[0],
    }), 300)
  );
}