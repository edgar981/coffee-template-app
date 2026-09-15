import type { MetodoPagoTipo } from '@/lib/checkout/metodos-pago';

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
  payment:
    | {
        // § CHECKOUT-BREB-CAST-1: importa el mismo tipo que el checkout usa para elegir el método
        // (`lib/checkout/metodos-pago.ts`), en vez de repetir sus cinco literales a mano — dos
        // declaraciones del mismo conjunto es la falla que ya se pagó con `CATEGORIAS`/
        // `CATEGORIA_LABELS` y con el schema editable de `presentaciones`.
        metodo: MetodoPagoTipo;
        referencia?: string;
      }
    | {
        // El camino APARTE de la pasarela (§ WOMPI-WIDGET-EN-EL-CANONICO-1) — NUNCA un valor
        // más de `metodo`/`METODOS_PAGO_ORDEN` (ese set cerrado es "lo que el dueño configura
        // en su panel"; la pasarela es un toggle de DESPLIEGUE, (d), que todavía no existe —
        // ver `pasarelaDisponibleEnEsteDespliegue` más abajo).
        pasarela: true;
      };
  items: {
    slug: string;
    cantidad: number;
    /** Molienda elegida (debe ser una opción `disponible` del producto) */
    molienda?: string | null;
  }[];
}

/**
 * (d) EL TOGGLE POR DESPLIEGUE TODAVÍA NO EXISTE (ver CLAUDE.md § Pagos en línea, Wompi).
 * Es el disparador MÁS CHICO y honesto que este slice puede dejar — la CAPACIDAD de pagar
 * con la pasarela nace APAGADA, siempre `false`, hoy. Es la MISMA fuente que lee el cliente
 * (para esconder la opción "Tarjeta, PSE y más" del checkout) y el servidor
 * (`app/api/checkout/route.ts`, para rechazar un POST directo que la pida sin que exista
 * (d)) — dos lecturas de esta función nunca pueden divergir porque es una sola.
 *
 * Cuando (d) exista, esta función se REEMPLAZA por su lectura real (env var / dato de
 * despliegue) — no se borra a mano ni se copia en otro lado.
 */
export function pasarelaDisponibleEnEsteDespliegue(): boolean {
  return false;
}

export interface CheckoutResultItem {
  producto_nombre: string;
  moliendaSeleccionada?: string | null;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

/**
 * La transacción de la pasarela, YA FIRMADA por el servidor (`app/api/checkout/route.ts`,
 * `firmarIntegridadWompi` — nunca firmada en el cliente). Presente SÓLO cuando el comprador
 * eligió pagar con la pasarela; ausente en cualquier otro método, byte-idéntico a antes de
 * este slice (§ WOMPI-WIDGET-EN-EL-CANONICO-1).
 */
export interface CheckoutResultWompi {
  reference: string;
  amountInCents: number;
  currency: string;
  signature: string;
  /** La llave PÚBLICA de la pasarela — del navegador, no es secreta (§ lib/pagos/llaves-pasarela.ts). */
  publicKey: string;
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
  wompi?: CheckoutResultWompi;
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
