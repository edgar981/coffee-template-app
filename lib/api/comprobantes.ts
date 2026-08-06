import { razonDelServidor } from '@/lib/api/errors';
import type { Comprobante } from '@/types/comprobante';

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
 * El veredicto. `verificar` sólo SELLA — cuando la orden todavía no tiene plata,
 * el pago se registra ANTES por su propio endpoint (ver `accionAlVerificar`).
 */
export async function decidirComprobante(
  id: string,
  accion: 'verificar' | 'rechazar',
  notas?: string,
): Promise<Comprobante> {
  const res = await fetch(`/api/comprobantes/${id}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ accion, notas }),
  });
  if (!res.ok) throw await razonDelServidor(res, 'No se pudo actualizar el comprobante');
  return res.json();
}
