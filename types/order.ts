import { PaymentMethod, PaymentStatus } from "./payment";

export type OrderStatus =
  | "pendiente"
  | "confirmado"
  | "pagado"
  | "preparando"
  | "enviado"
  | "entregado"
  | "cancelado";

export type OrderChannel =
  | 'whatsapp'
  | 'instagram'
  | 'directo'
  | 'referido';

export interface OrderItem {
  producto_nombre: string;
  cantidad: number;
  subtotal: number;
}

export interface Order {
  id: string;
  numero_orden: string;
  cliente_nombre: string;
  cliente_telefono?: string;
  canal: OrderChannel;
  estado: OrderStatus;
  metodo_pago?: PaymentMethod;
  total: number;
  direccion_entrega?: string;
  ciudad_entrega?: string;
  costo_envio: number;
  notas_internas?:   string;
  notas_entrega?:    string;
  deliverySlot?:     string | null;   // slot id ("am"/"pm"); label resolved at render
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
  createdAt: string;
  ciudad_entrega: string | null;
  subtotal: number;
  costo_envio: number;
  total: number;
  items: TrackedOrderItem[];
}

export interface OrderForm {
  cliente_nombre:    string;
  cliente_telefono:  string;
  canal:             OrderChannel;
  estado:            OrderStatus;
  metodo_pago:       PaymentMethod | '';
  total:             string;
  costo_envio:       string;
  direccion_entrega: string;
  ciudad_entrega:    string;
  notas_internas:    string;
  notas_entrega:     string;
}