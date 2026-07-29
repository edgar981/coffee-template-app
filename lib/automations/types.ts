import type { DispatchRequest } from './channels/types';

// Contrato entre el motor y los handlers. Vive aparte para que handlers ↔ engine
// no se importen en círculo.

/**
 * Los EVENTOS de negocio que pueden disparar una automatización. Los emiten los
 * code paths de negocio DESPUÉS del commit; nunca dentro de una transacción.
 *
 * `stock.cruzo_minimo` lo emite quien MUEVE el stock, no un barrido: sólo el que
 * hizo el cambio conoce el valor de antes, y el disparador es el CRUCE del umbral,
 * no el estado "está bajo" (que sería cierto en cada despacho posterior).
 */
export type AutomationEvent =
  | { tipo: 'order.pagado';        orderId: string }
  | { tipo: 'shipping.entregado';  shippingId: string; orderId: string }
  | { tipo: 'stock.cruzo_minimo';  productoId: string };

export type AutomationEventTipo = AutomationEvent['tipo'];

/**
 * Un target resuelto por un handler: o hay algo que despachar, o hay una razón
 * para omitirlo. Ambos casos producen un AutomationRun — un intento sin rastro es
 * un intento que se repite, y "no tenía teléfono" es información que el owner
 * quiere poder ver.
 */
export type Objetivo =
  | { targetId: string; dispatch: DispatchRequest }
  | { targetId: string; omitir: string };

export interface HandlerCtx {
  /** Configuración efectiva: defaults del registry + overrides del owner. */
  config: Record<string, unknown>;
  now:    Date;
}

/** Handler de evento: decide si ESTE evento le concierne y a quién apunta. */
export type EventHandler = (
  event: AutomationEvent,
  ctx: HandlerCtx,
) => Promise<Objetivo | null>;

/** Handler programado: devuelve TODOS los targets que hoy cumplen la condición. */
export type ScheduledHandler = (ctx: HandlerCtx) => Promise<Objetivo[]>;

export function esOmitido(o: Objetivo): o is { targetId: string; omitir: string } {
  return 'omitir' in o;
}
