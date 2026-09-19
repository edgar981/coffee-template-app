import type { AceptacionesWompi } from '@/types/payment';

/**
 * El bloque `wompi` de un reintento EXITOSO — misma forma que `CheckoutResultWompi`
 * (`services/checkout.service.ts`, no tocado por este slice) más `metodosPasarelaOtros`,
 * que el servidor ya incluye (§ `armarBloqueWompiPago`, `app/api/checkout/route.ts`) aunque
 * ese tipo del lado cliente todavía no lo declare.
 */
export interface BloqueWompiReintento {
  reference: string;
  amountInCents: number;
  currency: string;
  signature: string;
  publicKey: string;
  aceptaciones: AceptacionesWompi;
  metodosPasarelaOtros: string[];
}

export type ResultadoReintentoOtroMetodo =
  | { tipo: 'creado'; wompi: BloqueWompiReintento }
  | { tipo: 'ya_pagada' }
  | { tipo: 'tope_alcanzado'; mensaje: string }
  | { tipo: 'error'; mensaje: string };

/**
 * La clasificación PURA de la respuesta de `POST /api/checkout/reintento`
 * (§ CHECKOUT-REINTENTO-OTRO-METODO-1) — mismo criterio que
 * `interpretarRespuestaOtroMetodo` (archivo hermano): se extrae para poder
 * afirmarla con un test, sin red ni servidor.
 *
 * `no_pendiente` con `estado: 'pagado'` se traduce a `'ya_pagada'` — otra
 * pestaña pagó la orden entre el rechazo y el clic en "Intentar con otro
 * método" (§ el docstring del servidor: "verificá que la orden siga sin
 * pagar antes de emitir un intento nuevo"). Cualquier OTRO `no_pendiente`
 * (p. ej. `cancelado`) cae al `'error'` genérico — no hay pantalla propia
 * para ese caso, fuera de alcance de este slice.
 *
 * NINGÚN CAMPO DE ACEPTACIÓN VIAJA EN LA ENTRADA DE ESTA FUNCIÓN: el único
 * dato que produce un `'creado'` es el `wompi` que el SERVIDOR mandó en esta
 * MISMA respuesta — no hay parámetro por el que una aceptación de un intento
 * anterior pudiera colarse acá.
 */
export function interpretarRespuestaReintento(
  body: unknown,
  mensajePorDefecto: string,
): ResultadoReintentoOtroMetodo {
  const resultado = body as
    | { tipo?: unknown; wompi?: unknown; estado?: unknown; error?: unknown }
    | null;

  if (resultado?.tipo === 'creado' && resultado.wompi && typeof resultado.wompi === 'object') {
    return { tipo: 'creado', wompi: resultado.wompi as BloqueWompiReintento };
  }

  const mensaje = resultado && typeof resultado.error === 'string' ? resultado.error : mensajePorDefecto;

  if (resultado?.tipo === 'no_pendiente' && resultado.estado === 'pagado') {
    return { tipo: 'ya_pagada' };
  }
  if (resultado?.tipo === 'tope_alcanzado') {
    return { tipo: 'tope_alcanzado', mensaje };
  }
  return { tipo: 'error', mensaje };
}
