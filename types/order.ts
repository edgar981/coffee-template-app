import { PaymentMethod, MetodoPago } from "./payment";
import { ShippingEstado, Shipping } from "./shipping";
import { Comprobante } from "./comprobante";

// OrderStatus covers the PAYMENT lifecycle only. Fulfillment (preparando/en
// ruta/entregado/fallido) lives on Shipping — see ShippingEstado. When an order
// becomes `pagado`, its Shipping is auto-created in `preparando`.
export type OrderStatus =
  | "pendiente"
  | "pagado"
  | "cancelado";

/**
 * CONDICIÓN de pago — cuándo se paga respecto al despacho. NO es un método:
 * el instrumento real queda en Payment.metodo al recibir el dinero.
 * ANTICIPADO: pago → envío (no se despacha sin pago, server-enforced).
 * CONTRAENTREGA: el envío se prepara/despacha con la orden `pendiente`; el
 * pago se registra tras la entrega. Inmutable una vez hay Shipping o Payment.
 */
export type CondicionPago = 'ANTICIPADO' | 'CONTRAENTREGA';

export const CONDICION_PAGO_LABEL: Record<CondicionPago, string> = {
  ANTICIPADO:    'Anticipado',
  CONTRAENTREGA: 'Contraentrega',
};

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
  /**
   * FK to the Customer this order belongs to, recorded at creation. `null` on
   * orders that predate the relation and could not be resolved by the backfill —
   * the UI must fall back to plain text rather than linking nowhere.
   */
  cliente_id?: string | null;
  /** Purchase-time snapshots — what the customer said THEN, not who they are now. */
  cliente_nombre: string;
  cliente_email?: string;
  cliente_telefono?: string;
  canal: OrderChannel;
  estado: OrderStatus;
  /** Free-string method declared at checkout (lowercase). Legacy/storefront. */
  metodo_pago?: PaymentMethod;
  /**
   * DECLARED payment intent on an admin-created order (typed, same enum as a
   * registered Payment). Not the money: the order is still `pendiente` until a
   * Payment is registered. Pre-selects the "Registrar pago" method. Null when
   * "Por definir" or for checkout orders.
   */
  metodoPagoPrevisto?: MetodoPago | null;
  /** Condición de pago; las órdenes existentes/checkout son ANTICIPADO. */
  condicion_pago: CondicionPago;
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
  // Soportes de pago (0..N). EVIDENCIA, no plata: una orden puede tener
  // comprobante sin Payment y Payment sin comprobante.
  comprobantes?:     Comprobante[];
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
  // Ciudad y departamento son OPCIONALES en la orden manual (debe poder crearse
  // rápido sin ellos). La ciudad sí se persiste — es lo que habilita la
  // sugerencia de zona al programar la entrega (lib/zona-config). El
  // departamento se valida pero NO se persiste: `Order` no tiene columna, igual
  // que en el flujo de "Agregar dirección" (lib/validation/address).
  ciudad_entrega:    string;
  departamento:      string;
  notas_internas:    string;
  items:             OrderLineForm[];
  // Método de pago previsto (opcional). '' = "Por definir". La CONDICIÓN de pago
  // ya no vive en el formulario: se DERIVA del método (EFECTIVO → Contraentrega).
  metodoPagoPrevisto: '' | MetodoPago;
  // "El pago ya fue recibido" — sólo válido con un método previsto que NO sea
  // EFECTIVO (efectivo ⇒ contraentrega, se cobra al entregar).
  pagoRecibido:       boolean;
}

// Payload the admin modal POSTs to /api/orders. Lines are priced server-side, so
// no total is sent; the order is always created `pendiente`.
export interface AdminOrderPayload {
  cliente_nombre:     string;
  cliente_email?:     string;
  cliente_telefono?:  string;
  // Cliente explícito adoptado desde el banner de duplicado ("Usar este
  // cliente"): la orden se adjunta a él (validado server-side; sin upsert).
  cliente_id?:        string;
  // "Crear cliente nuevo" pese a un match — el server salta el matching. Mutuamente
  // excluyente con cliente_id.
  forzarClienteNuevo?: boolean;
  canal?:             OrderChannel;
  costo_envio?:       number;
  direccion_entrega?: string;
  // Opcionales; la ciudad se persiste (habilita la sugerencia de zona), el
  // departamento solo se valida (no hay columna en Order).
  ciudad_entrega?:    string;
  departamento?:      string;
  notas_internas?:    string;
  items:              { slug: string; cantidad: number; molienda?: string | null }[];
  // Método de pago previsto (enum) u omitido para "Por definir". La condición de
  // pago la deriva el server de este método; enviarla no tiene efecto.
  metodoPagoPrevisto?: MetodoPago;
  // "El pago ya fue recibido": registra el pago en la misma transacción de
  // creación (requiere metodoPagoPrevisto). La orden nace pendiente y se marca
  // pagada acto seguido por el mismo camino que "Registrar pago".
  pagoRecibido?:       boolean;
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
  /**
   * Último mensajero usado en cualquier entrega — default del campo, no un dato
   * de ESTA orden. Solo pre-llena el input cuando está vacío; lo que se guarda es
   * siempre lo que quedó escrito. `null` = todavía no hay ninguno.
   */
  ultimoMensajero:   string | null;
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