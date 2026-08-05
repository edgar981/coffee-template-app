// Períodos de Analítica — los chips del selector.
//
// Vive aparte y es PURO porque lo consumen las dos mitades: el endpoint lo valida
// para decidir el rango de fechas, y el selector de la página pinta las mismas
// etiquetas. Un `'mes_anterior'` tecleado a mano en cada lado es cómo el selector
// termina pidiendo un período que el server no reconoce y cayendo al default en
// silencio.
//
// LOS CHIPS ESTÁN EN LENGUAJE DE DUEÑO, no de reporte: "Este mes", no "Mes en
// curso". Es la misma regla que gobierna la página entera desde el pase de
// jerarquía — la respuesta primero, en el idioma en que se hace la pregunta.

export const PERIODOS = {
  mes:             'Este mes',
  mes_anterior:    'Mes pasado',
  ultimos_3_meses: 'Últimos 3 meses',
  anio:            'Este año',
} as const;

export type PeriodoKey = keyof typeof PERIODOS;

export const PERIODO_DEFAULT: PeriodoKey = 'mes';

/** Orden del selector, de más reciente a más amplio. */
export const PERIODO_ORDEN: PeriodoKey[] = ['mes', 'mes_anterior', 'ultimos_3_meses', 'anio'];

/**
 * El período como SUJETO de una frase: "Este mes te quedaron $X".
 *
 * Va aparte del label del chip porque un chip y una oración piden gramática
 * distinta — "Mes pasado" está bien en un botón y mal en una frase, donde toca
 * "El mes pasado". Tenerlo en dos mapas es lo que evita que alguien "unifique"
 * los dos y deje una de las dos superficies mal escrita.
 */
export const PERIODO_SUJETO: Record<PeriodoKey, string> = {
  mes:             'Este mes',
  mes_anterior:    'El mes pasado',
  ultimos_3_meses: 'En los últimos 3 meses',
  anio:            'Este año',
};

/**
 * Si el período INCLUYE el presente (y por tanto todavía puede cambiar).
 *
 * Sólo lo usa la redacción de los titulares, y no es un matiz de estilo: "el mes
 * pasado no hay ventas TODAVÍA" le promete al dueño un cambio en un mes que ya
 * cerró. Un período cerrado se narra en pasado.
 */
export const PERIODO_EN_CURSO: Record<PeriodoKey, boolean> = {
  mes:             true,
  mes_anterior:    false,
  ultimos_3_meses: true,
  anio:            true,
};

/**
 * MESES que abarca cada período hacia atrás, contando el actual.
 *
 * `ultimos_3_meses` es una ventana MÓVIL que INCLUYE el mes en curso, no el
 * trimestre calendario: la pregunta real del dueño es "cómo me ha ido
 * últimamente", y un trimestre calendario responde otra cosa —el día 1 de abril
 * mostraría enero-marzo y ocultaría todo lo reciente—. Decisión del owner,
 * 2026-08-05.
 *
 * `anio` y los dos de un mes no usan esto (tienen su propio cálculo); está acá
 * sólo para que el número 3 viva junto a su explicación.
 */
export const ULTIMOS_MESES_VENTANA = 3;

/**
 * Type guard sobre el query param. Un valor desconocido NO es un error: cae al
 * default, igual que `parseFilters` de Órdenes descarta estados que no conoce en
 * vez de rechazar la URL entera.
 */
export function esPeriodo(value: string | null | undefined): value is PeriodoKey {
  return value != null && value in PERIODOS;
}
