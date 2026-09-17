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

export interface TransaccionWompi {
  id: string;
  status: string;
  amount_in_cents: number;
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

function esTransaccionWompi(x: unknown): x is TransaccionWompi {
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

// ── EL PANEL DE MÉTODOS (§ API-DIRECTA-PANEL-METODOS-1) ──────────────────────
//
// `GET /v1/merchants/info` — el endpoint NUEVO del comercio (el viejo, con la
// llave en la URL, muere el 31 de octubre de 2026). Medido contra el sandbox
// real (`API-DIRECTA-SPIKES-ASIENTO-1`, DECISIONS.md): responde `200` y trae
// `accepted_payment_methods`, la lista de tipos que la cuenta tiene REALMENTE
// habilitados — no un catálogo escrito en este código.
//
// LA LLAVE VA POR CABECERA, `x-merchant-public-key`, y es la PÚBLICA — no la
// privada de `consultarTransaccionesPorReferencia` de arriba. Tampoco se lee de
// `process.env` acá (mismo principio que el resto del módulo): la recibe el
// llamador.
//
// LA FORMA DEL SOBRE (`{"data": {...}}`) NO fue medida de primera mano para
// ESTE endpoint por el spike citado arriba —midió las claves de primer nivel,
// no transcribió el sobre completo—; se asume por la misma convención que ya
// usa `consultarTransaccionesPorReferencia` con `/v1/transactions`. Si el
// proveedor no envuelve en `data`, esta función lo trata como forma
// inesperada y lanza — nunca como lista vacía (ver más abajo).
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
    throw new WompiApiError(`fallo de red consultando los métodos habilitados de Wompi: ${(e as Error).message}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    throw new WompiApiError(`Wompi respondió ${res.status} consultando los métodos habilitados`);
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new WompiApiError('respuesta no-JSON de Wompi consultando los métodos habilitados');
  }

  const data = (body as { data?: unknown } | null)?.data;
  const metodos = (data as { accepted_payment_methods?: unknown } | null)?.accepted_payment_methods;
  if (!esListaDeStrings(metodos)) {
    throw new WompiApiError('respuesta con forma inesperada de Wompi consultando los métodos habilitados (accepted_payment_methods)');
  }

  return metodos;
}
