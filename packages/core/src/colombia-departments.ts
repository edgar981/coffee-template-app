// Colombia's 32 departments plus the Capital District as its own entry (33).
// Populates the checkout Departamento dropdown and drives Bogotá detection
// (contra-entrega + Bogotá shipping tier both key off BOGOTA_DC).
//
// TODO: static list for now; may move to a DB table (e.g. with per-department
// shipping zones/rates) in a later phase.

// The Capital District value. Every Bogotá check — client and server — compares
// against this exact constant, so the dropdown and the gating can't drift apart.
export const BOGOTA_DC = 'Bogotá D.C.';

export const COLOMBIA_DEPARTMENTS: string[] = [
  BOGOTA_DC,
  'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bolívar', 'Boyacá',
  'Caldas', 'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Córdoba',
  'Cundinamarca', 'Guainía', 'Guaviare', 'Huila', 'La Guajira', 'Magdalena',
  'Meta', 'Nariño', 'Norte de Santander', 'Putumayo', 'Quindío', 'Risaralda',
  'San Andrés y Providencia', 'Santander', 'Sucre', 'Tolima', 'Valle del Cauca',
  'Vaupés', 'Vichada',
];

export function isBogotaDC(departamento: string | null | undefined): boolean {
  return departamento === BOGOTA_DC;
}
