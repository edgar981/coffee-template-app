import { NextRequest, NextResponse } from 'next/server';
import prisma from '@duna/core';
import { isUniqueViolation, registerOrderPaymentTx, lockOrderForPayment } from '@duna/core/orders';
import { createNotification } from '@duna/core/notifications';
import { hrefOrden } from '@/constants/automations';
import {
  aplicarResultadoWompi,
  bucketDeStatus,
  type OrdenLockeada,
  type NotificacionAtencion,
  type PaymentIntentTx,
} from '@duna/core/pagos/aplicar-resultado-wompi';
import {
  verificarFirmaWompi,
  RutaDePropertyNoResuelveError,
  type EventoWompi,
} from '@/lib/pagos/wompi-firma';

// ── EL WEBHOOK DE WOMPI ───────────────────────────────────────────────────────
//
// Recibe el evento, verifica su firma, reconoce un reintento (Wompi manda hasta
// 3 en 24 h ante cualquier respuesta que no sea 200 — WOMPI-REGLAS-IMPLEMENTACION-1)
// y cierra el `PaymentIntent` correspondiente. Cuando el desenlace es APROBADO,
// crea el `Payment` — con la Order LOCKEADA, como los otros tres llamadores de
// `registerOrderPaymentTx` (WOMPI-PAYMENT-DESDE-WEBHOOK-G-1). El enum `MetodoPago`
// ya tiene `WOMPI` (WOMPI-ENUM-METODO-F-1); la frontera que `WOMPI-WEBHOOK-RUTA-1`
// dejó pendiente por eso queda cerrada.
//
// LA LÓGICA DE DINERO DEL CAMINO APROBADO (lockear, pagar o detectar cobro
// duplicado) vive en `aplicarResultadoWompi` (`@duna/core/pagos/aplicar-
// resultado-wompi`) — extraída para que el reconciliador (h)+(i)
// (`packages/core/src/pagos/reconciliador.ts`) la COMPARTA en vez de
// duplicarla (WOMPI-RECONCILIADOR-HI-1). Esta ruta la LLAMA; no la
// reimplementa. El camino FALLIDO se queda acá, sin cambios: no toma ninguna
// decisión de dinero (no hay lock que tomar), así que no hay lógica que
// compartir.
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

/** La fila de `PaymentIntent` en lo mínimo que este módulo necesita leer.
 *  `orden_id` es NUEVO (WOMPI-PAYMENT-DESDE-WEBHOOK-G-1): es lo que deja saber a
 *  QUÉ Order lockear cuando el desenlace es APROBADO. */
export interface PaymentIntentRow {
  id: string;
  orden_id: string;
  estado: 'EN_VUELO' | 'APROBADO' | 'FALLIDO';
  monto_esperado: number;
  pspTransactionId: string | null;
}

// `OrdenLockeada`, `NotificacionAtencion` y `PaymentIntentTx` se importan de
// `@duna/core/pagos/aplicar-resultado-wompi` (arriba) — antes vivían acá,
// movidas junto con la lógica de dinero que las usa (WOMPI-RECONCILIADOR-HI-1).

/**
 * El cliente de `PaymentIntent` que este módulo necesita — una interfaz ANGOSTA y
 * estructural, no el `PrismaClient` completo. El test le pasa un doble en memoria;
 * `POST` arma un adaptador sobre el `prisma` real (`dbReal`, más abajo) que la
 * satisface. Achicar la interfaz a lo que se usa es lo que vuelve posible testear
 * la ruta ENTERA (`POST` → `Response`) sin una base real.
 */
export interface PaymentIntentDb {
  paymentIntent: {
    findUnique(args: { where: { reference: string } }): Promise<PaymentIntentRow | null>;
    /** Usado SÓLO por el bucket FALLIDO — no toca la Order, no abre transacción,
     *  como antes de este slice. Transición condicional en UNA sentencia — mismo
     *  patrón que `sellar()` en `packages/core/src/comprobantes.ts`: `count === 0`
     *  ⇒ alguien más ya lo cerró entre la lectura y esta escritura. */
    updateMany(args: {
      where: { id: string; estado: 'EN_VUELO' };
      data: {
        pspTransactionId: string;
        estado: 'APROBADO' | 'FALLIDO';
        estado_crudo_psp: string;
      };
    }): Promise<{ count: number }>;
  };
  /**
   * SÓLO la usa el bucket APROBADO. Lockea la Order (`FOR UPDATE`) y corre `fn`
   * con esa fila releída — el mismo patrón que los otros tres llamadores de
   * `registerOrderPaymentTx` ya siguen (`app/api/orders/[id]/payments/route.ts`,
   * `decidirComprobante`, `immediatePayment`). Sin el lock, dos APROBADO
   * concurrentes de la MISMA orden leerían ambos `pendiente` y crearían dos
   * Payments — es la única forma de que el cobro duplicado (§2 del spec) sea
   * detectable en vez de silenciosamente doble.
   */
  transaccionConOrdenLockeada<T>(
    ordenId: string,
    fn: (orden: OrdenLockeada | null, tx: PaymentIntentTx) => Promise<T>,
  ): Promise<T>;
  /**
   * Post-commit, fire-and-forget — el carril de atención para lo que el webhook
   * detecta pero no puede resolver solo: un cobro duplicado (devolver es un acto
   * humano) o un monto que no coincide con lo esperado. Inyectable para que el
   * test no dependa de Postgres real (`createNotification` real escribe en
   * `Notification`). Nunca se llama DENTRO de `transaccionConOrdenLockeada`: una
   * notificación nunca debe poder abortar ni demorar el cierre del cobro (mismo
   * principio que `notifyOrderCreated` en `createOrderWithCustomer`,
   * packages/core/src/orders.ts).
   */
  notificarAtencion(input: NotificacionAtencion): Promise<void>;
}

// `bucketDeStatus` se importa de `@duna/core/pagos/aplicar-resultado-wompi`
// (arriba) — antes vivía acá, privada; ahora es compartida con el
// reconciliador (WOMPI-RECONCILIADOR-HI-1).

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
    // ACÁ SÍ AYUDA REINTENTAR — es la excepción a la regla general de este archivo
    // (WOMPI-WEBHOOK-RACE-REINTENTO-1). El caso es una CARRERA, no un dato roto: la
    // fila de `PaymentIntent` la crea la etapa que INICIA el checkout, y el webhook
    // puede llegar un instante ANTES de que esa fila exista. Con 200 le diríamos a
    // Wompi «ya está, no vuelvas» — y la fila puede aparecer un segundo después,
    // dentro de la ventana de reintentos (30 min / 3 h / 24 h,
    // WOMPI-REGLAS-IMPLEMENTACION-1). Un 200 acá pierde un pago aprobado EN
    // SILENCIO, que es justo lo que la reconciliación existe para evitar.
    //
    // CÓDIGO ELEGIDO: 404. Es HONESTO — el servidor de verdad no tiene esa
    // referencia, todavía — y es un 4xx, no un 5xx: no se lee como "el sistema está
    // roto" en el dashboard de funciones de Vercel, que es justo la distinción que
    // el log de abajo también hace (warn, no error).
    // DESCARTADO 503/500: habrían disparado la MISMA retransmisión, pero un 5xx se
    // confunde con una falla real del servidor cuando acá no hay ninguna.
    // DESCARTADO 409: no hay conflicto de estado, hay AUSENCIA — la fila
    // simplemente no existe todavía.
    //
    // LA ASIMETRÍA QUE DECIDE: una referencia genuinamente ajena o inventada se
    // reintenta 3 veces y se acaba — inofensivo. El costo de NO reintentar es un
    // pago aprobado perdido en silencio. Reintentar de más es barato; reintentar de
    // menos es plata.
    console.warn(
      `[wompi-webhook] referencia sin match (aún): ${reference} — carrera esperada contra el` +
        ` alta del checkout, no un bug; se responde no-200 para que Wompi reintente`,
    );
    return { status: 404, motivo: 'referencia sin match' };
  }

  // EL MONTO NO DECIDE NADA ACÁ — sólo se compara y se registra si difiere. El
  // monto de un `Payment`, cuando se crea, es el CONFIRMADO por Wompi (abajo),
  // nunca `monto_esperado` — ese es sólo el snapshot al crear el intento. Acá la
  // discrepancia es información: se registra siempre, y si termina pagando una
  // orden (bucket APROBADO sobre una orden `pendiente`, más abajo) además avisa
  // al carril de atención — una orden pagada por un monto distinto al esperado es
  // plata a mirar a mano.
  const discrepanciaDeMonto = montoPesos !== null && montoPesos !== intent.monto_esperado;
  if (discrepanciaDeMonto) {
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

  if (bucket === 'FALLIDO') {
    // FALLIDO no toca la Order ni crea nada: cierra el intento, punto. Sin
    // transacción — el mismo `updateMany` de siempre, no hay lock que tomar
    // porque no hay decisión de dinero que proteger.
    try {
      const { count } = await db.paymentIntent.updateMany({
        where: { id: intent.id, estado: 'EN_VUELO' },
        data: { pspTransactionId, estado: 'FALLIDO', estado_crudo_psp: status },
      });
      if (count === 0) {
        // Perdió la carrera: otra entrega concurrente ya cerró este intento entre
        // nuestra lectura y esta escritura.
        return { status: 200, motivo: 'cerrado por otra entrega concurrente' };
      }
    } catch (e) {
      if (isUniqueViolation(e)) {
        console.error(`[wompi-webhook] pspTransactionId ${pspTransactionId} ya pertenece a otro intento`);
        return { status: 200, motivo: 'id de transacción ya asentado en otro intento' };
      }
      throw e;
    }
    return { status: 200, motivo: 'cerrado fallido' };
  }

  // bucket === 'APROBADO'. Acá es donde el hecho de Wompi puede convertirse en
  // plata — y por eso, a diferencia de FALLIDO, corre CON la Order lockeada.
  // La lógica (lockear, pagar o detectar cobro duplicado, el `isUniqueViolation`
  // del choque de `pspTransactionId`) vive en `aplicarResultadoWompi`
  // (compartida con el reconciliador, WOMPI-RECONCILIADOR-HI-1) — esta ruta
  // sólo la invoca y despacha la notificación que devuelve, post-commit (nunca
  // adentro: una notificación no puede demorar ni abortar el cierre del cobro,
  // mismo principio que `notifyOrderCreated` post-commit en `createOrderWithCustomer`).
  const resultado = await aplicarResultadoWompi(
    { id: intent.id, orden_id: intent.orden_id, monto_esperado: intent.monto_esperado },
    pspTransactionId,
    status,
    montoPesos,
    hrefOrden,
    db,
  );

  if (resultado.notificar) {
    try {
      await db.notificarAtencion(resultado.notificar);
    } catch (e) {
      // Guardado: una notificación que falla no puede volver a intentar la
      // transacción de dinero, que ya comiteó. Se deja rastro y se sigue.
      console.error(`[wompi-webhook] no se pudo notificar al carril de atención (${resultado.notificar.tipo}):`, e);
    }
  }

  return { status: 200, motivo: resultado.motivo };
}

/**
 * El adaptador sobre el `prisma` real que satisface `PaymentIntentDb` — la ÚNICA
 * instancia que `POST` usa. `lockOrderForPayment`/`registerOrderPaymentTx` vienen
 * de `packages/core/src/orders.ts` (el mismo módulo de `registerOrderPaymentTx`);
 * `createNotification`, de `packages/core/src/notifications/admin.ts` — la campana
 * del operador, sin almacén propio.
 */
const dbReal: PaymentIntentDb = {
  paymentIntent: {
    findUnique: (args) => prisma.paymentIntent.findUnique(args),
    updateMany: (args) => prisma.paymentIntent.updateMany(args),
  },
  transaccionConOrdenLockeada: (ordenId, fn) =>
    prisma.$transaction(async (tx) => {
      const orden = await lockOrderForPayment(tx, ordenId);
      return fn(orden, {
        paymentIntent: { updateMany: (args) => tx.paymentIntent.updateMany(args) },
        registrarPago: async ({ monto, referencia }) => {
          await registerOrderPaymentTx(tx, ordenId, { monto, metodo: 'WOMPI', referencia });
        },
      });
    }),
  notificarAtencion: (input) => createNotification(input),
};

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
  const { status, motivo } = await procesarEventoWompi(evento, checksumHeader, secretoEventos, dbReal);
  return NextResponse.json({ ok: status === 200, motivo }, { status });
}
