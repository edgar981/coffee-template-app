export type PaymentStatus =
  | 'pendiente'
  | 'completado'
  | 'fallido'
  | 'reembolsado'
  | 'parcial';

export type PaymentMethod =
  | 'efectivo'
  | 'transferencia'
  | 'nequi'
  | 'daviplata'
  | 'tarjeta'
  | 'otro';

export interface Payment {
  id:              string;
  orden_numero?:  string;
  cliente_nombre?: string;
  monto:           number;
  metodo:          PaymentMethod;
  estado:          PaymentStatus;
  referencia?:     string;
  notas?:          string;
  fecha_pago?:     string;
  createdAt:       string;
}

export interface PaymentForm {
  cliente_nombre: string;
  monto:          string;
  metodo:         PaymentMethod;
  estado:         PaymentStatus;
  referencia:     string;
  notas:          string;
  fecha_pago:     string;
}

export interface MetodoStat {
  metodo: PaymentMethod;
  count:  number;
  total:  number;
}