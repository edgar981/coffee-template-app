export interface CheckoutPayload {
  customer: {
    nombre: string;
    apellido: string;
    email: string;
    telefono: string;
  };
  shipping: {
    direccion: string;
    direccion_detalle?: string | null;   // "Apto, torre, interior…" optional
    ciudad: string;
    departamento: string;                // drives Bogotá detection server-side
    franja?: string | null;              // slot id ("am"/"pm"); Bogotá only
  };
  payment: {
    metodo: 'nequi' | 'daviplata' | 'transferencia' | 'efectivo';
    referencia?: string;
  };
  items: {
    slug: string;
    cantidad: number;
    /** Molienda elegida (debe ser una opción `disponible` del producto) */
    molienda?: string | null;
  }[];
}

export interface CheckoutResultItem {
  producto_nombre: string;
  moliendaSeleccionada?: string | null;
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
  metodo_envio?: string;      // shipping method id, resolved to a label at render
  franja?: string | null;     // slot id ("am"/"pm"), resolved to a label at render
  direccion_detalle?: string | null;
  items: CheckoutResultItem[];
}

// Error de checkout que conserva los IDs de producto rechazados por stock, para
// que la UI marque las líneas afectadas sin perder el resto del carrito.
export class CheckoutError extends Error {
  productosSinStock?: string[];
  constructor(message: string, productosSinStock?: string[]) {
    super(message);
    this.name = 'CheckoutError';
    this.productosSinStock = productosSinStock;
  }
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
    throw new CheckoutError(
      data?.error ?? 'Error al procesar la orden',
      Array.isArray(data?.productosSinStock) ? data.productosSinStock : undefined,
    );
  }

  return res.json();
}
