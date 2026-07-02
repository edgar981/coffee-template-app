export type ShippingEstado = 
  | 'programado'
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

export interface Shipping {
  id:               string;
  orden_id?:        string | null;
  numero_orden?:    string | null;
  cliente_nombre?:  string | null;
  direccion:        string;
  ciudad:           string;
  zona?:            ShippingZona | null;
  estado:           ShippingEstado;
  costo_envio:      number;
  mensajero?:       string | null;
  notas_entrega?:   string | null;
  fecha_programada?: string | null;
  fecha_entrega?:   string | null;
  createdAt:        string;
  updatedAt:        string;
}

export type ShippingFilter  = 'all' | ShippingEstado;

export type ShippingForm    = Omit<Shipping, 'id' | 'orden_id' | 'createdAt' | 'updatedAt'>;