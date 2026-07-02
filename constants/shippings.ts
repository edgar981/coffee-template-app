import { ShippingEstado, ShippingForm } from "@/types/shipping";

export const ZONAS = ['norte', 'sur', 'centro', 'oriente', 'occidente', 'exterior'] as const;

export const ESTADOS: ShippingEstado[] = [
  'programado', 'en_ruta', 'entregado', 'fallido', 'cancelado',
];

export const ZONA_COLORS: Record<string, string> = {
  norte:     'bg-blue-100 text-blue-700',
  sur:       'bg-green-100 text-green-700',
  centro:    'bg-amber-100 text-amber-700',
  oriente:   'bg-violet-100 text-violet-700',
  occidente: 'bg-pink-100 text-pink-700',
  exterior:  'bg-gray-100 text-gray-700',
};

export const EMPTY_FORM: ShippingForm = {
  numero_orden:    '',
  cliente_nombre:  '',
  direccion:       '',
  ciudad:          'Bogotá',
  zona:            'centro',
  estado:          'programado',
  costo_envio:     8000,
  mensajero:       '',
  notas_entrega:   '',
  fecha_programada: '',
  fecha_entrega:   null,
};
