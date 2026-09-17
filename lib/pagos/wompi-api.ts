// ── EL CLIENTE HTTP DE WOMPI — SERVER-ONLY ───────────────────────────────────
//
// Primer consumidor de `WOMPI_PRIVATE_KEY` (WOMPI-RECONCILIADOR-HI-1): SÓLO
// esa llave autoriza `GET /v1/transactions?reference=` — con la pública, `401
// INVALID_ACCESS_TOKEN` (medido contra el sandbox real, WOMPI-REGLAS-
// IMPLEMENTACION-1, DECISIONS.md). Por eso este módulo corre SÓLO en el
// servidor, y por eso el reconciliador (`packages/core/src/pagos/
// reconciliador.ts`) NUNCA lo importa directo: `packages/core` no importa de
// `lib/` (medido antes de este slice — cero imports runtime de `@/lib` en
// todo `packages/core/src`). Este cliente se recibe INYECTADO desde quien
// invoca al reconciliador (el cron route).
//
// NUNCA LEE `process.env`: el mismo principio que `lib/pagos/wompi-firma.ts`
// — la llave y el host entran como PARÁMETRO, y es el LLAMADOR quien decide
// de dónde salen. No se transcribe ningún valor de llave acá ni en ningún
// otro lugar de este módulo.
//
// SE CONSULTA POR REFERENCIA, NUNCA POR ID: medido (WOMPI-REGLAS-
// IMPLEMENTACION-1) que `GET /v1/transactions/<id>` 404ea con un id
// inexistente, mientras que `?reference=` responde `200 {"data":[]}` — la
// única vía que sirve para "¿existe una transacción para esta referencia?".
//
// LA REGLA DEL ARRAY VACÍO la interpreta el RECONCILIADOR, no este cliente:
// acá sólo se devuelve el array tal cual llega, filtrado a la forma mínima
// que hace falta leer.

import type { AceptacionCruda, AceptacionesCrudas } from './aceptaciones';

export interface TransaccionWompi {
  id: string;
  status: string;
  amount_in_cents: number;
  /** Presente SÓLO para tarjeta con 3DS pedido (§ API-DIRECTA-3DS-SIN-CHALLENGE-1) — el
   *  sub-objeto que `clasificarAutenticacion3ds` (`lib/pagos/tres-ds.ts`) lee para distinguir
   *  el camino SIN FRICCIÓN del de DESAFÍO. Opcional: `esTransaccionWompi` no lo exige, así que
   *  su ausencia no invalida una transacción que no pidió 3DS. NO MEDIDO CONTRA EL SANDBOX —
   *  ver la cabecera de `lib/pagos/tres-ds.ts`. */
  payment_method?: {
    extra?: {
      three_ds_auth?: {
        current_step?: string;
        current_step_status?: string;
      };
    };
  };
}

export class WompiApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WompiApiError';
  }
}

// 6 s: bastante para una API de pagos que responde típicamente en menos de un
// segundo, y acotado para que el barrido del reconciliador (`TOPE_POR_
// BARRIDO = 20`, `packages/core/src/pagos/reconciliador.ts`) quede muy por
// debajo del default de 300 s de las funciones serverless de Vercel aun en el
// peor caso (20 × 6 s = 120 s). Ver el comentario de `TOPE_POR_BARRIDO` para
// la cuenta completa.
const TIMEOUT_MS = 6_000;

// Exportado (§ API-DIRECTA-CREACION-TRANSACCION-1) para que
// `lib/pagos/creacion-transaccion.ts` clasifique la rama "creada" con la MISMA
// comprobación de forma que ya usa `consultarTransaccionesPorReferencia` — dos
// definiciones del mismo chequeo es cómo terminan divergiendo (§ CLAUDE.md,
// el patrón que ya costó `razonDelServidor`/`cruzoMinimo` duplicados).
export function esTransaccionWompi(x: unknown): x is TransaccionWompi {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return typeof o.id === 'string' && typeof o.status === 'string' && typeof o.amount_in_cents === 'number';
}

/**
 * Consulta las transacciones de Wompi para una REFERENCIA. Un error de red,
 * un timeout, un status HTTP no-200, o un cuerpo con forma inesperada se
 * propagan como `WompiApiError` — el llamador decide qué hacer (el
 * reconciliador NUNCA cierra un intento por esto: se reintenta el próximo
 * tick, incluso si ya venció por edad — cerrar sin haber logrado preguntarle
 * a Wompi es justo el riesgo que existe para evitar).
 *
 * @param reference La referencia del `PaymentIntent` (`"<numero_orden>:<cuid>"`).
 * @param privateKey `WOMPI_PRIVATE_KEY` de la cuenta — el llamador decide de
 *   dónde sale, este módulo no lee `process.env`.
 * @param baseUrl El host de la API de Wompi (`https://sandbox.wompi.co` o
 *   `https://production.wompi.co`) — el llamador decide cuál, según el
 *   entorno del despliegue.
 */
export async function consultarTransaccionesPorReferencia(
  reference: string,
  privateKey: string,
  baseUrl: string,
): Promise<TransaccionWompi[]> {
  const url = `${baseUrl}/v1/transactions?reference=${encodeURIComponent(reference)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method:  'GET',
      headers: { Authorization: `Bearer ${privateKey}` },
      signal:  controller.signal,
    });
  } catch (e) {
    throw new WompiApiError(
      `fallo de red consultando Wompi por la referencia ${reference}: ${(e as Error).message}`,
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    throw new WompiApiError(`Wompi respondió ${res.status} consultando la referencia ${reference}`);
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new WompiApiError(`respuesta no-JSON de Wompi consultando la referencia ${reference}`);
  }

  const data = (body as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) {
    throw new WompiApiError(`respuesta con forma inesperada de Wompi consultando la referencia ${reference}`);
  }

  return data.filter(esTransaccionWompi);
}

// ── EL PANEL DE MÉTODOS (§ API-DIRECTA-PANEL-METODOS-1) Y LAS DOS ACEPTACIONES
//    (§ API-DIRECTA-ACEPTACIONES-SERVIDOR-1) ──────────────────────────────────
//
// `GET /v1/merchants/info` — el endpoint NUEVO del comercio (el viejo, con la
// llave en la URL, muere el 31 de octubre de 2026). Medido contra el sandbox
// real (`API-DIRECTA-SPIKES-ASIENTO-1`, DECISIONS.md): responde `200` y trae
// `accepted_payment_methods` —la lista de tipos que la cuenta tiene REALMENTE
// habilitados— Y los DOS tokens de aceptación, en la MISMA respuesta.
//
// LA LLAVE VA POR CABECERA, `x-merchant-public-key`, y es la PÚBLICA — no la
// privada de `consultarTransaccionesPorReferencia` de arriba. Tampoco se lee de
// `process.env` acá (mismo principio que el resto del módulo): la recibe el
// llamador.
//
// `fetchInfoComercio` es el fetch COMPARTIDO por `consultarMetodosAceptados` y
// `consultarAceptaciones`: las dos leen la MISMA respuesta del comercio, así
// que extraer el fetch acá es lo que evita escribir la llamada dos veces
// (§ API-DIRECTA-ACEPTACIONES-SERVIDOR-1: "no escribas una segunda llamada").
// Devuelve `data` TAL CUAL, sin validar su forma — cada función pública valida
// el campo que necesita y lanza con su propio mensaje, igual que antes de
// extraer este helper.
//
// LA FORMA DEL SOBRE (`{"data": {...}}`) NO fue medida de primera mano para
// ESTE endpoint por el spike citado arriba —midió las claves de primer nivel,
// no transcribió el sobre completo—; se asume por la misma convención que ya
// usa `consultarTransaccionesPorReferencia` con `/v1/transactions`. Si el
// proveedor no envuelve en `data`, cada función pública lo trata como forma
// inesperada (para los métodos, lanza; para las aceptaciones, ver más abajo).
async function fetchInfoComercio(publicKey: string, baseUrl: string): Promise<unknown> {
  const url = `${baseUrl}/v1/merchants/info`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method:  'GET',
      headers: { 'x-merchant-public-key': publicKey },
      signal:  controller.signal,
    });
  } catch (e) {
    throw new WompiApiError(`fallo de red consultando la información del comercio de Wompi: ${(e as Error).message}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    throw new WompiApiError(`Wompi respondió ${res.status} consultando la información del comercio`);
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new WompiApiError('respuesta no-JSON de Wompi consultando la información del comercio');
  }

  return (body as { data?: unknown } | null)?.data;
}

function esListaDeStrings(x: unknown): x is string[] {
  return Array.isArray(x) && x.every(v => typeof v === 'string');
}

/**
 * Consulta los tipos de método de pago que la cuenta del comercio tiene
 * habilitados. Un error de red, un timeout, un status no-200, o una forma de
 * respuesta inesperada se propagan como `WompiApiError` — NUNCA se devuelve
 * un array vacío como forma de decir "no se pudo leer": el llamador necesita
 * distinguir "tu cuenta no tiene métodos" (medible sólo si esta función
 * responde) de "no pudimos preguntarle al proveedor" (esta función lanza).
 *
 * @param publicKey La llave PÚBLICA de la cuenta — el llamador decide de dónde
 *   sale (`WOMPI_PUBLIC_KEY`), este módulo no lee `process.env`.
 * @param baseUrl El host de la API de Wompi (sandbox o producción) — el
 *   llamador decide cuál, según el estado del despliegue.
 */
export async function consultarMetodosAceptados(
  publicKey: string,
  baseUrl: string,
): Promise<string[]> {
  const data = await fetchInfoComercio(publicKey, baseUrl);
  const metodos = (data as { accepted_payment_methods?: unknown } | null)?.accepted_payment_methods;
  if (!esListaDeStrings(metodos)) {
    throw new WompiApiError('respuesta con forma inesperada de Wompi consultando los métodos habilitados (accepted_payment_methods)');
  }

  return metodos;
}

function campoString(x: unknown): string | null {
  return typeof x === 'string' ? x : null;
}

/** Extrae `{acceptance_token, permalink}` de un sub-objeto del sobre — `null` en cada
 *  campo que falte o no sea texto, SIN lanzar: un token/enlace ausente es un caso real
 *  que `evaluarAceptaciones` (`lib/pagos/aceptaciones.ts`) tiene que poder distinguir,
 *  no un sobre malformado. */
function campoAceptacion(x: unknown): AceptacionCruda {
  const o = x && typeof x === 'object' ? (x as Record<string, unknown>) : {};
  return { token: campoString(o.acceptance_token), enlace: campoString(o.permalink) };
}

/**
 * Consulta las DOS aceptaciones que el comprador debe marcar para pagar por la pasarela
 * —los términos y condiciones de uso y la autorización de tratamiento de datos personales
 * del PROVEEDOR (§ API-DIRECTA-DECISIONES-PROGRAMA-1 §4, DECISIONS.md: "el comercio no
 * redacta ni aloja ninguno de los dos documentos")—. Misma llamada que
 * `consultarMetodosAceptados`: comparten `fetchInfoComercio` porque es la MISMA respuesta
 * del proveedor.
 *
 * Devuelve los DOS campos TAL CUAL llegaron (`token`/`enlace` en `null` si faltan) — SIN
 * juzgar si están completos. Esa es la regla de negocio de `lib/pagos/aceptaciones.ts`
 * (`evaluarAceptaciones`), puro y testeado sin red. Esta función sólo lanza como
 * `WompiApiError` si el SOBRE mismo no tiene la forma que un objeto JSON puede tener
 * (falla de red, timeout, status no-200, cuerpo no-JSON) — igual que
 * `consultarMetodosAceptados`.
 *
 * LOS NOMBRES DE CAMPO (`presigned_acceptance`/`presigned_personal_data_auth`,
 * `acceptance_token`/`permalink`) NO fueron medidos de primera mano contra el sandbox: el
 * spike que midió este endpoint (`API-DIRECTA-SPIKES-ASIENTO-1`) confirmó que los DOS
 * tokens de aceptación vienen en la respuesta, pero no transcribió el sobre completo. Se
 * asumen por la convención pública documentada del proveedor — misma salvedad que ya
 * lleva el comentario de la sección de arriba para la forma del sobre.
 *
 * @param publicKey La llave PÚBLICA de la cuenta — el llamador decide de dónde sale.
 * @param baseUrl El host de la API de Wompi (sandbox o producción).
 */
export async function consultarAceptaciones(
  publicKey: string,
  baseUrl: string,
): Promise<AceptacionesCrudas> {
  const data = await fetchInfoComercio(publicKey, baseUrl);
  const o = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  return {
    terminos:        campoAceptacion(o.presigned_acceptance),
    datosPersonales: campoAceptacion(o.presigned_personal_data_auth),
  };
}

// ── LA CREACIÓN DE LA TRANSACCIÓN (§ API-DIRECTA-CREACION-TRANSACCION-1) ────────────────────
//
// `POST /v1/transactions` — la llamada que el motor de dinero YA EXISTENTE (el webhook,
// `aplicarResultadoWompi`, y el reconciliador — ver la cabecera de
// `packages/core/src/pagos/reconciliador.ts`) va a cerrar más tarde por REFERENCIA, nunca por
// cómo nació la transacción en el proveedor. Esta función NO decide nada sobre el resultado:
// hace la llamada y devuelve el STATUS + BODY crudos, para que `lib/pagos/creacion-
// transaccion.ts` (puro, sin red) los clasifique.
//
// NO LANZA POR UN STATUS NO-200 A PROPÓSITO — a diferencia de
// `consultarTransaccionesPorReferencia` y `fetchInfoComercio` de arriba: acá el status y el
// cuerpo de un 422/404/401 SON el dato que el llamador necesita distinguir. Medido contra el
// sandbox (`API-DIRECTA-SPIKES-ASIENTO-1`, DECISIONS.md): firma ausente/alterada → 422, método
// no habilitado → 404, sin credencial → 401, cada uno con forma reconocible. Sólo un fallo de
// RED, un TIMEOUT, o un cuerpo NO-JSON siguen siendo `WompiApiError` — esos no son una
// respuesta que clasificar, son la ausencia de una.
//
// LA AUTORIZACIÓN VA CON LA LLAVE PRIVADA — decisión, no obligación: medido que las DOS llaves
// autorizan crear (§ API-DIRECTA-SPIKES-ASIENTO-1 §1.B, DECISIONS.md), pero esta llamada vive
// en el SERVIDOR, que ya recibe la privada para `consultarTransaccionesPorReferencia` arriba —
// una sola credencial por módulo es más simple de razonar que dos que hacen lo mismo.
//
// LOS NOMBRES DE CAMPO DEL BODY (`acceptance_token`, `accept_personal_auth`, `payment_method`)
// NO ESTÁN MEDIDOS CONTRA EL SANDBOX por este slice —no tiene acceso a red—: son la convención
// pública del proveedor, LEÍDA, misma salvedad que ya lleva `consultarAceptaciones` arriba
// para `presigned_acceptance`/`presigned_personal_data_auth`, y que
// `services/checkout.service.ts` (`tokenizarTarjeta`) ya lleva para `/v1/tokens/cards`.
//
// GENERALIZADA A CUALQUIER MÉTODO (§ API-DIRECTA-ENVIO-GENERICO-1): esta función vivía FIJADA
// a `payment_method: {type: 'CARD', ...}` (el único método que `API-DIRECTA-CREACION-
// TRANSACCION-1` cableó) — `API-DIRECTA-OTROS-METODOS-1` construyó la forma extensible del
// lado de arriba (`lib/pagos/metodos-pasarela.ts`, los descriptores) y del lado puro
// (`construirDatosCreacionTransaccion`, `lib/pagos/creacion-transaccion.ts`), pero dejó ESTE
// archivo sin tocar porque su spec no lo declaraba en `touches`. Ahora `datos.paymentMethod`
// es el `payment_method` YA ARMADO por el descriptor (o, para tarjeta, armado a mano por el
// llamador con la misma forma de siempre) — este módulo no vuelve a decidir qué tipo es: sólo
// lo pone en el body tal cual llega. `reference`, `amountInCents`, `currency`, `signature` y
// las dos aceptaciones NO CAMBIARON de nombre ni de forma.

/** Lo que la firma de integridad ya fija —`reference`, `amountInCents`, `currency`,
 *  `signature`, calculados por el LLAMADOR con el intento que YA EXISTE, nunca recalculados
 *  acá— más los dos tokens de aceptación que el comprador marcó
 *  (§ API-DIRECTA-ACEPTACIONES-SERVIDOR-1) y el `payment_method` YA ARMADO para el método
 *  elegido (§ API-DIRECTA-ENVIO-GENERICO-1) — tarjeta u cualquier otro tipo del registro de
 *  `lib/pagos/metodos-pasarela.ts`, este módulo no distingue cuál.
 *
 *  `threeDsAuth` es OPCIONAL a este nivel —lo trae SIEMPRE `construirDatosCreacionTransaccionTarjeta`
 *  (tarjeta, § API-DIRECTA-3DS-SIN-CHALLENGE-1, "se pide siempre, no hay interruptor") y NUNCA
 *  `construirDatosCreacionTransaccion` (los métodos que no son tarjeta, fuera del alcance de ese
 *  slice) — la garantía de "siempre para tarjeta" vive en la firma de esa función constructora,
 *  no acá. */
export interface DatosCreacionTransaccion {
  reference: string;
  amountInCents: number;
  currency: string;
  signature: string;
  paymentMethod: Record<string, unknown>;
  acceptanceToken: string;
  acceptPersonalAuthToken: string;
  threeDsAuth?: Record<string, unknown>;
}

/** El status HTTP + el cuerpo TAL CUAL de Wompi — sin interpretar. La interpretación es de
 *  `lib/pagos/creacion-transaccion.ts` (puro, sin red). */
export interface RespuestaCrudaTransaccion {
  status: number;
  body: unknown;
}

/**
 * Crea la transacción contra Wompi para CUALQUIER método — el `payment_method` viaja tal cual
 * `datos.paymentMethod` lo trae (§ API-DIRECTA-ENVIO-GENERICO-1); esta función no lo arma ni lo
 * juzga, sólo lo envía.
 *
 * @param datos Ver `DatosCreacionTransaccion`.
 * @param privateKey `WOMPI_PRIVATE_KEY` de la cuenta — el llamador decide de dónde sale, este
 *   módulo no lee `process.env`.
 * @param baseUrl El host de la API de Wompi (sandbox o producción) — el llamador decide cuál.
 */
export async function crearTransaccion(
  datos: DatosCreacionTransaccion,
  privateKey: string,
  baseUrl: string,
): Promise<RespuestaCrudaTransaccion> {
  const url = `${baseUrl}/v1/transactions`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${privateKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        acceptance_token:     datos.acceptanceToken,
        accept_personal_auth: datos.acceptPersonalAuthToken,
        amount_in_cents:      datos.amountInCents,
        currency:             datos.currency,
        signature:            datos.signature,
        reference:            datos.reference,
        payment_method:       datos.paymentMethod,
        // § API-DIRECTA-3DS-SIN-CHALLENGE-1: ausente para los métodos que no piden 3DS
        // (todo lo que no es tarjeta, hoy). Nombre de campo NO MEDIDO — ver
        // `lib/pagos/tres-ds.ts`.
        ...(datos.threeDsAuth ? { three_ds_auth: datos.threeDsAuth } : {}),
      }),
      signal: controller.signal,
    });
  } catch (e) {
    throw new WompiApiError(
      `fallo de red creando la transacción de Wompi para la referencia ${datos.reference}: ${(e as Error).message}`,
    );
  } finally {
    clearTimeout(timeoutId);
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new WompiApiError(`respuesta no-JSON de Wompi creando la transacción para la referencia ${datos.reference}`);
  }

  return { status: res.status, body };
}
