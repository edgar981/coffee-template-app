import { razonDelServidor } from '@/lib/api/errors';
import type { Comprobante } from '@/types/comprobante';
import type { MetodoPago } from '@/types/payment';

// Cliente de los comprobantes. Los límites y formatos se validan en el server
// con la MISMA función pura que usa el formulario (`lib/comprobante.ts`); acá
// sólo se transporta.

/** Adjunta un soporte a la orden. NO registra un pago ni mueve la orden. */
export async function subirComprobante(ordenId: string, file: File): Promise<Comprobante> {
  const body = new FormData();
  body.append('file', file);

  const res = await fetch(`/api/orders/${ordenId}/comprobantes`, { method: 'POST', body });
  if (!res.ok) throw await razonDelServidor(res, 'No se pudo subir el comprobante');
  return res.json();
}

/**
 * Lo que el pago necesita cuando VERIFICAR una orden pendiente lo crea (§ Decisión).
 * `monto` no viaja: lo pone el server desde `order.total`. `fecha` es CLAVE DE DÍA
 * (`YYYY-MM-DD`) — el server la ancla a Bogotá. Vacío en el flujo `sellar` (orden
 * ya pagada) y en rechazar.
 */
export interface PagoDelVeredicto {
  metodo?:     MetodoPago;
  fecha?:      string;
  referencia?: string | null;
}

/**
 * El veredicto. Sobre una orden PENDIENTE, `verificar` CREA el pago (§ Decisión —
 * Cuándo un pedido está pagado), por eso lleva `pago`; sobre una ya pagada sólo
 * SELLA, y ahí `pago` sobra. Rechazar nunca lo usa.
 */
export async function decidirComprobante(
  id: string,
  accion: 'verificar' | 'rechazar',
  opts: { notas?: string } & PagoDelVeredicto = {},
): Promise<Comprobante> {
  const res = await fetch(`/api/comprobantes/${id}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      accion,
      notas:      opts.notas,
      metodo:     opts.metodo,
      fecha:      opts.fecha,
      referencia: opts.referencia,
    }),
  });
  if (!res.ok) throw await razonDelServidor(res, 'No se pudo actualizar el comprobante');
  return res.json();
}

/**
 * Los comprobantes de la orden, tal como están EN EL SERVIDOR.
 *
 * Existe porque el detalle no puede depender de haber sobrevivido a la mutación
 * que lo cambió: si el diálogo se remonta —una recarga de Fast Refresh, una
 * navegación, cualquier cosa— el estado optimista que quedó a medias se pierde,
 * y sin esto la pantalla se queda mostrando un vacío que la base contradice.
 * Al abrir, la verdad la trae el servidor.
 */
export async function getComprobantes(ordenId: string): Promise<Comprobante[]> {
  const res = await fetch(`/api/orders/${ordenId}/comprobantes`);
  if (!res.ok) throw await razonDelServidor(res, 'No se pudieron cargar los comprobantes');
  return res.json();
}
