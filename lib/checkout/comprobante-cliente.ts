import type { MetodoPagoTipo } from './metodos-pago';

// ─── La "prueba" de que el cliente creó esta orden ───────────────────────────
//
// `POST /api/orders/[id]/comprobante-cliente` es público y SIN sesión: "nunca basta
// el id de la orden" (numero_orden es un string corto, enumerable — 6 dígitos, como
// ya documenta `app/api/orders/track/route.ts`). Hacía falta algo MÁS que el id, y
// se evaluaron dos caminos:
//
//   a) un token firmado (HMAC) con vencimiento corto, emitido por el endpoint que
//      CREA la orden (`app/api/checkout/route.ts`) y devuelto en su respuesta;
//   b) el MISMO mecanismo que ya usa `/api/orders/track` para identificar al dueño
//      de una orden sin sesión: numero_orden + el correo que el cliente escribió.
//
// SE ELIGIÓ (b), y por una razón que no es de gusto: **`app/api/checkout/route.ts`
// NO está en el `touches:` de este slice** (Tier 1, requiere su propia aprobación) —
// medido antes de escribir una sola línea, siguiendo `services/checkout.service.ts`
// (`createOrder` llama a `POST /api/checkout`, nunca a `/api/orders`) y confirmando
// que `CheckoutResult` no trae ni el `id` interno ni ningún campo nuevo que un token
// pudiera viajar en. Emitir un token ahí habría significado escribir en un archivo
// para el que esta aprobación no alcanza. El camino (b) no toca ESE archivo en
// absoluto: el cliente ya tiene su propio correo (lo escribió en el paso 1 del
// checkout), así que no hace falta que el servidor le entregue nada nuevo.
//
// La seguridad es la MISMA que ya aceptó `/api/orders/track`: el correo no es un
// secreto fuerte, pero un atacante que sólo tiene el `numero_orden` (filtrado o
// adivinado) no conoce el correo del comprador, y la ruta además rate-limita por IP
// y responde GENÉRICO ante un correo que no coincide — sin distinguir "la orden no
// existe" de "el correo está mal", la misma regla de "no enumeration oracle" que ya
// documenta `track/route.ts`.

/**
 * Los métodos del checkout que ACEPTAN comprobante de cliente — el MISMO subconjunto
 * que ya decidía qué mostrar el campo "Referencia de pago" (hoy reemplazado por este
 * campo): instrumentos que dejan evidencia (transferencia/pago móvil), nunca
 * `efectivo` (no hay nada que fotografiar) ni la pasarela (el cobro se confirma solo,
 * sin que nadie mire una foto — § Decisión de pasarela, CLAUDE.md).
 */
export const METODOS_CON_COMPROBANTE_CLIENTE: readonly MetodoPagoTipo[] = [
  'nequi', 'daviplata', 'breb', 'transferencia',
];

/** `null`/`'wompi'`/`'efectivo'` → `false`, sin excepción. */
export function aceptaComprobanteCliente(metodoPago: string | null): boolean {
  return metodoPago !== null && (METODOS_CON_COMPROBANTE_CLIENTE as readonly string[]).includes(metodoPago);
}

/**
 * Tope de comprobantes que el CLIENTE puede adjuntar por orden, sin sesión. No es el
 * tope que algún día tenga un operador (ilimitado) — es el freno de un endpoint
 * público: alcanza para que un comprador se equivoque de foto y la corrija dos veces,
 * y no alcanza para convertir la ruta en un vertedero de archivos sobre una sola
 * orden. `TODO(cliente)`: el número es un placeholder razonable, no una cifra medida.
 */
export const TOPE_COMPROBANTES_CLIENTE = 3;

/** Lo mínimo de la orden que la admisión necesita — ya leído de la base. */
export interface OrdenParaComprobanteCliente {
  estado: string;
  metodo_pago: string | null;
  cliente_email: string | null;
}

/**
 * ¿El correo que mandó el cliente es el mismo que quedó en la orden? Normaliza
 * espacios y mayúsculas, la MISMA comparación que `/api/orders/track/route.ts` ya
 * usa para esto — no una segunda regla de qué cuenta como "el mismo correo". Una
 * orden sin `cliente_email` (no debería ocurrir en el checkout, que siempre lo
 * pide) nunca coincide: `null` no es "cualquier correo sirve".
 */
export function coincideEmail(dado: string, guardado: string | null): boolean {
  if (!guardado) return false;
  return dado.trim().toLowerCase() === guardado.trim().toLowerCase();
}

export type MotivoRechazoComprobanteCliente =
  | 'email_no_coincide'
  | 'no_pendiente'
  | 'metodo_no_admite'
  | 'tope_alcanzado';

export type VeredictoAdmision =
  | { ok: true }
  | { ok: false; motivo: MotivoRechazoComprobanteCliente };

/**
 * La regla de admisión completa, en el ORDEN en que se evalúa — y el orden es la
 * decisión: la prueba de identidad (el correo) se verifica ANTES de decir nada sobre
 * el estado de la orden. Si el correo no coincide, el llamador (la ruta) responde
 * EXACTAMENTE lo mismo que si la orden no existiera — este motivo nunca debe
 * traducirse a un mensaje distinto de "no encontrada" (ver el docstring de arriba).
 *
 * Las otras tres razones SÍ pueden mostrarse al cliente tal cual: para llegar ahí ya
 * probó que es el dueño de la orden.
 */
export function admiteComprobanteCliente(
  orden: OrdenParaComprobanteCliente,
  emailDado: string,
  comprobantesExistentes: number,
): VeredictoAdmision {
  if (!coincideEmail(emailDado, orden.cliente_email)) return { ok: false, motivo: 'email_no_coincide' };
  if (orden.estado !== 'pendiente') return { ok: false, motivo: 'no_pendiente' };
  if (!aceptaComprobanteCliente(orden.metodo_pago)) return { ok: false, motivo: 'metodo_no_admite' };
  if (comprobantesExistentes >= TOPE_COMPROBANTES_CLIENTE) return { ok: false, motivo: 'tope_alcanzado' };
  return { ok: true };
}

/**
 * La frase para el motivo de rechazo — SÓLO para los tres que el cliente puede ver
 * (nunca `email_no_coincide`, que la ruta trata como "no encontrada"). Vive acá para
 * que la ruta y el test no repitan el mismo texto por su cuenta.
 */
export function mensajeRechazoComprobanteCliente(
  motivo: Exclude<MotivoRechazoComprobanteCliente, 'email_no_coincide'>,
): string {
  switch (motivo) {
    case 'no_pendiente':
      return 'Esta orden ya no admite comprobantes.';
    case 'metodo_no_admite':
      return 'Este pedido no necesita comprobante de pago.';
    case 'tope_alcanzado':
      return 'Ya adjuntaste el máximo de comprobantes para este pedido.';
  }
}
