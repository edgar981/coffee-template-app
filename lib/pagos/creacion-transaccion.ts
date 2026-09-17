import type { RespuestaCrudaTransaccion, TransaccionWompi } from './wompi-api';
import { esTransaccionWompi } from './wompi-api';

// ── LA CLASIFICACIÓN DE LA RESPUESTA DE CREAR LA TRANSACCIÓN — pura, sin red ────────────────
//
// (§ API-DIRECTA-CREACION-TRANSACCION-1). `crearTransaccionTarjeta` (`lib/pagos/wompi-api.ts`)
// hace la llamada y devuelve el STATUS + BODY crudos, sin decidir nada; esta función decide
// QUÉ PASÓ, para que el llamador (la ruta de checkout) le responda al comprador con la frase
// correcta en vez de un "error al pagar" genérico para tres causas distintas — una SIGUE (la
// transacción se creó), otra es CONFIGURACIÓN DEL DUEÑO (el método no está habilitado en su
// cuenta Wompi), y otra es un DEFECTO NUESTRO (la firma no sirvió, y la firma la calculamos
// nosotros con nuestro propio secreto).
//
// LAS FORMAS DE RESPUESTA VIENEN TRANSCRITAS DEL LIBRO (§ API-DIRECTA-SPIKES-ASIENTO-1,
// DECISIONS.md — medido contra el sandbox real; NO re-medido por este slice, que no tiene
// acceso a red):
//
//   - firma ausente        → 422 INPUT_VALIDATION_ERROR, {"signature":["Firma de integridad
//                             requerida no enviada"]}
//   - firma alterada       → 422 INPUT_VALIDATION_ERROR, {"signature":["La firma es inválida"]}
//   - correcta             → 201, estado PENDING
//   - método no habilitado → 404 NOT_FOUND_ERROR, `reason` nombra el tipo de método exacto
//   - sin credencial       → 401 INVALID_ACCESS_TOKEN (no debería ocurrir nunca: esta llamada
//                             siempre manda la llave privada — se clasifica igual, como OTRO
//                             FALLO, sin descartar el caso)
//
// EL SOBRE DE ERROR (`{"error": {"type", "reason"?, "messages"?}}`) NO ESTÁ TRANSCRITO
// COMPLETO EN EL LIBRO —cita el status, el `error.type`, y el texto del mensaje, no el JSON
// carácter a carácter—; se asume la forma pública que YA usa `services/checkout.service.ts`
// (`tokenizarTarjeta`, que lee `body.error.reason` y `body.error.messages` del MISMO
// proveedor). Es una LECTURA, no una medición — misma salvedad que el resto de este módulo
// ya declara para las formas de sobre que no vinieron transcritas byte a byte.

export interface CreacionCreada {
  tipo: 'creada';
  transaccion: TransaccionWompi;
}

export interface CreacionMetodoNoHabilitado {
  tipo: 'metodo_no_habilitado';
  motivo: string;
}

export interface CreacionFirmaInvalida {
  tipo: 'firma_invalida';
  motivo: string;
}

export interface CreacionOtroFallo {
  tipo: 'otro_fallo';
  status: number;
  motivo: string;
}

export type ResultadoCreacionTransaccion =
  | CreacionCreada
  | CreacionMetodoNoHabilitado
  | CreacionFirmaInvalida
  | CreacionOtroFallo;

function primerMensaje(x: unknown): string | null {
  return Array.isArray(x) && typeof x[0] === 'string' ? x[0] : null;
}

/**
 * Clasifica la respuesta CRUDA de `crearTransaccionTarjeta` — pura, sin red, sin `fetch`.
 * Distingue al menos las cuatro ramas que la ruta de checkout necesita: creada, método no
 * habilitado, firma inválida, y cualquier otro fallo (ver la cabecera del archivo).
 */
export function clasificarCreacionTransaccion(
  respuesta: RespuestaCrudaTransaccion,
): ResultadoCreacionTransaccion {
  const { status, body } = respuesta;
  const sobre = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};

  if (status === 201 || status === 200) {
    const data = (sobre as { data?: unknown }).data;
    if (esTransaccionWompi(data)) {
      return { tipo: 'creada', transaccion: data };
    }
    return {
      tipo:   'otro_fallo',
      status,
      motivo: 'Wompi respondió con éxito pero la transacción no trae la forma esperada.',
    };
  }

  const error = sobre.error && typeof sobre.error === 'object' ? (sobre.error as Record<string, unknown>) : null;
  const tipoError = typeof error?.type === 'string' ? error.type : null;

  if (status === 404 && tipoError === 'NOT_FOUND_ERROR') {
    const motivo = typeof error?.reason === 'string'
      ? error.reason
      : 'El método de pago no está habilitado para esta cuenta.';
    return { tipo: 'metodo_no_habilitado', motivo };
  }

  if (status === 422 && tipoError === 'INPUT_VALIDATION_ERROR') {
    const messages = error?.messages && typeof error.messages === 'object'
      ? (error.messages as Record<string, unknown>)
      : null;
    const motivoFirma = primerMensaje(messages?.signature);
    if (motivoFirma) {
      return { tipo: 'firma_invalida', motivo: motivoFirma };
    }
  }

  const motivoGenerico = typeof error?.reason === 'string'
    ? error.reason
    : `Wompi respondió ${status} al crear la transacción.`;
  return { tipo: 'otro_fallo', status, motivo: motivoGenerico };
}
