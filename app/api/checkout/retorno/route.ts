import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@duna/core';
import { rateLimit } from '@duna/core/rate-limit';

// ── LA RUTA DE RETORNO — LEE, NUNCA AFIRMA POR SÍ MISMA ─────────────────────────
//
// El comprador vuelve del checkout alojado de Wompi a `/checkout/retorno` (la
// constante `RUTA_RETORNO_WOMPI`, `components/storefront/checkout/PagoPasarela.tsx`)
// con lo que Wompi le ponga en el query — que puede incluir un `status`. ESTE
// ENDPOINT NO LO LEE NI LO CONFIRMA: la verdad es `PaymentIntent.estado`, que sólo
// el webhook (`app/api/webhooks/wompi/route.ts`) actualiza. Ver § Pagos en línea
// (Wompi) — CLAUDE.md, y § 0 del spec de este slice (WOMPI-RUTA-DE-RETORNO-1).
//
// PÚBLICA Y SIN SESIÓN — el comprador vuelve sin estar logueado —, así que exige el
// MISMO segundo factor que `/api/orders/track` (`reference` + `email` tecleado): la
// `reference` sola (`<numero_orden>:<cuid>`, § `referenciaIntentoPago`,
// `packages/core/src/orders.ts`) viaja en una URL de retorno que un tercero podría
// leer por historial, referrer o analítica — no puede revelar el estado de un pago
// ajeno sin que el comprador confirme además el correo de su compra.
//
// DEVUELVE ÚNICAMENTE `estado` + `numero_orden` — nada de monto, datos del cliente
// ni `pspTransactionId` (§1 y §2 del slice). Cualquier fallo (referencia inexistente,
// orden sin `cliente_email`, o email que no coincide) responde el MISMO 404 genérico
// que `/api/orders/track`, para no dar un oráculo de enumeración.
//
// EL LECTOR SE INYECTA (`RetornoIntentoDb`), mismo criterio que `PaymentIntentDb` del
// webhook: una interfaz ANGOSTA y estructural, no el `PrismaClient` completo, para
// poder testear `resolverRetorno` sin una base real — el carril rápido cubre `app/**`
// y tiene que ser DB-FREE (§ CLAUDE.md, "El carril rápido cubre app").

export const dynamic = 'force-dynamic';

const retornoSchema = z.object({
  reference: z.string().trim().min(1),
  email:     z.string().trim().email(),
});

const NOT_FOUND_BODY = { error: 'No encontrado' } as const;

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

/** La fila que este módulo necesita leer: el estado del intento, y del lado de la
 *  orden asociada — `numero_orden` para la respuesta, `cliente_email` para el
 *  segundo factor. `order` nunca es null: `PaymentIntent.orden_id` es una FK
 *  requerida (`packages/core/prisma/schema.prisma`). */
export interface RetornoIntentoRow {
  estado: 'EN_VUELO' | 'APROBADO' | 'FALLIDO';
  order: {
    numero_orden:  string;
    cliente_email: string | null;
  };
}

/** El cliente de `PaymentIntent` que este módulo necesita — angosta y estructural,
 *  como `PaymentIntentDb` en el webhook: SÓLO `where.reference`, sin `select` en la
 *  firma. El `select` que trae el join con `order` queda ENCERRADO dentro del
 *  adaptador real (`dbReal`, abajo) — así la interfaz no tiene que reproducir el
 *  tipo de `PaymentIntentSelect` de Prisma para que la asignación tipe limpio, y el
 *  test le pasa un doble en memoria con SÓLO este método. */
export interface RetornoIntentoDb {
  paymentIntent: {
    findUnique(args: { where: { reference: string } }): Promise<RetornoIntentoRow | null>;
  };
}

/** El adaptador real: la MISMA forma que `RetornoIntentoDb` pide, con el `select`
 *  del join ENCERRADO adentro — nunca expuesto en la firma inyectable. */
const dbReal: RetornoIntentoDb = {
  paymentIntent: {
    findUnique: ({ where }) =>
      prisma.paymentIntent.findUnique({
        where,
        select: { estado: true, order: { select: { numero_orden: true, cliente_email: true } } },
      }),
  },
};

export interface ResultadoRetorno {
  status: number;
  body:
    | { estado: RetornoIntentoRow['estado']; numero_orden: string }
    | { error: string };
}

/**
 * El camino, inyectable por `db` para testear sin Postgres (ver cabecera del
 * archivo). Verifica que el `email` tecleado coincide con el de la orden dueña de
 * la `reference` — comparación normalizada (trim + lowercase), mismo criterio que
 * `/api/orders/track` — y sólo entonces devuelve el estado crudo del intento (nunca
 * lo reinterpreta ni lo fuerza a un valor "amigable": los TRES estados de
 * `PaymentIntentEstado` viajan tal cual, y es el CLIENTE (la pantalla) quien decide
 * qué hacer con `EN_VUELO`, incluido el backoff — §3 del slice).
 */
export async function resolverRetorno(
  input: { reference: string; email: string },
  db: RetornoIntentoDb,
): Promise<ResultadoRetorno> {
  const intent = await db.paymentIntent.findUnique({ where: { reference: input.reference } });

  if (
    !intent ||
    !intent.order.cliente_email ||
    intent.order.cliente_email.trim().toLowerCase() !== input.email.trim().toLowerCase()
  ) {
    return { status: 404, body: NOT_FOUND_BODY };
  }

  return {
    status: 200,
    body: { estado: intent.estado, numero_orden: intent.order.numero_orden },
  };
}

export async function POST(req: NextRequest) {
  // Rate-limit por IP: el comprador legítimo hace POLLING con backoff (2, 4, 8, 16,
  // 30s… §3 del slice), así que el límite tiene que tolerar esa cadencia sin
  // castigar el uso normal. En el peor caso del backoff (EN_VUELO todo el tiempo)
  // caben ~6 pedidos en cualquier ventana de 60s; 20 deja margen generoso para dos
  // pestañas o una IP compartida (NAT) sin abrir la puerta a fuerza bruta de
  // email para una `reference` conocida.
  const rl = rateLimit(`retorno-wompi:${clientIp(req)}`, { limit: 20, windowMs: 60_000 });
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
    return NextResponse.json(NOT_FOUND_BODY, { status: 404 });
  }

  const parsed = retornoSchema.safeParse(raw);
  // Falta o email/reference con forma inválida → la MISMA respuesta genérica que un
  // mismatch real (mismo criterio que `/api/orders/track`): no hay oráculo que diga
  // cuál de los dos campos estaba mal.
  if (!parsed.success) {
    return NextResponse.json(NOT_FOUND_BODY, { status: 404 });
  }

  const resultado = await resolverRetorno(parsed.data, dbReal);
  return NextResponse.json(resultado.body, { status: resultado.status });
}
