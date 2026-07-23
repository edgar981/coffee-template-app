import type { Payment, RegisterPaymentInput } from '@/types/payment';
import type { Order } from '@/types/order';

// Read-only ledger of registered payments (each tied to an order).
export async function getPayments(): Promise<Payment[]> {
  const res = await fetch('/api/payments');
  if (!res.ok) throw new Error('Error al cargar pagos');
  return res.json();
}

// Registrar pago DE una orden: creates the Payment and moves the order to
// `pagado` (+ auto-Shipping) server-side, in one transaction. Returns both so
// the caller can refresh the order row and the ledger.
export async function registerOrderPayment(
  orderId: string,
  data: RegisterPaymentInput,
): Promise<{ payment: Payment; order: Order }> {
  const res = await fetch(`/api/orders/${orderId}/payments`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error ?? 'Error al registrar el pago');
  }
  return res.json();
}
