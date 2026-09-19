import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@duna/core/rate-limit';
import { consultarTransaccionesPorReferencia } from '@/lib/pagos/wompi-api';
import { DESCRIPTORES_METODO_PASARELA, urlDeRedireccionEnLista, type DescriptorMetodoPasarela } from '@/lib/pagos/metodos-pasarela';
import { esDespliegueDemo } from '@/next.config';
import type { ResultadoRedireccionPasarela } from '@/types/payment';

// ── EL MECANISMO DE REDIRECCIÓN — § API-DIRECTA-MECANISMO-REDIRECCION-1 ─────────────────────
//
// `urlDeRedireccion`/`urlDeRedireccionEnLista` (`lib/pagos/metodos-pasarela.ts`) YA sabían
// extraer la dirección con el nombre de campo QUE DECLARA EL DESCRIPTOR; lo que faltaba era el
// CONSUMIDOR — medido antes de este slice, cero referencias fuera de ese archivo y su test
// (§0 del reporte del slice). Esta ruta es ese consumidor.
//
// «LA DIRECCIÓN LLEGA TARDE» (medido, API-DIRECTA-PSE-SPIKE-ASIENTO-1, externo a este repo — no
// hay asiento en DECISIONS.md que grepear, es un OBSERVED que no deja commit): la creación de la
// transacción NO devuelve la dirección; aparece DESPUÉS, releyendo la transacción. Por eso el
// mecanismo es RELECTURA, no un campo que ya viene en la respuesta de crear.
//
// EL PATRÓN ES EL MISMO QUE `app/api/checkout/retorno/route.ts` Y `app/api/webhooks/wompi/
// route.ts`: un handler DELGADO que arma las dependencias reales, y una función pura-ish
// (`resolverRedireccionPasarela`) que las recibe INYECTADAS — así el carril rápido (que cubre
// `app/**` y tiene que ser DB-FREE, § CLAUDE.md) puede probar la relectura y la extracción sin
// tocar Postgres ni la red real.
//
// EL SONDEO CON BACKOFF NO VIVE ACÁ — vive en el CLIENTE (`components/storefront/checkout/
// EsperaRedireccionPasarela.tsx`), reusando LA MISMA política que ya usa el camino de 3DS
// (`esperaSondeoSiguienteMs`/`TECHO_SONDEO_MS`, `lib/pagos/tres-ds.ts`) — mismo mecanismo que ya
// usan `EsperaConfirmacionTarjeta.tsx` y `RetornoCliente.tsx` para el caso hermano (esperar a
// que el webhook cierre un `PaymentIntent`): el CLIENTE decide cuándo reintentar y cuándo
// rendirse; el SERVIDOR hace UNA consulta por llamada y responde con lo que YA HAY, nunca
// espera ni reintenta por su cuenta.
//
// `url: null` ES EL RESULTADO NORMAL, NUNCA UN ERROR: "todavía no aparece" no es un veredicto
// (§A del reporte del slice, "si la dirección no aparece, NO inventes un veredicto" — la misma
// regla que ya rige al reconciliador con «la regla del array vacío», § `lib/pagos/wompi-api.ts`
// y `packages/core/src/pagos/reconciliador.ts`: un `200 {"data":[]}` de Wompi no significa "no
// pagada", significa "sigue sin resolverse"). El intento y la orden siguen `EN_VUELO`; el
// reconciliador es quien eventualmente cierra un intento que nunca resuelve — esta ruta no
// compite con esa regla ni la duplica.

export const dynamic = 'force-dynamic';

const redireccionSchema = z.object({
  reference: z.string().trim().min(1),
  tipo:      z.string().trim().min(1),
});

const TIPO_NO_REDIRIGE_BODY = { error: 'Ese método de pago no navega fuera del checkout.' } as const;
const CUERPO_INVALIDO_BODY = { error: 'Datos inválidos' } as const;
const CONSULTA_FALLIDA_BODY = { error: 'No se pudo consultar el estado del pago. Intenta de nuevo.' } as const;

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

/** Lo que este handler necesita del mundo exterior, INYECTABLE — mismo criterio que
 *  `RetornoIntentoDb` (`app/api/checkout/retorno/route.ts`) y `PaymentIntentDb`
 *  (`app/api/webhooks/wompi/route.ts`): una interfaz ANGOSTA, no el cliente HTTP completo, para
 *  poder testear `resolverRedireccionPasarela` con un doble en memoria. */
export interface ResolverRedireccionPasarelaDeps {
  /** El registro de descriptores — inyectable SOLO para poder probar el mecanismo con un
   *  descriptor SINTÉTICO que declare `redireccion` con un nombre de campo propio, sin tocar
   *  `DESCRIPTORES_METODO_PASARELA` (mismo patrón que `agruparMetodosPasarelaPorInstrumento`/
   *  `esNoCobrable`, `lib/pagos/metodos-pasarela.ts`). En producción siempre corre con el
   *  registro real. */
  registro: Record<string, DescriptorMetodoPasarela>;
  /** UNA consulta a Wompi por la referencia — el adaptador real envuelve
   *  `consultarTransaccionesPorReferencia` (`lib/pagos/wompi-api.ts`) con la llave privada y el
   *  host del entorno. Puede LANZAR (fallo de red, timeout, forma inesperada — `WompiApiError`):
   *  eso es un fallo TRANSITORIO de la consulta, no "la dirección no existe" — se distingue del
   *  caso normal `url: null` (ver el `catch` de `resolverRedireccionPasarela`, abajo). */
  consultar(reference: string): Promise<Record<string, unknown>[]>;
}

export interface ResultadoResolverRedireccion {
  status: number;
  body: ResultadoRedireccionPasarela | { error: string };
}

/**
 * UN intento de relectura — nunca espera, nunca reintenta por su cuenta (ver la cabecera del
 * archivo: el backoff es del CLIENTE). Extrae con `urlDeRedireccionEnLista`
 * (`lib/pagos/metodos-pasarela.ts`), que a su vez usa el `campoUrl` QUE DECLARA EL DESCRIPTOR —
 * nunca un nombre fijo (§2 del reporte del slice: "si se prueba con un solo nombre, se está
 * probando otra vez el caso particular").
 *
 * `tipo` sin descriptor, o con descriptor que NO declara `redireccion` (p. ej. NEQUI, texto
 * libre sin navegar afuera): 400 — esta ruta sólo tiene sentido para un método que SÍ redirige;
 * un cliente que la llame para otro tipo está mal cableado, no es un caso a tolerar en
 * silencio.
 *
 * Un fallo TRANSITORIO de la consulta (`deps.consultar` lanza) se distingue de "todavía no
 * aparece": 502, retryable — el cliente reintenta en el siguiente tick de su backoff sin que el
 * reloj del techo se reinicie (mismo criterio que `RetornoCliente.tsx`/
 * `EsperaConfirmacionTarjeta.tsx` con un 429 u otro fallo transitorio de
 * `/api/checkout/retorno`).
 */
export async function resolverRedireccionPasarela(
  input: { reference: string; tipo: string },
  deps: ResolverRedireccionPasarelaDeps,
): Promise<ResultadoResolverRedireccion> {
  const descriptor = deps.registro[input.tipo];
  if (!descriptor?.redireccion) {
    return { status: 400, body: TIPO_NO_REDIRIGE_BODY };
  }

  let transacciones: Record<string, unknown>[];
  try {
    transacciones = await deps.consultar(input.reference);
  } catch {
    return { status: 502, body: CONSULTA_FALLIDA_BODY };
  }

  // `url: null` cuando ninguna transacción de la lista trae el campo todavía — EL CASO NORMAL,
  // nunca un error (ver la cabecera del archivo). El cliente decide si reintenta o se rinde.
  return { status: 200, body: { url: urlDeRedireccionEnLista(descriptor, transacciones) } };
}

export async function POST(req: NextRequest) {
  // Rate-limit por IP: el comprador legítimo hace POLLING con el MISMO backoff que
  // `/api/checkout/retorno` (`esperaSondeoSiguienteMs`, `lib/pagos/tres-ds.ts`) — mismo límite
  // que esa ruta ya usa para la misma cadencia (§ su cabecera: "caben ~6 pedidos en cualquier
  // ventana de 60s; 20 deja margen generoso").
  const rl = rateLimit(`redireccion-pasarela:${clientIp(req)}`, { limit: 20, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes. Intenta de nuevo en un momento.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(CUERPO_INVALIDO_BODY, { status: 400 });
  }

  const parsed = redireccionSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(CUERPO_INVALIDO_BODY, { status: 400 });
  }

  // Fail ruidoso, mismo criterio que el PATCH de `app/api/checkout/route.ts`: sin la llave
  // privada no hay con qué preguntarle a Wompi, y silenciarlo dejaría al comprador esperando
  // una dirección que nadie va a ir a buscar.
  const llavePrivada = process.env.WOMPI_PRIVATE_KEY;
  if (!llavePrivada) {
    console.error('[pasarela/redireccion] falta WOMPI_PRIVATE_KEY — no se puede consultar la transacción');
    return NextResponse.json(CONSULTA_FALLIDA_BODY, { status: 500 });
  }
  const baseUrlPasarela = esDespliegueDemo() ? 'https://sandbox.wompi.co' : 'https://production.wompi.co';

  const resultado = await resolverRedireccionPasarela(parsed.data, {
    registro: DESCRIPTORES_METODO_PASARELA,
    consultar: async (reference) => {
      const transacciones = await consultarTransaccionesPorReferencia(reference, llavePrivada, baseUrlPasarela);
      return transacciones as unknown as Record<string, unknown>[];
    },
  });
  return NextResponse.json(resultado.body, { status: resultado.status });
}
