import type { RespuestaCrudaTransaccion, TransaccionWompi } from './wompi-api';
import { esTransaccionWompi } from './wompi-api';
import type { DescriptorMetodoPasarela } from './metodos-pasarela';

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
//
// `CreacionMetodoNoHabilitado.motivo` ES LA FUENTE ÚNICA QUE NOMBRA EL MÉTODO EXACTO —para las
// DOS audiencias, no sólo una (§ API-DIRECTA-DESALINEO-AVISO-1). El DUEÑO se entera por el aviso
// de configuración del Dashboard (`lib/config/avisos-configuracion.ts`, #9 — recibe este `motivo`
// COMO STRING, sin parafrasearlo); el COMPRADOR se entera —cuando ese camino se cablee— por el
// mismo `motivo`, mostrado como "ese método no está disponible ahora mismo". Que la GENERALIDAD
// del predictor (accepted_payment_methods → 404 para CUALQUIER tipo que la cuenta no tenga, no
// sólo para el que se probó primero) valga para el catálogo entero del proveedor, contra UNA
// cuenta, está MEDIDO en `API-DIRECTA-SPIKE-PREDICTOR-1` (DECISIONS.md, bloque
// `[PREDICTOR-MEDIDO]`) — no re-medido por este módulo.
//
// NI ESTE ARCHIVO NI EL AVISO PERSISTEN NADA: los dos son PUROS. La cadena que lleva un `motivo`
// de una creación fallida (acá) hasta el Dashboard (`avisosDeConfiguracion`) o hasta la pantalla
// del comprador exige que ALGÚN llamador —`app/api/checkout/route.ts` al fallar, guardando el
// dato; `lib/config/site-settings-read.ts` exponiéndolo— la cablee. Ninguno de los dos vive en
// `touches:` de `API-DIRECTA-DESALINEO-AVISO-1`; queda como `open_followup` de ese slice, no como
// capacidad terminada.

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

// ── LA CREACIÓN, GENERALIZADA A CUALQUIER DESCRIPTOR (§ API-DIRECTA-OTROS-METODOS-1) ────────
//
// Lo que la firma de integridad YA FIJA (`reference`, `amountInCents`, `currency`,
// `signature`) más las DOS aceptaciones del comprador — igual que `DatosCreacionTransaccion`
// (`lib/pagos/wompi-api.ts`), pero SIN el campo `tokenTarjeta`: eso es sólo de tarjeta, y este
// constructor sirve a CUALQUIER descriptor de `lib/pagos/metodos-pasarela.ts`.
export interface DatosComunesCreacionTransaccion {
  reference: string;
  amountInCents: number;
  currency: string;
  signature: string;
  acceptanceToken: string;
  acceptPersonalAuthToken: string;
}

/**
 * Arma el cuerpo COMPLETO para crear una transacción de un método QUE NO ES TARJETA — puro,
 * sin red. El `payment_method` sale de `descriptor.construirPaymentMethod(dato)`
 * (`lib/pagos/metodos-pasarela.ts`), nunca de un `if` por tipo acá: agregar el tipo siguiente
 * es agregar un descriptor, no tocar esta función (§ el reporte del slice, "la propiedad que
 * tiene que quedar").
 *
 * Los nombres de campo (`acceptance_token`, `accept_personal_auth`, `payment_method`) son los
 * MISMOS que ya usa `crearTransaccionTarjeta` (`lib/pagos/wompi-api.ts`) para tarjeta — misma
 * convención pública del proveedor, LEÍDA, no medida contra el sandbox por este slice (§ la
 * cabecera de este archivo, arriba).
 *
 * ESTA FUNCIÓN NO ENVÍA NADA: quien la llama decide qué hacer con el objeto que devuelve. Hoy
 * ningún llamador la manda de verdad a Wompi — `crearTransaccionTarjeta` sigue siendo la única
 * función que abre una conexión de red hacia `/v1/transactions`, y está fijada a
 * `payment_method: {type: 'CARD', ...}` (`lib/pagos/wompi-api.ts`, fuera de `touches` de este
 * slice). Generalizarla para que acepte el `payment_method` que esta función arma es el
 * trabajo que falta — ver el reporte del slice.
 */
export function construirDatosCreacionTransaccion(
  comunes: DatosComunesCreacionTransaccion,
  descriptor: DescriptorMetodoPasarela,
  dato: string,
): Record<string, unknown> {
  return {
    acceptance_token:     comunes.acceptanceToken,
    accept_personal_auth: comunes.acceptPersonalAuthToken,
    amount_in_cents:      comunes.amountInCents,
    currency:             comunes.currency,
    signature:            comunes.signature,
    reference:            comunes.reference,
    payment_method:       descriptor.construirPaymentMethod(dato),
  };
}
