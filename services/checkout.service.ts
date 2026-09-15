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
        // en su panel"; la pasarela es un toggle de DESPLIEGUE, (d) — ver
        // `pasarelaDisponibleEnEsteDespliegue` más abajo).
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
 * (d), MITAD ENCENDIDO (§ WOMPI-TOGGLE-DISPONIBILIDAD-1): la CAPACIDAD de pagar con la
 * pasarela es un interruptor de DESPLIEGUE, no un dato de negocio — por eso vive en una env
 * var y no en `SiteSetting`. Un despliegue que NO declara la variable (Nayoli incluida) ve
 * exactamente lo mismo que antes de este slice: la opción no aparece, y un POST directo que
 * la pida se rechaza.
 *
 * `PASARELA`, no `WOMPI`: nombra la CAPACIDAD, no el proveedor — si el agregador cambiara
 * algún día, la variable no quedaría mintiendo (las llaves sí llevan `WOMPI_`, porque ésas
 * son de Wompi). `NEXT_PUBLIC_` porque esta función se lee en el CLIENTE (`checkout/page.tsx`,
 * para mostrar u ocultar "Tarjeta, PSE y más") y en el SERVIDOR (`app/api/checkout/route.ts`,
 * para crear o rechazar el intento) — es la MISMA fuente en los dos lados, así que no pueden
 * divergir sobre si la pasarela está disponible.
 *
 * Es SÓLO el encendido. La redirección tras el pago (la ruta de vuelta del comprador) es (c)
 * y sigue sin construirse — esta función no la habilita.
 */
export function pasarelaDisponibleEnEsteDespliegue(): boolean {
  return process.env.NEXT_PUBLIC_PASARELA_HABILITADA === '1';
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
