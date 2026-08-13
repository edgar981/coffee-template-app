import type { OrderChannel, CondicionPago } from '@/types/order';

export interface Customer {
  id:               string;
  nombre:           string;
  email?:           string;
  telefono?:        string;
  ciudad?:          string;
  direccion?:       string;
  canal?:           OrderChannel;
  notas?:           string;
  // Stored/denormalized seed field — NOT the display count anymore (it was never
  // incremented at order creation). Kept on the type for the write model only.
  numero_ordenes?:  number;
  // `ordenes` = VISIBLE "N órdenes" = LIVE non-cancelled order count (pendientes +
  // pagadas). `ordenesRef` = REFERENTIAL count (_count.orders, incl. canceladas) that
  // drives the delete affordance so it matches the server 409 guard exactly.
  ordenes?:         number;
  ordenesRef?:      number;
  // Real money paid by the customer (sum of Payments), NOT the demo seed value.
  total_compras?:   number;
  // Cuántos de sus PEDIDOS piden acción hoy (`necesitaAtencion`, la misma regla
  // que el pill de Pedidos y el punto sol del nav). Es lo que enciende el sol de
  // la fila del cliente — que significa "tiene pedidos que atender", no "este
  // cliente necesita atención": el dominio no tiene criterio accionable por
  // cliente. Sólo lo llena `GET /api/customers`.
  pedidosPorAtender?: number;
  // ISO de su última orden NO cancelada — la recencia, que se muestra como TEXTO
  // ("hace 3 días"), nunca como color: "compró hace poco" no es un estado y el
  // verde significa confirmado/pagado. `null` = nunca compró, y eso es un hecho,
  // no un hueco. Misma definición que `ordenes` (excluye canceladas), para que la
  // fila no se contradiga; NO la del barrido de reactivación, que mira la última
  // orden PAGADA porque responde otra pregunta.
  ultimaOrden?: string | null;
  activo:           boolean;
  createdAt:        string;
}

export interface CustomerForm {
  nombre:    string;
  email:     string;
  telefono:  string;
  ciudad:    string;
  direccion: string;
  canal:     OrderChannel;
  notas:     string;
  activo:   boolean;
}

// One row of a customer's order history (profile page). Payment state is
// Order.estado; delivery state comes from the linked Shipping (null before paid).
export interface CustomerOrderRow {
  id:           string;
  numero_orden: string;
  estado:       string;
  /** Necesaria para `badgeCobro`: sin ella "Por cobrar" no se distingue de una
   *  pendiente cualquiera. La pantalla vieja no la usaba (pinta `StatusBadge`). */
  condicion_pago?: CondicionPago;
  total:        number;
  createdAt:    string;
  shipping:     { estado: string } | null;
}

// Customer + their order history, returned by GET /api/customers/[id] for the
// dedicated profile page.
export interface CustomerWithOrders extends Customer {
  orders: CustomerOrderRow[];
  /** Real money paid (sum of Payments) — the profile's "Total comprado". */
  comprasPagadas?: number;
}