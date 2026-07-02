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
  items: OrderItem[];
  createdAt: string;
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