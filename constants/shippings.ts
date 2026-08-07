import { ShippingEstado, ShippingZona } from "@/types/shipping";

export const ZONAS = ['norte', 'sur', 'centro', 'oriente', 'occidente', 'exterior'] as const;

// Active dispatch states (the Entregas board). `cancelado` is intentionally
// excluded — it's terminal history, surfaced via a separate filter, not the
// active board or stat cards.
export const ESTADOS: ShippingEstado[] = [
  'preparando', 'en_ruta', 'entregado', 'fallido',
];

// Filter tabs include cancelled so voided deliveries stay viewable for history.
export const FILTER_ESTADOS: ShippingEstado[] = [...ESTADOS, 'cancelado'];

// Human labels for the fulfillment enum — use anywhere a raw value would leak
// (e.g. "en_ruta" → "En ruta"). StatusBadge has its own copy for the pill.
export const SHIPPING_ESTADO_LABEL: Record<ShippingEstado, string> = {
  preparando: 'Preparando',
  en_ruta:    'En ruta',
  entregado:  'Entregado',
  fallido:    'Fallido',
  cancelado:  'Cancelado',
};

// "Scheduled" is a DERIVED display condition, not a stored state: a shipping
// still in `preparando` that already has BOTH a courier and a delivery date —
// the prerequisite to dispatch. Drives the Programar/Editar label split and the
// En Ruta gate on both the Ordenes and Entregas pages.
export function isScheduledShipping(
  s: { estado: ShippingEstado | string; mensajero?: string | null; fecha_programada?: string | null } | null | undefined,
): boolean {
  // "Scheduled" = ready to dispatch: still preparando, with BOTH courier and
  // date. This is the single rule gating the En Ruta transition (UI + server).
  return !!s && s.estado === 'preparando' && !!s.mensajero?.trim() && !!s.fecha_programada?.trim();
}

// El operador ya tomó una decisión de programación (fecha y/o mensajero),
// aunque todavía no alcance para DESPACHAR (eso lo decide
// `isScheduledShipping`, que exige ambos). Discriminante de PRESENTACIÓN:
// solo label de botón y título de modal — nunca gatea una transición.
// `zona` se excluye a propósito: tiene default 'centro', así que estaría
// siempre en true y el label nunca volvería a "Programar entrega".
export function hasScheduleData(
  s: { estado: ShippingEstado | string; mensajero?: string | null; fecha_programada?: string | null } | null | undefined,
): boolean {
  return !!s && s.estado === 'preparando' && (!!s.mensajero?.trim() || !!s.fecha_programada?.trim());
}

// Qué le falta a una entrega para poder despacharse. Existe para que el motivo
// que se le muestra al operador (hint del modal, tooltip de "En Ruta",
// description del toast) nombre el campo que REALMENTE falta: con mensajero ya
// puesto y sin fecha, decir "falta mensajero" sería mentirle. Es texto, no gate
// — el gate sigue siendo `isScheduledShipping` (y su copia en el servidor).
export function missingToDispatch(
  s: { estado: ShippingEstado | string; mensajero?: string | null; fecha_programada?: string | null } | null | undefined,
): 'mensajero' | 'fecha' | null {
  if (!s || s.estado !== 'preparando' || isScheduledShipping(s)) return null;
  return !s.mensajero?.trim() ? 'mensajero' : 'fecha';
}

export const ZONA_COLORS: Record<string, string> = {
  norte:     'bg-blue-100 text-blue-700',
  sur:       'bg-green-100 text-green-700',
  centro:    'bg-muted text-muted-foreground',
  oriente:   'bg-violet-100 text-violet-700',
  occidente: 'bg-pink-100 text-pink-700',
  exterior:  'bg-gray-100 text-gray-700',
};

// Default operator-supplied fields when scheduling a delivery from a paid order.
// Order-owned data (number, customer, address, city, cost) is not here — it
// comes from the linked order.
export const EMPTY_SCHEDULE: {
  zona:              ShippingZona;
  mensajero:         string;
  fecha_programada:  string;
  notas_entrega:     string;
} = {
  zona:             'centro',
  mensajero:        '',
  fecha_programada: '',
  notas_entrega:    '',
};
