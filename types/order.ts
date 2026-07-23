import { PaymentMethod } from "./payment";
import { ShippingEstado, Shipping } from "./shipping";

// OrderStatus covers the PAYMENT lifecycle only. Fulfillment (preparando/en
// ruta/entregado/fallido) lives on Shipping — see ShippingEstado. When an order
// becomes `pagado`, its Shipping is auto-created in `preparando`.
export type OrderStatus =
  | "pendiente"
  | "pagado"
  | "cancelado";

export type OrderChannel =
  | 'whatsapp'
  | 'instagram'
  | 'directo'
  | 'referido';

export interface OrderItem {
  producto_nombre: string;
  /** Molienda elegida por el cliente al comprar (snapshot) */
  moliendaSeleccionada?: string | null;
  cantidad: number;
  subtotal: number;
}

export interface Order {
  id: string;
  numero_orden: string;
  cliente_nombre: string;
  cliente_email?: string;
  cliente_telefono?: string;
  canal: OrderChannel;
  estado: OrderStatus;
  metodo_pago?: PaymentMethod;
  total: number;
  direccion_entrega?: string;
  direccion_detalle?: string | null;
  ciudad_entrega?: string;
  costo_envio: number;
  notas_internas?:   string;
  notas_entrega?:    string;
  deliverySlot?:     string | null;   // slot id ("am"/"pm"); label resolved at render
  // Fulfillment record (1:1). Auto-created when the order is paid; null before.
  shipping?:         Shipping | null;
  items: OrderItem[];
  createdAt: string;
}

// Sanitized shape returned by the public order-tracking endpoint. Deliberately
// omits phone number and street address — see app/api/orders/track/route.ts.
export interface TrackedOrderItem {
  producto_nombre: string;
  cantidad: number;
  subtotal: number;
}

export interface TrackedOrder {
  numero_orden: string;
  estado: OrderStatus | string;
  // Fulfillment state from the linked Shipping, or null if it doesn't exist yet
  // (paid but not yet auto-created / scheduled). The timeline stitches both.
  shipping_estado: ShippingEstado | string | null;
  createdAt: string;
  ciudad_entrega: string | null;
  subtotal: number;
  costo_envio: number;
  total: number;
  items: TrackedOrderItem[];
}

// One product line in the admin "Nueva Orden" modal.
export interface OrderLineForm {
  slug:     string;   // '' until a product is picked
  cantidad: number;
  molienda: string;   // '' when the product has no molienda / not yet picked
}

export interface OrderForm {
  cliente_nombre:    string;
  cliente_email:     string;
  cliente_telefono:  string;
  canal:             OrderChannel;
  costo_envio:       string;
  direccion_entrega: string;
  notas_internas:    string;
  items:             OrderLineForm[];
}

// Payload the admin modal POSTs to /api/orders. Lines are priced server-side, so
// no total is sent; the order is always created `pendiente`.
export interface AdminOrderPayload {
  cliente_nombre:     string;
  cliente_email?:     string;
  cliente_telefono?:  string;
  canal?:             OrderChannel;
  costo_envio?:       number;
  direccion_entrega?: string;
  notas_internas?:    string;
  items:              { slug: string; cantidad: number; molienda?: string | null }[];
  idempotencyKey?:    string;
}

// Contact + address context for the "Programar entrega" modal. Address is read
// from the ORDER; `customer` is the linked Customer (by email) or null (guest);
// `telefono` is resolved server-side (order snapshot > customer).
export interface DeliveryContext {
  numero_orden:      string;
  cliente_nombre:    string | null;
  cliente_email:     string | null;
  telefono:          string | null;
  direccion_entrega: string | null;
  ciudad_entrega:    string | null;
  direccion_detalle: string | null;
  customer:          { id: string; nombre: string } | null;
}

// Payload for the add-address endpoint — same shape/standard as checkout's
// address (telefono normalized to +573XXXXXXXXX).
export interface DeliveryAddressPayload {
  direccion:          string;
  direccion_detalle?: string | null;
  ciudad:             string;
  departamento:       string;
  telefono:           string;
}

export interface OrderAddressResult {
  id:                string;
  numero_orden:      string;
  direccion_entrega: string | null;
  ciudad_entrega:    string | null;
  direccion_detalle: string | null;
  cliente_telefono:  string | null;
  notas_internas:    string | null;
}