import { MetodoPago } from "./payment";

// ShippingEstado covers the FULFILLMENT lifecycle only (Order.status owns
// payment). A shipping is auto-created in `preparando` when its order is paid;
// the operator then schedules (zona/courier/date) and advances the state.
// `cancelado` is terminal — set only when the Order is cancelled (never by the
// operator, never deleted), kept as an auditable "delivery voided" trail.
export type ShippingEstado =
  | 'preparando'
  | 'en_ruta'
  | 'entregado'
  | 'fallido'
  | 'cancelado';

export type ShippingZona =
  | 'norte'
  | 'sur'
  | 'centro'
  | 'occidente'
  | 'oriente'
  | 'exterior';

/** LOCAL = mensajero propio; NACIONAL = transportadora + número de guía. */
export type TipoEnvio = 'LOCAL' | 'NACIONAL';

export const TIPO_ENVIO_LABEL: Record<TipoEnvio, string> = {
  LOCAL:    'Local',
  NACIONAL: 'Nacional',
};

// Order-owned fields read through the Shipping → Order relation — the single
// source of truth, INCLUDING the delivery address (the Shipping no longer keeps
// its own copy).
export interface ShippingOrderRef {
  numero_orden:      string;
  cliente_nombre:    string | null;
  cliente_telefono:  string | null;
  direccion_entrega: string | null;
  ciudad_entrega:    string | null;
  // Payment state of the order (Entregas shows a Pagada / Pendiente de cobro
  // badge — whoever delivers must know whether to collect). Kept as string to
  // avoid a types cycle with order.ts (which already imports from here).
  estado:            string;
  // Condición de pago (badge Contraentrega en el board). String por la misma
  // razón de arriba (order.ts importa de aquí).
  condicion_pago:    string;
  // Declared payment intent, so an unpaid delivery can show "cobrar al entregar:
  // Efectivo". Either the typed admin field or the legacy checkout string.
  metodoPagoPrevisto: MetodoPago | null;
  metodo_pago:        string | null;
}

export interface Shipping {
  id:               string;
  orden_id:         string;
  order?:           ShippingOrderRef | null;
  // The delivery address lives on the Order (read `order.direccion_entrega` /
  // `order.ciudad_entrega`) — the Shipping keeps no copy.
  // Zona and courier start empty; the operator fills them when scheduling.
  zona?:            ShippingZona | null;
  // Lo que la heurística de dirección sugirió al programar (auditoría: una
  // corrección del operador es `zona_sugerida !== zona`). Nunca se muestra como
  // si fuera la zona real.
  zona_sugerida?:   ShippingZona | null;
  estado:           ShippingEstado;
  // Snapshot of the order's costo_envio (source of truth is Order.costo_envio).
  costo_envio:      number;
  mensajero?:       string | null;
  notas_entrega?:   string | null;
  fecha_programada?: string | null;
  fecha_entrega?:   string | null;
  // LOCAL (default) o NACIONAL; los campos de guía aplican cuando NACIONAL.
  tipo_envio:       TipoEnvio;
  transportadora?:  string | null;
  numero_guia?:     string | null;
  // Marcador de idempotencia del descuento de stock al despachar (server-owned).
  stock_descontado_at?: string | null;
  createdAt:        string;
  updatedAt:        string;
}

export type ShippingFilter  = 'all' | ShippingEstado;

// The fields an operator edits when scheduling an already-existing (auto-created)
// delivery. Zona la elige el operador en el Select — la heurística solo
// PRE-SELECCIONA y viaja aparte en zona_sugerida (auditoría).
export interface ScheduleDeliveryInput {
  zona:              ShippingZona;
  zona_sugerida?:    ShippingZona | null;
  mensajero?:        string | null;
  fecha_programada?: string | null;
  notas_entrega?:    string | null;
  estado?:           ShippingEstado;
  // LOCAL/NACIONAL; transportadora + guía se usan cuando NACIONAL.
  tipo_envio?:       TipoEnvio;
  transportadora?:   string | null;
  numero_guia?:      string | null;
}
