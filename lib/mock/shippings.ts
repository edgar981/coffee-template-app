import { ShippingEstado, ShippingZona } from "@/types/shipping";

// Operator-owned delivery fields only. Order data (number, customer, address,
// city, cost) is NOT stored here — a seeded delivery links to a real paid order
// and reads those through the relation. These templates are cycled across the
// seeded paid orders (see prisma/seed.ts).
export interface ShippingSeedTemplate {
  zona:              ShippingZona;
  estado:            ShippingEstado;
  mensajero:         string | null;
  notas_entrega:     string | null;
  fecha_programada:  string | null;
  fecha_entrega:     string | null;
}

export const SHIPPING_SEED_TEMPLATES: ShippingSeedTemplate[] = [
  { zona: 'norte',  estado: 'preparando', mensajero: 'Luis Ronderos', notas_entrega: null, fecha_programada: '2026-05-14', fecha_entrega: null },
  { zona: 'centro', estado: 'en_ruta',    mensajero: 'Coordinadora',  notas_entrega: null, fecha_programada: '2026-05-13', fecha_entrega: null },
  { zona: 'sur',    estado: 'entregado',  mensajero: 'Luis Ronderos', notas_entrega: null, fecha_programada: '2026-05-10', fecha_entrega: '2026-05-10' },
];
