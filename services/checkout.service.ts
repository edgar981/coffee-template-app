export interface CheckoutPayload {
  customer: {
    nombre: string;
    apellido: string;
    email: string;
    telefono: string;
  };
  shipping: {
    direccion: string;
    ciudad: string;
    metodo: 'standard' | 'express';
  };
  payment: {
    metodo: 'nequi' | 'daviplata' | 'transferencia' | 'efectivo';
    referencia?: string;
  };
  items: {
    slug: string;
    cantidad: number;
  }[];
}

export interface CheckoutResultItem {
  producto_nombre: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface CheckoutResult {
  numero_orden: string;
  estado: string;
  subtotal: number;
  costo_envio: number;
  total: number;
  items: CheckoutResultItem[];
}

// Thin client wrapper over the unauthenticated guest-checkout route handler,
// which owns all DB access (Prisma) and server-side price recomputation.
export async function createOrder(
  payload: CheckoutPayload
): Promise<CheckoutResult> {
  const res = await fetch('/api/checkout', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? 'Error al procesar la orden');
  }

  return res.json();
}
