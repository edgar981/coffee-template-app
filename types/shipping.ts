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

// Order-owned fields read through the Shipping → Order relation — the single
// source of truth, INCLUDING the delivery address (the Shipping no longer keeps
// its own copy).
export interface ShippingOrderRef {
  numero_orden:      string;
  cliente_nombre:    string | null;
  cliente_telefono:  string | null;
  direccion_entrega: string | null;
  ciudad_entrega:    string | null;
}

export interface Shipping {
  id:               string;
  orden_id:         string;
  order?:           ShippingOrderRef | null;
  // The delivery address lives on the Order (read `order.direccion_entrega` /
  // `order.ciudad_entrega`) — the Shipping keeps no copy.
  // Zona and courier start empty; the operator fills them when scheduling.
  zona?:            ShippingZona | null;
  estado:           ShippingEstado;
  // Snapshot of the order's costo_envio (source of truth is Order.costo_envio).
  costo_envio:      number;
  mensajero?:       string | null;
  notas_entrega?:   string | null;
  fecha_programada?: string | null;
  fecha_entrega?:   string | null;
  createdAt:        string;
  updatedAt:        string;
}

export type ShippingFilter  = 'all' | ShippingEstado;

// The fields an operator edits when scheduling an already-existing (auto-created)
// delivery. Zona is manual — not derived from the address.
export interface ScheduleDeliveryInput {
  zona:              ShippingZona;
  mensajero?:        string | null;
  fecha_programada?: string | null;
  notas_entrega?:    string | null;
  estado?:           ShippingEstado;
}
