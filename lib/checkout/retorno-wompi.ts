// CHECKOUT-LISTO-PARA-VENDER-1 — el regreso del WIDGET de Wompi no trae `?reference=`, trae
// `?id=<transacción>` (documentado por el proveedor: widget-checkout-web). La pantalla de
// retorno (`RetornoCliente.tsx`) sólo entendía `reference`, así que un comprador que pagó por
// el widget aterrizaba en «No encontramos la información de tu pago» — pese a que el webhook
// SÍ cobra la orden. Este módulo resuelve la referencia a partir del `id`, consultando el
// endpoint PÚBLICO de transacciones de Wompi (sin llave: `GET /v1/transactions/{id}` no exige
// autenticación para una lectura — § el spec del slice).
//
// Dos mitades, a propósito:
//  - `referenciaDesdeQuery`/`extraerReferenciaDeTransaccion` son PURAS: no hacen red, se
//    prueban pasándoles la respuesta de Wompi ya resuelta (o el query ya parseado).
//  - `resolverReferenciaPorId` es la que SÍ llama a la red — recibe su `fetch` por parámetro
//    para poder probarla con un doble, nunca contra el proveedor real.

/** Lo que el componente de retorno decide hacer con el query de la URL. `reference` manda si
 *  está presente —comportamiento de HOY, nunca se llama a Wompi para esto—; si no, `id` (el
 *  caso del widget) dispara la resolución; sin ninguno de los dos, no hay nada que mostrar. */
export type DecisionReferenciaRetorno =
  | { tipo: 'directa'; referencia: string }
  | { tipo: 'por_id'; id: string }
  | { tipo: 'ninguna' };

export function referenciaDesdeQuery(params: {
  reference?: string | null;
  id?: string | null;
}): DecisionReferenciaRetorno {
  const reference = params.reference?.trim();
  if (reference) return { tipo: 'directa', referencia: reference };
  const id = params.id?.trim();
  if (id) return { tipo: 'por_id', id };
  return { tipo: 'ninguna' };
}

/**
 * Extrae `reference` de la respuesta de `GET /v1/transactions/{id}` de Wompi — forma
 * documentada: `{ data: { reference: string, … } }`. Cualquier otra forma (ausente, `data`
 * sin `reference`, `reference` vacía o no-string) es "no se pudo resolver": nunca se inventa
 * una referencia ni se lanza — el llamador decide qué hacer con `null` (hoy: caer a la vista
 * `sin_referencia`, igual que si nunca hubiera llegado ningún query param).
 */
export function extraerReferenciaDeTransaccion(respuesta: unknown): string | null {
  if (!respuesta || typeof respuesta !== 'object') return null;
  const data = (respuesta as Record<string, unknown>).data;
  if (!data || typeof data !== 'object') return null;
  const referencia = (data as Record<string, unknown>).reference;
  if (typeof referencia !== 'string') return null;
  const limpia = referencia.trim();
  return limpia === '' ? null : limpia;
}

// Los DOS hosts posibles — el mismo par que ya usa `app/api/checkout/route.ts` vía
// `esDespliegueDemo()`, pero ACÁ no hay forma segura de leer esa señal del lado del cliente
// (`VERCEL_ENV`/`NOINDEX` no son `NEXT_PUBLIC_`, así que no existen en el navegador — el mismo
// límite que ya documenta `baseUrlPasarelaDesdeLlave`, `services/checkout.service.ts`, y que
// acá no se puede resolver igual porque el redirect del widget no trae ninguna llave). La
// consulta es PÚBLICA y de solo lectura, así que preguntar a los DOS en paralelo y quedarse
// con el primero que responda 200 es más seguro que adivinar uno: cuesta dos requests de un
// GET liviano, una sola vez, en una pantalla que ya está esperando.
export const HOSTS_PASARELA_RETORNO = [
  'https://sandbox.wompi.co',
  'https://production.wompi.co',
] as const;

type FetchLike = (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

/**
 * Resuelve la `reference` de una transacción a partir de su `id`, probando los dos hosts de
 * Wompi en paralelo. Devuelve `null` si ninguno responde con una transacción resoluble —NUNCA
 * lanza—, para que el llamador caiga a la misma vista `sin_referencia` que ya cubre el caso
 * de no tener ningún dato. `fetchImpl` es inyectable para pruebas (y es el único parámetro que
 * las vuelve deterministas: nunca se llama a Wompi real desde un test).
 */
export async function resolverReferenciaPorId(
  id: string,
  fetchImpl: FetchLike,
): Promise<string | null> {
  const resultados = await Promise.allSettled(
    HOSTS_PASARELA_RETORNO.map(async (host) => {
      const res = await fetchImpl(`${host}/v1/transactions/${encodeURIComponent(id)}`);
      if (!res.ok) return null;
      return extraerReferenciaDeTransaccion(await res.json());
    }),
  );
  for (const r of resultados) {
    if (r.status === 'fulfilled' && r.value) return r.value;
  }
  return null;
}
