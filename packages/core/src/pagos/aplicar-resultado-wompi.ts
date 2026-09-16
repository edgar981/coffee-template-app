import { isUniqueViolation } from '../orders';

// ── APLICAR UN RESULTADO TERMINAL DE WOMPI SOBRE UN PaymentIntent ───────────
//
// La lógica de dinero de (g) —el webhook— EXTRAÍDA para que el reconciliador
// (h)+(i) (`packages/core/src/pagos/reconciliador.ts`) la COMPARTA en vez de
// duplicarla (WOMPI-RECONCILIADOR-HI-1). Es la ÚNICA pieza que decide si un
// APROBADO de Wompi se convierte en un `Payment`: lockea la Order (`SELECT …
// FOR UPDATE`, `lockOrderForPayment`) y, si está `pendiente`, paga
// (`registerOrderPaymentTx`, el escritor único de dinero — WOMPI-PAYMENT-
// DESDE-WEBHOOK-G-1 lo hizo su CUARTO llamador); si ya estaba pagada, es un
// COBRO DUPLICADO: el hecho de Wompi se asienta igual, pero NO nace un
// segundo Payment ni se reabre la orden — se devuelve una notificación para
// el carril de atención (devolver plata es un acto humano).
//
// FALLIDO NO PASA POR ACÁ. Cerrar un intento FALLIDO —por veredicto de Wompi
// o por vencimiento de edad— no toma ninguna decisión de dinero: no hay lock
// que tomar porque no hay nada que proteger. Cada llamador (el webhook, el
// reconciliador) sigue cerrándolo con su propio `paymentIntent.updateMany`
// —trivial, sin lógica que compartir— tal como el webhook ya lo hacía antes
// de esta extracción. Meter FALLIDO acá habría forzado un lock de Order
// también en ese camino, algo que nadie pidió y que el comentario original de
// route.ts documentaba explícitamente como innecesario.
//
// EL `notificar` SE DEVUELVE, NUNCA SE ENVÍA ACÁ DENTRO: una notificación no
// puede demorar ni abortar el cierre del cobro (mismo principio que
// `notifyOrderCreated` post-commit en `createOrderWithCustomer`). Cada
// llamador decide CUÁNDO mandarla — siempre después de que la transacción
// confirme.
//
// LA DISCREPANCIA DE MONTO (evento vs. `monto_esperado`) NO se registra acá:
// en el webhook original (`route.ts`) ese log corre ANTES de la rama
// APROBADO/FALLIDO, para TODO evento con status terminal — incluido un
// FALLIDO con monto discrepante. Moverlo adentro de esta función lo habría
// acotado sólo al camino APROBADO, cambiando ese comportamiento en silencio.
// Cada llamador sigue logueándolo por su cuenta, con el mismo criterio.

/** Lo mínimo de la Order, ya LOCKEADA (`FOR UPDATE`), que decide si un
 *  APROBADO crea plata o es un cobro duplicado. */
export interface OrdenLockeada {
  estado: string;
  total: number;
  numero_orden: string;
}

/** Lo que el carril de atención necesita para una notificación (cobro
 *  duplicado, monto discrepante) — la misma forma que `Notification` en
 *  `schema.prisma`. */
export interface NotificacionAtencion {
  tipo: string;
  titulo: string;
  mensaje: string;
  href: string;
}

/** Lo que esta función necesita DENTRO de la transacción con la Order ya
 *  lockeada: cerrar el intento (mismo contrato que `paymentIntent.updateMany`
 *  de `AplicarResultadoDb`, abajo) y crear el Payment por el ÚNICO escritor
 *  de dinero. */
export interface PaymentIntentTx {
  paymentIntent: {
    updateMany(args: {
      where: { id: string; estado: 'EN_VUELO' };
      data: { pspTransactionId: string; estado: 'APROBADO'; estado_crudo_psp: string };
    }): Promise<{ count: number }>;
  };
  /** `registerOrderPaymentTx` como llamador — el monto es el que Wompi
   *  CONFIRMÓ, nunca `monto_esperado`. */
  registrarPago(input: { monto: number; referencia: string }): Promise<void>;
}

/**
 * La interfaz ANGOSTA que esta función necesita de su llamador — el mismo
 * criterio estructural que `PaymentIntentDb` en `route.ts`: angosta a lo que
 * se usa, no el `PrismaClient` completo, para que un doble en memoria pueda
 * satisfacerla en un test sin base. SÓLO `transaccionConOrdenLockeada`: esta
 * función nunca escribe FUERA de esa transacción, así que no declara un
 * `paymentIntent.updateMany` de nivel superior que no usaría — cada llamador
 * (el webhook, el reconciliador) declara el suyo, más ancho, para su propio
 * camino FALLIDO (que esta función no toca — ver la cabecera del archivo).
 */
export interface AplicarResultadoDb {
  /**
   * Lockea la Order (`FOR UPDATE`) y corre `fn` con esa fila releída — el
   * mismo patrón que los llamadores de producción de `registerOrderPaymentTx`
   * ya siguen. Sin el lock, dos APROBADO concurrentes de la MISMA orden
   * leerían ambos `pendiente` y crearían dos Payments.
   */
  transaccionConOrdenLockeada<T>(
    ordenId: string,
    fn: (orden: OrdenLockeada | null, tx: PaymentIntentTx) => Promise<T>,
  ): Promise<T>;
}

export interface ResultadoAplicarWompi {
  motivo: string;
  notificar: NotificacionAtencion | null;
}

/**
 * Bucket DERIVADO del status crudo de Wompi, medido contra NUESTRAS
 * decisiones (§ CLAUDE.md, `PaymentIntentEstado` en schema.prisma) y no
 * contra el catálogo crudo del PSP: `APPROVED` cierra `APROBADO`;
 * `DECLINED`/`VOIDED`/`ERROR` cierran `FALLIDO`. Cualquier otro valor
 * (`PENDING`, o uno que Wompi agregue mañana) NO es terminal — devuelve
 * `null`: preferir callar a decidir sin base. Compartido por el webhook (g) y
 * el reconciliador (h)+(i) — antes vivía privado en `route.ts`.
 */
export function bucketDeStatus(status: string): 'APROBADO' | 'FALLIDO' | null {
  if (status === 'APPROVED') return 'APROBADO';
  if (status === 'DECLINED' || status === 'VOIDED' || status === 'ERROR') return 'FALLIDO';
  return null;
}

/**
 * Aplica un APROBADO de Wompi sobre un `PaymentIntent`: lockea su Order y
 * decide, bajo el lock, si paga o si es un cobro duplicado. `intent` es lo
 * mínimo que hace falta identificar (no la fila completa — el llamador ya la
 * tiene). `hrefOrden` se recibe INYECTADO porque vive en `constants/
 * automations.ts` (nivel app) y este módulo es de `packages/core`, que no
 * importa de `lib/` ni de `constants/` (medido: cero imports runtime de `@/`
 * fuera de `import type` en todo `packages/core/src`, antes de este slice).
 */
export async function aplicarResultadoWompi(
  intent: { id: string; orden_id: string; monto_esperado: number },
  pspTransactionId: string,
  estadoCrudoPsp: string,
  montoConfirmado: number | null,
  hrefOrden: (numeroOrden: string) => string,
  db: AplicarResultadoDb,
): Promise<ResultadoAplicarWompi> {
  // `notificar` se resuelve DENTRO del closure de la transacción y se lee
  // DESPUÉS de que el `await` resuelva. TS narrowea la variable a `null` a
  // través del `await` porque su ÚNICA reasignación visible en este scope es
  // el closure — el `as` de abajo (no sólo el `const`) es lo que hace falta
  // (medido con `tsc`, mismo defecto que documentaba `route.ts` antes de
  // esta extracción).
  let notificar: NotificacionAtencion | null = null;

  let resultado: { motivo: string };
  try {
    resultado = await db.transaccionConOrdenLockeada(intent.orden_id, async (orden, tx) => {
      if (!orden) {
        // No debería pasar — `PaymentIntent.orden_id` tiene FK a `Order` —
        // pero preferir callar y dejar rastro a asumir una fila que no está.
        console.error(
          `[wompi] PaymentIntent ${intent.id} apunta a una Order inexistente (${intent.orden_id})`,
        );
        return { motivo: 'orden del intento no encontrada' };
      }

      const { count } = await tx.paymentIntent.updateMany({
        where: { id: intent.id, estado: 'EN_VUELO' },
        data: { pspTransactionId, estado: 'APROBADO', estado_crudo_psp: estadoCrudoPsp },
      });
      if (count === 0) {
        // Perdió la carrera: otra entrega concurrente (el webhook, el
        // reconciliador, u otra corrida del mismo) ya cerró este intento
        // entre la lectura y esta escritura — incluso bajo el lock de la
        // Order, porque dos entregas pueden procesarse una tras otra.
        return { motivo: 'cerrado por otra entrega concurrente' };
      }

      // EL MONTO ES EL QUE WOMPI CONFIRMÓ — nunca `monto_esperado`, que es
      // sólo el snapshot al crear el intento. Si no hay un número utilizable
      // (forma inesperada), `monto_esperado` es el mejor valor disponible.
      const monto = montoConfirmado ?? intent.monto_esperado;
      if (montoConfirmado === null) {
        console.error(
          `[wompi] aprobado sin monto confirmado utilizable en el intento ${intent.id} — se usa` +
            ` el monto esperado ($${intent.monto_esperado}) como mejor valor disponible`,
        );
      }

      if (orden.estado !== 'pendiente') {
        // COBRO DUPLICADO: la orden YA está pagada. El hecho de Wompi es
        // real y el intento se cierra igual (arriba), pero NO se crea un
        // segundo Payment ni se reabre la orden. Devolver el dinero es un
        // acto humano — se avisa al carril de atención, post-commit.
        notificar = {
          tipo: 'wompi_cobro_duplicado',
          titulo: 'Cobro duplicado de Wompi',
          mensaje:
            `Wompi confirmó un pago de $${monto.toLocaleString('es-CO')} sobre la orden` +
            ` ${orden.numero_orden}, que ya estaba pagada. Verificar si corresponde devolver el dinero.`,
          href: hrefOrden(orden.numero_orden),
        };
        return { motivo: 'cerrado aprobado (cobro duplicado)' };
      }

      // PRIMER APROBADO sobre una orden pendiente: acá es donde el hecho de
      // Wompi se vuelve un Payment.
      await tx.registrarPago({ monto, referencia: pspTransactionId });

      if (montoConfirmado !== null && montoConfirmado !== intent.monto_esperado) {
        notificar = {
          tipo: 'wompi_monto_discrepante',
          titulo: 'Wompi cobró un monto distinto al esperado',
          mensaje:
            `La orden ${orden.numero_orden} esperaba $${intent.monto_esperado.toLocaleString('es-CO')}` +
            ` y Wompi confirmó $${monto.toLocaleString('es-CO')}. La orden ya quedó pagada por el` +
            ` monto confirmado; revisar si corresponde ajustar.`,
          href: hrefOrden(orden.numero_orden),
        };
      }
      return { motivo: 'cerrado aprobado' };
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      // El id de transacción ya está asentado en OTRA fila de `PaymentIntent`
      // — la unique que sostiene la idempotencia (PASARELA-DOC-AL-DIA-1). El
      // choque ocurre ANTES de crear ningún Payment (la transacción entera se
      // revierte).
      console.error(`[wompi] pspTransactionId ${pspTransactionId} ya pertenece a otro intento`);
      return { motivo: 'id de transacción ya asentado en otro intento', notificar: null };
    }
    throw e;
  }

  const aNotificar = notificar as NotificacionAtencion | null;
  return { motivo: resultado.motivo, notificar: aNotificar };
}
