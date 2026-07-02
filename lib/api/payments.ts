import type { Payment, PaymentForm } from '@/types/payment';

export async function getPayments(): Promise<Payment[]> {
  const res = await fetch('/api/payments');
  if (!res.ok) throw new Error('Error al cargar pagos');
  return res.json();
}

export async function createPayment(
  data: Omit<PaymentForm, 'monto'> & { monto: number }
): Promise<Payment> {
  const res = await fetch('/api/payments', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Error al registrar pago');
  return res.json();
}

export async function markPaymentComplete(id: string): Promise<Payment> {
  const res = await fetch(`/api/payments/${id}/complete`, {
    method: 'PATCH',
  });
  if (!res.ok) throw new Error('Error al confirmar pago');
  return res.json();
}