import type { Prisma } from '@duna/core';

// El ÚNICO escritor del libro de transiciones (OrderStatusTransition). Lo llaman
// los CINCO funnels DENTRO de su transacción: el asiento y el cambio de estado
// commitean juntos o no commitean — un libro con huecos no es un libro.
//
// Fase 2A: DEFINIDO pero aún SIN LLAMAR desde ningún escritor (cero cambio de
// comportamiento). Fase 2B lo cablea en los cinco puntos, cada uno en su tx.

export type TransitionEje = 'cobro' | 'fulfillment';

export interface TransitionActor {
  /** Snapshot sin FK — id de quien ejecutó. `null` = sin humano detrás. */
  id?: string | null;
  /** Snapshot sin FK — nombre congelado; sobrevive a que el usuario se borre. */
  nombre?: string | null;
}

export interface AppendTransitionInput {
  ordenId: string;
  eje: TransitionEje;
  /** `null` = CREACIÓN: la orden nace sin estado previo. */
  estadoAnterior: string | null;
  estadoNuevo: string;
  actor?: TransitionActor;
  /** Momento del hecho — la clave de orden de la timeline. Default: ahora. */
  occurredAt?: Date;
}

/**
 * Añade UN asiento al libro. Recibe el `tx` del llamador: el asiento vive en la
 * MISMA transacción que el cambio de estado que lo motiva. Nunca fuera.
 */
export async function appendOrderStatusTransition(
  tx: Prisma.TransactionClient,
  input: AppendTransitionInput,
): Promise<void> {
  await tx.orderStatusTransition.create({
    data: {
      orden_id:        input.ordenId,
      eje:             input.eje,
      estado_anterior: input.estadoAnterior,
      estado_nuevo:    input.estadoNuevo,
      actor_id:        input.actor?.id ?? null,
      actor_nombre:    input.actor?.nombre ?? null,
      ...(input.occurredAt ? { occurred_at: input.occurredAt } : {}),
    },
  });
}
