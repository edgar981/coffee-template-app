import prisma, { TipoEnvio } from '@duna/core';
import { dispatchStockDecrement, restockShippingStock } from '@duna/core/fulfillment';
import { markContraentregaAtDispatch } from '@duna/core/orders';
import { appendOrderStatusTransition, type TransitionActor } from '@duna/core/order-transitions';

// ─── LA TRANSICIÓN DE ENVÍO, BAJO LOCK ───────────────────────────────────────
//
// El núcleo transaccional del PATCH de shippings, EXTRAÍDO del route por el mismo
// motivo que `aplicarAjusteInventario`: para poder afirmar su CONCURRENCIA en el
// carril, que es donde estaba el defecto. El route monta HTTP (auth, validaciones,
// notificaciones post-commit); esto es sólo la mutación que tiene que ser atómica.
//
// ── EL ORDEN DE ADQUISICIÓN DE LOCKS ES ORDEN → SHIPPING, SIEMPRE ────────────
//
// Se lockea la fila de la ORDEN, NUNCA la del shipping. TODO el eje de escritura del
// fulfillment adquiere en ese orden:
//   · este PATCH (acá);
//   · `transitionOrder` al cancelar (orders.ts: order.update → shipping.update);
//   · `registerOrderPaymentTx` / la verificación de comprobante (comprobantes.ts:149,
//     `SELECT … FROM "Order" … FOR UPDATE`).
//
// Lockear el SHIPPING primero invertiría el orden y DEADLOCKEARÍA con cancelar: un
// despacho-impago (que toca la orden vía `markContraentregaAtDispatch`) y un cancelar
// concurrentes sobre la misma orden se quedarían cada uno esperando el lock del otro.
// El próximo que agregue un escritor de shipping DEBE lockear la orden, no el shipping.
// Esto no es estilo: es la diferencia entre cerrar la carrera y abrir un deadlock.
//
// ── POR QUÉ LA RE-LECTURA FRESCA ────────────────────────────────────────────
//
// Los gates (`justDispatched`, etc.) se calculan sobre una lectura hecha DENTRO del
// lock, no sobre una pre-transacción. Dos requests concurrentes leían ambos
// `preparando` + `stock_descontado_at` null antes de que cualquiera commiteara, así
// que los dos pasaban el gate y descontaban stock DOS veces (dos asientos 'venta').
// Con el lock de la orden serializados, el segundo re-lee `en_ruta` + marcador puesto
// → `justDispatched` false y `dispatchStockDecrement` idempotente → un solo descuento.
// Es el mismo hueco de `FOR UPDATE` que la doctrina cerró para las dos puertas de stock
// (§ Las DOS puertas del stock), abierto en la que descuenta al despachar.

/** Campos del shipping que el operador puede escribir, YA normalizados por el route
 *  (`undefined` = no tocar; `null` explícito para zona_sugerida/transportadora/guía). */
export interface CamposEnvio {
  zona?:             string;
  zona_sugerida?:    string | null;
  mensajero?:        string;
  fecha_programada?: string;
  fecha_entrega?:    string;
  notas_entrega?:    string;
  tipo_envio?:       TipoEnvio;
  transportadora?:   string | null;
  numero_guia?:      string | null;
}

export interface AplicarTransicionEnvioInput {
  shippingId: string;
  ordenId:    string;
  /** `body.estado` — lo que el cliente pide. El gate REAL se re-computa fresco. */
  estadoDeseado?: string;
  /** ¿el request toca zona/mensajero/fecha? Decide el rescate fallido→preparando. */
  isScheduling: boolean;
  campos: CamposEnvio;
  actor: TransitionActor;
}

/** Los bordes que el route necesita DESPUÉS del commit para sus notificaciones. */
export interface TransicionEnvioResultado {
  justDispatched: boolean;
  justDelivered:  boolean;
  justFailed:     boolean;
  /** Productos que cruzaron su mínimo con este despacho (para el evento post-commit). */
  cruzaronMinimo: string[];
}

export async function aplicarTransicionEnvio(
  input: AplicarTransicionEnvioInput,
): Promise<TransicionEnvioResultado> {
  return prisma.$transaction(async (tx) => {
    // LOCK de la ORDEN (ver el bloque de arriba: Orden → Shipping, siempre).
    await tx.$queryRaw`SELECT 1 FROM "Order" WHERE "id" = ${input.ordenId} FOR UPDATE`;

    // Re-lectura FRESCA bajo el lock — los gates deciden sobre esto.
    const fresco = await tx.shipping.findUniqueOrThrow({
      where:   { id: input.shippingId },
      include: { order: { select: { estado: true, condicion_pago: true } } },
    });

    const nextEstado = input.isScheduling && fresco.estado === 'fallido'
      ? 'preparando'
      : (input.estadoDeseado ?? undefined);

    const justDispatched    = nextEstado === 'en_ruta'   && fresco.estado !== 'en_ruta';
    const dispatchingUnpaid = justDispatched && fresco.order?.estado !== 'pagado';
    const justFailed        = nextEstado === 'fallido'   && fresco.estado !== 'fallido';
    const justDelivered     = nextEstado === 'entregado' && fresco.estado !== 'entregado';

    let cruzaronMinimo: string[] = [];
    if (justDispatched) cruzaronMinimo = await dispatchStockDecrement(tx, fresco);
    if (dispatchingUnpaid && fresco.order?.condicion_pago !== 'CONTRAENTREGA') {
      await markContraentregaAtDispatch(tx, input.ordenId);
    }
    if (justFailed) await restockShippingStock(tx, fresco, 'Entrega fallida');

    await tx.shipping.update({
      where: { id: input.shippingId },
      data: {
        estado:           nextEstado,
        zona:             input.campos.zona ?? undefined,
        zona_sugerida:    input.campos.zona_sugerida !== undefined ? input.campos.zona_sugerida : undefined,
        mensajero:        input.campos.mensajero ?? undefined,
        fecha_programada: input.campos.fecha_programada ?? undefined,
        fecha_entrega:    justDelivered ? new Date().toISOString() : (input.campos.fecha_entrega ?? undefined),
        notas_entrega:    input.campos.notas_entrega ?? undefined,
        tipo_envio:       input.campos.tipo_envio ?? undefined,
        transportadora:   input.campos.transportadora !== undefined ? input.campos.transportadora : undefined,
        numero_guia:      input.campos.numero_guia !== undefined ? input.campos.numero_guia : undefined,
        updatedAt:        new Date(),
      },
    });

    // Asiento del eje FULFILLMENT, SÓLO si el estado cambió, en la misma tx.
    if (nextEstado && nextEstado !== fresco.estado) {
      await appendOrderStatusTransition(tx, {
        ordenId: input.ordenId, eje: 'fulfillment',
        estadoAnterior: fresco.estado, estadoNuevo: nextEstado, actor: input.actor,
      });
    }

    return { justDispatched, justDelivered, justFailed, cruzaronMinimo };
  });
}
