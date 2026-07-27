import type { OrderChannel } from '@/types/order';

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