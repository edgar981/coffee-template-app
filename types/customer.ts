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
  numero_ordenes?:  number;
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
}