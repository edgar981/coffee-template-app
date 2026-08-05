// Períodos del bloque de RENTABILIDAD de Analítica.
//
// Vive aparte y es PURO porque lo consumen las dos mitades: el endpoint lo valida
// para decidir el rango de fechas, y el selector de la página pinta las mismas
// etiquetas. Un `'mes_anterior'` tecleado a mano en cada lado es cómo el selector
// termina pidiendo un período que el server no reconoce y cayendo al default en
// silencio.

export const PERIODOS = {
  mes:          'Mes en curso',
  mes_anterior: 'Mes anterior',
  anio:         'Año en curso',
} as const;

export type PeriodoKey = keyof typeof PERIODOS;

export const PERIODO_DEFAULT: PeriodoKey = 'mes';

/** Orden del selector, de más reciente a más amplio. */
export const PERIODO_ORDEN: PeriodoKey[] = ['mes', 'mes_anterior', 'anio'];

/**
 * Type guard sobre el query param. Un valor desconocido NO es un error: cae al
 * default, igual que `parseFilters` de Órdenes descarta estados que no conoce en
 * vez de rechazar la URL entera.
 */
export function esPeriodo(value: string | null | undefined): value is PeriodoKey {
  return value != null && value in PERIODOS;
}
