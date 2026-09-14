import { NextRequest, NextResponse } from 'next/server';
import prisma from '@duna/core';
import { isUniqueViolation } from '@duna/core/orders';
import {
  verificarFirmaWompi,
  RutaDePropertyNoResuelveError,
  type EventoWompi,
} from '@/lib/pagos/wompi-firma';

// ── EL WEBHOOK DE WOMPI ───────────────────────────────────────────────────────
//
// Recibe el evento, verifica su firma, reconoce un reintento (Wompi manda hasta
// 3 en 24 h ante cualquier respuesta que no sea 200 — WOMPI-REGLAS-IMPLEMENTACION-1)
// y cierra el `PaymentIntent` correspondiente. NO crea ningún `Payment`.
//
// LA FRONTERA ES A PROPÓSITO (WOMPI-WEBHOOK-RUTA-1): crear un `Payment` exige un
// valor de `MetodoPago`, y el enum de hoy (`NEQUI | DAVIPLATA | EFECTIVO |
// TRANSFERENCIA | OTRO | BREB`) no tiene `WOMPI`. Usar `OTRO` o agregar un valor es
// modelar un concepto del dominio — decisión del owner, pendiente. Por eso este
// archivo llega HASTA escribir el desenlace en `PaymentIntent` y se detiene ahí; el
// gancho de la etapa siguiente está marcado más abajo, en el punto exacto donde
// engancha.
//
// SIN CUERPO CRUDO: `verificarFirmaWompi` opera sobre el evento YA PARSEADO
// (medido: cero `req.text()` en `app/api`, el resto de las rutas usa `.json()`), así
// que `req.json()` alcanza — no hace falta el cuerpo crudo para nada de esto.
//
// SIN TENANT EN LA RUTA y sin paso por `proxy.ts`: el matcher del middleware es
// `["/admin(.*)"]` (verificado en `proxy.ts`), así que `/api/*` nunca lo atraviesa.
//
// EL SECRETO NUNCA VIVE EN CÓDIGO: se lee por NOMBRE de `process.env` acá, y se le
// pasa al verificador como parámetro — el verificador (`lib/pagos/wompi-firma.ts`)
// no lee el entorno, por diseño.

/** La fila de `PaymentIntent` en lo mínimo que este módulo necesita leer. */
export interface PaymentIntentRow {
  id: string;
  estado: 'EN_VUELO' | 'APROBADO' | 'FALLIDO';
  monto_esperado: number;
  pspTransactionId: string | null;
}

/**
 * El cliente de `PaymentIntent` que este módulo necesita — una interfaz ANGOSTA y
 * estructural, no el `PrismaClient` completo. `prisma` (importado arriba) la
 * satisface por tener MÁS métodos que los que acá se piden; el test le pasa un
 * doble en memoria con SÓLO estos dos. Achicar la interfaz a lo que se usa es lo
 * que vuelve posible testear la ruta ENTERA (`POST` → `Response`) sin una base real.
 */
export interface PaymentIntentDb {
  paymentIntent: {
    findUnique(args: { where: { reference: string } }): Promise<PaymentIntentRow | null>;
    /** Transición condicional en UNA sentencia — mismo patrón que `sellar()` en
     *  `packages/core/src/comprobantes.ts` (`updateMany` con el estado en el
     *  `where`): dos escrituras concurrentes sobre el MISMO intento no pueden
     *  ambas ganar. `count === 0` ⇒ alguien más ya lo cerró entre la lectura y
     *  esta escritura. */
    updateMany(args: {
      where: { id: string; estado: 'EN_VUELO' };
      data: {
        pspTransactionId: string;
        estado: 'APROBADO' | 'FALLIDO';
        estado_crudo_psp: string;
      };
    }): Promise<{ count: number }>;
  };
}

/**
 * Bucket DERIVADO del status crudo de Wompi, medido contra NUESTRAS decisiones
 * (§ CLAUDE.md, `PaymentIntentEstado` en schema.prisma) y no contra el catálogo
 * crudo del PSP: `APPROVED` cierra `APROBADO`; `DECLINED`/`VOIDED`/`ERROR` cierran
 * `FALLIDO`. Cualquier otro valor (`PENDING`, o uno que Wompi agregue mañana) NO es
 * terminal — devuelve `null` y el intento se queda `EN_VUELO`: preferir callar a
 * decidir sin base.
 */
function bucketDeStatus(status: string): 'APROBADO' | 'FALLIDO' | null {
  if (status === 'APPROVED') return 'APROBADO';
  if (status === 'DECLINED' || status === 'VOIDED' || status === 'ERROR') return 'FALLIDO';
  return null;
}

/** Los cuatro campos de `data.transaction` que este webhook lee, con guardas de
 *  tipo — un evento real siempre los trae, pero nada obliga a confiar en eso. */
function leerTransaction(data: Record<string, unknown>): {
  reference: string | null;
  pspTransactionId: string | null;
  status: string | null;
  montoPesos: number | null;
} {
  const tx = data.transaction;
  if (typeof tx !== 'object' || tx === null) {
    return { reference: null, pspTransactionId: null, status: null, montoPesos: null };
  }
  const t = tx as Record<string, unknown>;
  return {
    reference:        typeof t.reference === 'string' ? t.reference : null,
    pspTransactionId: typeof t.id === 'string' ? t.id : null,
    status:           typeof t.status === 'string' ? t.status : null,
    // `amount_in_cents` es COP en centavos (confirmado contra el sandbox,
    // WOMPI-REGLAS-IMPLEMENTACION-1); `monto_esperado` es el snapshot de
    // `Order.total` en pesos — de ahí el /100.
    montoPesos:       typeof t.amount_in_cents === 'number' ? t.amount_in_cents / 100 : null,
  };
}

/** Valida la forma MÍNIMA que `verificarFirmaWompi` exige, sin confiar en que el
 *  body traiga lo que promete. Un cuerpo que no cumple esto es tan intratable como
 *  una firma inválida: no hay nada que verificar, así que se cierra por la MISMA
 *  puerta (401) — ver el porqué en la cabecera del archivo. */
function comoEventoWompi(x: unknown): EventoWompi | null {
  if (typeof x !== 'object' || x === null) return null;
  const o = x as Record<string, unknown>;
  if (typeof o.data !== 'object' || o.data === null) return null;
  if (typeof o.timestamp !== 'number' && typeof o.timestamp !== 'string') return null;
  if (typeof o.signature !== 'object' || o.signature === null) return null;
  const sig = o.signature as Record<string, unknown>;
  if (!Array.isArray(sig.properties) || !sig.properties.every((p) => typeof p === 'string')) return null;
  if (typeof sig.checksum !== 'string') return null;
  return {
    data:      o.data as Record<string, unknown>,
    timestamp: o.timestamp as number | string,
    signature: { properties: sig.properties as string[], checksum: sig.checksum },
  };
}

export interface ResultadoWebhook {
  status: number;
  motivo: string;
}

/**
 * El camino, en orden — YA con la firma verificada por el llamador (`POST`, abajo).
 * Exportada e inyectable por `db` para poder testear la ruta ENTERA sin una base
 * real (ver `PaymentIntentDb` arriba).
 */
export async function procesarEventoWompi(
  evento: EventoWompi,
  checksumHeader: string | undefined,
  secretoEventos: string,
  db: PaymentIntentDb,
): Promise<ResultadoWebhook> {
  let firmaValida: boolean;
  try {
    firmaValida = verificarFirmaWompi(evento, secretoEventos, checksumHeader);
  } catch (e) {
    if (e instanceof RutaDePropertyNoResuelveError) {
      // El evento no tiene la forma que `signature.properties` promete: no es "la
      // firma no coincide" (eso compara hashes), es "no hay nada que comparar". Se
      // cierra por la MISMA puerta que una firma inválida — reintentar SÍ puede
      // ayudar si la causa fue un fallo transitorio del lado de Wompi.
      console.error('[wompi-webhook] evento no verificable —', e.message);
      return { status: 401, motivo: 'evento no verificable' };
    }
    throw e;
  }
  if (!firmaValida) {
    // Nada se escribe: no sabemos qué pasó de verdad hasta que la firma cierre, y
    // reintentar AYUDA si el fallo fue transitorio (config, secreto rotado a medias).
    console.error('[wompi-webhook] firma inválida');
    return { status: 401, motivo: 'firma inválida' };
  }

  const { reference, pspTransactionId, status, montoPesos } = leerTransaction(evento.data);
  if (!reference) {
    // Reintentar NO ayuda: sin referencia no hay por dónde ubicar el intento, y el
    // evento no va a traer una la próxima vez.
    console.error('[wompi-webhook] evento sin transaction.reference — no hay por dónde ubicarlo');
    return { status: 200, motivo: 'sin referencia' };
  }

  const intent = await db.paymentIntent.findUnique({ where: { reference } });
  if (!intent) {
    // Reintentar NO ayuda: la referencia no va a aparecer por reintentar el mismo
    // evento. (Caso conocido y no resuelto acá: un evento que llega ANTES de que
    // nuestra propia fila exista — es de la etapa que crea el `PaymentIntent` al
    // iniciar el checkout, no de este slice.)
    console.error(`[wompi-webhook] referencia sin match: ${reference}`);
    return { status: 200, motivo: 'referencia sin match' };
  }

  // EL MONTO NO DECIDE NADA ACÁ — sólo se compara y se registra si difiere. El
  // monto de un `Payment` se relee de `Order.total` BAJO LOCK; eso es de la etapa
  // siguiente. Acá la discrepancia es información, nunca un motivo para desviar
  // el flujo.
  if (montoPesos !== null && montoPesos !== intent.monto_esperado) {
    console.error(
      `[wompi-webhook] discrepancia de monto en ${reference}: esperado ${intent.monto_esperado}, evento ${montoPesos}`,
    );
  }

  if (intent.estado !== 'EN_VUELO') {
    // Ya es terminal — un veredicto no se reescribe. Se distingue REPETIDO (el
    // mismo id de transacción que ya quedó asentado: es el mismo evento, de nuevo)
    // de ANOMALÍA (el evento contradice lo asentado); ninguno de los dos pisa nada.
    if (intent.pspTransactionId !== null && intent.pspTransactionId === pspTransactionId) {
      return { status: 200, motivo: 'repetido' };
    }
    console.error(
      `[wompi-webhook] ANOMALÍA sobre intento ya terminal ${reference}: quedó ${intent.estado}` +
        ` (id ${intent.pspTransactionId ?? '(ninguno)'}), el evento trae otro`,
    );
    return { status: 200, motivo: 'anomalía sobre intento terminal' };
  }

  const bucket = status !== null ? bucketDeStatus(status) : null;
  if (!bucket || status === null) {
    // Estado no terminal (p.ej. PENDING) o desconocido: no cerramos el intento
    // todavía. Preferir callar a decidir sin base — sigue EN_VUELO.
    return { status: 200, motivo: 'estado no terminal, sin cerrar' };
  }
  if (!pspTransactionId) {
    // Un evento terminal SIN id de transacción es una forma que no debería darse;
    // no hay con qué cerrar el intento (la columna es la pieza de idempotencia,
    // no puede quedar null en un cierre).
    console.error(`[wompi-webhook] evento terminal sin transaction.id en ${reference}`);
    return { status: 200, motivo: 'evento terminal sin id de transacción' };
  }

  try {
    const { count } = await db.paymentIntent.updateMany({
      where: { id: intent.id, estado: 'EN_VUELO' },
      data: { pspTransactionId, estado: bucket, estado_crudo_psp: status },
    });
    if (count === 0) {
      // Perdió la carrera: otra entrega (concurrente, del mismo evento) ya cerró
      // este intento entre nuestra lectura y esta escritura. No es un error — es
      // el mismo caso de arriba, visto un instante después.
      return { status: 200, motivo: 'cerrado por otra entrega concurrente' };
    }
  } catch (e) {
    if (isUniqueViolation(e)) {
      // El id de transacción ya está asentado en OTRA fila de `PaymentIntent`. La
      // unique es la pieza que sostiene la idempotencia (PASARELA-DOC-AL-DIA-1) —
      // el choque ocurre ACÁ, antes de cualquier llamada al escritor de dinero
      // (que en este slice ni existe). No se reintenta la escritura ni se pisa nada.
      console.error(`[wompi-webhook] pspTransactionId ${pspTransactionId} ya pertenece a otro intento`);
      return { status: 200, motivo: 'id de transacción ya asentado en otro intento' };
    }
    throw e;
  }

  // ── GANCHO DE LA ETAPA SIGUIENTE ─────────────────────────────────────────────
  // El `PaymentIntent` ya quedó cerrado (`bucket`). Si `bucket === 'APROBADO'`, la
  // etapa siguiente llama acá a `registerOrderPaymentTx`
  // (`packages/core/src/orders.ts`) — el ÚNICO escritor de `Payment` — como su
  // CUARTO llamador, pasándole `intent.orden_id` y el monto RELEÍDO de
  // `Order.total` bajo `SELECT … FOR UPDATE` (nunca `monto_esperado`, que es sólo
  // un snapshot al crear el intento). Ese llamado exige un valor de `MetodoPago`,
  // y el enum de hoy no tiene `WOMPI` — modelar eso es del owner (§ 0 del spec de
  // este slice) y no se hace acá.
  return { status: 200, motivo: bucket === 'APROBADO' ? 'cerrado aprobado' : 'cerrado fallido' };
}

export async function POST(req: NextRequest) {
  const secretoEventos = process.env.WOMPI_EVENTS_SECRET;
  // Sin secreto no hay forma de verificar NINGÚN evento — el endpoint queda
  // CERRADO, no abierto. Un despliegue al que se le olvidó la env var debe
  // fallar ruidosamente (500), nunca aceptar eventos sin verificarlos.
  if (!secretoEventos) {
    console.error('[wompi-webhook] falta WOMPI_EVENTS_SECRET — no se puede verificar ningún evento');
    return NextResponse.json({ error: 'Webhook no configurado' }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    console.error('[wompi-webhook] cuerpo no es JSON válido');
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 401 });
  }

  const evento = comoEventoWompi(body);
  if (!evento) {
    console.error('[wompi-webhook] cuerpo con forma inesperada — no es un evento de Wompi verificable');
    return NextResponse.json({ error: 'Evento con forma inesperada' }, { status: 401 });
  }

  const checksumHeader = req.headers.get('x-event-checksum') ?? undefined;
  const { status, motivo } = await procesarEventoWompi(evento, checksumHeader, secretoEventos, prisma);
  return NextResponse.json({ ok: status === 200, motivo }, { status });
}
