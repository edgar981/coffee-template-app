// Capa de INSIGHTS de las stat cards: hechos derivados de la serie mensual, no
// consejos. Reglas fijas y deterministas, puras y testeables — sin heurísticas
// "inteligentes", sin causas inventadas y sin texto prescriptivo ("necesita
// atención", "considera subir precios"). Un insight dice QUÉ pasó; qué hacer con
// eso es del owner.
//
// Amber Minimal: el texto se renderiza muted, sin color ni icono de alerta (el
// rojo está reservado a Alertas de Stock). Un insight no es una alarma.
//
// EL MES EN CURSO NUNCA CUENTA como observación: está incompleto, y comparar 9
// días contra meses de 30 produce "a la baja" todos los días 1. Las reglas
// trabajan solo sobre meses CERRADOS (`cerrado: false` se descarta).

/**
 * Piso de muestra: por debajo de estas órdenes en el mes comparado NO se emite
 * insight de tendencia. A volumen bajo un -40% son dos órdenes de diferencia, y
 * un insight ruidoso entrena al operador a ignorar la línea entera.
 *
 * TODO(cliente): 15 es un placeholder — calibrar con el volumen real del negocio
 * cuando haya algunos meses de operación (mismo estatus que los umbrales de
 * ZONA_CONFIG y los precios de shipping-config).
 */
export const MIN_ORDENES_INSIGHT = 15;

/** Meses consecutivos que exige la regla de racha. */
export const RACHA_MESES = 3;
/** Meses de historia previa que promedia la regla semestral. */
export const PROMEDIO_MESES = 6;
/** Desvío contra el promedio a partir del cual se comenta (25%). */
export const DESVIO_PROMEDIO = 0.25;

export interface InsightMonthPoint {
  /** `YYYY-MM` en America/Bogota. */
  month:   string;
  /** Valor de la métrica en ese mes (pesos, órdenes… según el widget). */
  value:   number;
  /**
   * Órdenes reales del mes: la BASE DE MUESTRA, no el valor. Es lo que decide si
   * el % significa algo — de ahí que viaje aparte incluso cuando `value` YA es
   * un conteo de órdenes.
   */
  ordenes: number;
  /** `false` para el mes en curso (incompleto). */
  cerrado: boolean;
}

/** Lo que el dashboard le pasa a la regla. */
export interface WidgetInsightData {
  /** Serie mensual corta del widget. Ausente en las tarjetas de scope HOY. */
  serie?: InsightMonthPoint[];
  /**
   * ISO del último evento relevante para una tarjeta de scope HOY (último pago,
   * último despacho, última orden). `null` = nunca ocurrió.
   */
  ultimoEvento?: string | null;
  /** Día de referencia (`YYYY-MM-DD` en America/Bogota) para el "hace N días". */
  hoy?: string;
}

export interface WidgetInsight {
  text: string;
  /**
   * `true` solo para los hechos de TENDENCIA (racha, contra-promedio, en banda):
   * la tarjeta les da un paso más de contraste que a los fallbacks. Sigue siendo
   * muted — Amber Minimal: jerarquía por tono neutro, nunca por color semántico.
   */
  enfasis?: boolean;
}

/**
 * Meses cerrados en orden ascendente — la única vista sobre la que se razona.
 *
 * Los meses iniciales SIN NINGUNA ORDEN se descartan: son prehistoria (la ventana
 * de la serie empieza antes de que el negocio operara), no historia con valor 0.
 * Sin esto, un negocio de 3 meses "cumple" los 6 meses del promedio semestral
 * rellenando con ceros y la tarjeta anuncia "Por encima del promedio semestral"
 * el primer día — un hecho inventado por la forma de la ventana. Un mes en cero
 * EN MEDIO de la operación sí es dato real y se conserva.
 */
function mesesCerrados(data: WidgetInsightData | null | undefined): InsightMonthPoint[] {
  if (!data?.serie?.length) return [];
  const cerrados = data.serie
    .filter(p => p.cerrado)
    .slice()
    .sort((a, b) => a.month.localeCompare(b.month));
  const primeroConDatos = cerrados.findIndex(p => p.ordenes > 0);
  return primeroConDatos === -1 ? [] : cerrados.slice(primeroConDatos);
}

/**
 * Guarda de muestra sobre el mes comparado (el último cerrado). Devuelve `true`
 * cuando hay volumen suficiente para que un % no sea ruido.
 */
function muestraSuficiente(meses: InsightMonthPoint[]): boolean {
  const ultimo = meses[meses.length - 1];
  return !!ultimo && ultimo.ordenes >= MIN_ORDENES_INSIGHT;
}

/**
 * Racha: los últimos 3 meses cerrados estrictamente monótonos.
 * `null` si no hay 3 meses cerrados, si no son estrictamente monótonos, o si el
 * mes comparado no pasa la guarda de muestra.
 */
export function insightRacha(data: WidgetInsightData | null | undefined): WidgetInsight | null {
  const meses = mesesCerrados(data);
  if (meses.length < RACHA_MESES) return null;
  if (!muestraSuficiente(meses)) return null;

  const ultimos = meses.slice(-RACHA_MESES).map(p => p.value);
  const baja = ultimos.every((v, i) => i === 0 || v < ultimos[i - 1]);
  const alza = ultimos.every((v, i) => i === 0 || v > ultimos[i - 1]);
  if (!baja && !alza) return null;

  return { text: `${RACHA_MESES} meses consecutivos ${baja ? 'a la baja' : 'al alza'}`, enfasis: true };
}

/**
 * Contra promedio: el último mes CERRADO desviado más de 25% del promedio de los
 * 6 meses cerrados anteriores. Exige por tanto 7 meses cerrados (el comparado +
 * los 6 que promedia): con menos historia el "promedio semestral" del texto
 * sería mentira.
 */
export function insightContraPromedio(data: WidgetInsightData | null | undefined): WidgetInsight | null {
  const meses = mesesCerrados(data);
  if (meses.length < PROMEDIO_MESES + 1) return null;
  if (!muestraSuficiente(meses)) return null;

  const ultimo    = meses[meses.length - 1].value;
  const anteriores = meses.slice(-(PROMEDIO_MESES + 1), -1);
  const promedio  = anteriores.reduce((s, p) => s + p.value, 0) / anteriores.length;
  // Sin base positiva no hay desvío que reportar (un 0 → cualquier cosa es ∞%).
  if (promedio <= 0) return null;

  if (ultimo < promedio * (1 - DESVIO_PROMEDIO)) return { text: 'Por debajo del promedio semestral', enfasis: true };
  if (ultimo > promedio * (1 + DESVIO_PROMEDIO)) return { text: 'Por encima del promedio semestral', enfasis: true };
  return null;
}

/**
 * "En banda": el mismo cálculo del contra-promedio, cuando el desvío cae DENTRO
 * del ±25%. Es un hecho verificado, no relleno — por eso exige exactamente los
 * mismos datos que la regla que lo precede (el mes comparado + los 6 que promedia
 * + la guarda de muestra). Con menos historia no se emite: decir "en línea con el
 * promedio semestral" sin haber podido promediar un semestre sería una afirmación
 * sin respaldo.
 */
export function insightEnBanda(data: WidgetInsightData | null | undefined): WidgetInsight | null {
  const meses = mesesCerrados(data);
  if (meses.length < PROMEDIO_MESES + 1) return null;
  if (!muestraSuficiente(meses)) return null;
  // Si el desvío se salió de la banda, ese hecho ya lo dice contra-promedio.
  if (insightContraPromedio(data)) return null;

  const anteriores = meses.slice(-(PROMEDIO_MESES + 1), -1);
  const promedio   = anteriores.reduce((s, p) => s + p.value, 0) / anteriores.length;
  // Mismo corte que contra-promedio: sin base positiva no hay banda que verificar.
  if (promedio <= 0) return null;

  return { text: 'En línea con el promedio semestral', enfasis: true };
}

/**
 * Último escalón de las tarjetas con serie: declarar que TODAVÍA NO SE PUEDE
 * hablar de tendencia. Es un hecho sobre los datos, no un juicio sobre el
 * negocio, y es lo que evita relajar las guardas para "tener algo que decir".
 */
export function insightMuestraCorta(data: WidgetInsightData | null | undefined): WidgetInsight | null {
  if (!data?.serie) return null;
  const meses = mesesCerrados(data);
  if (meses.length < RACHA_MESES || !muestraSuficiente(meses)) {
    return { text: 'Muestra aún pequeña para tendencias' };
  }
  return null;
}

/**
 * Escalón final de las tarjetas con serie: hay muestra y hay meses, pero ni racha
 * (los 3 últimos no son monótonos) ni semestre que promediar. En vez de callar —
 * dejando la tarjeta sin su segunda línea — o de inventar un juicio ("estable",
 * "sin novedades"), declara el HECHO que explica la ausencia de tendencia: cuánta
 * historia cerrada hay. Es el dato que le falta al operador para interpretar el
 * silencio de las reglas anteriores.
 */
export function insightHistoriaDisponible(data: WidgetInsightData | null | undefined): WidgetInsight | null {
  const meses = mesesCerrados(data);
  if (!meses.length) return null;
  const n = meses.length;
  return { text: `${n} ${n === 1 ? 'mes completo' : 'meses completos'} de historia` };
}

/** Días completos entre dos day keys `YYYY-MM-DD` (aritmética de calendario). */
export function diasEntre(desde: string, hasta: string): number {
  const ms = Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** Copy de un insight de "último evento". Cada widget escribe el suyo. */
export interface UltimoEventoCopy {
  /** El evento ocurrió hoy. */
  hoy:   string;
  /** Ocurrió hace `dias` (>=1); recibe también el ISO para formatear la fecha. */
  dias:  (dias: number, fechaIso: string) => string;
  /** Nunca ocurrió. */
  nunca: string;
}

/**
 * Insight de las tarjetas de scope HOY: no tienen serie mensual, así que el hecho
 * disponible es CUÁNDO fue el último evento real. Un `0` de hoy acompañado de
 * "último pago hace 3 días" informa; un `0` solo, no.
 */
export function insightUltimoEvento(
  data: WidgetInsightData | null | undefined,
  copy: UltimoEventoCopy,
): WidgetInsight | null {
  if (!data || !data.hoy) return null;
  if (!data.ultimoEvento) return { text: copy.nunca };

  const dia  = data.ultimoEvento.slice(0, 10);
  const dias = diasEntre(dia, data.hoy);
  // Un evento "futuro" (reloj desfasado) se trata como hoy antes que mostrar
  // "hace -1 días".
  return { text: dias <= 0 ? copy.hoy : copy.dias(dias, data.ultimoEvento) };
}

/**
 * EL insight del widget con serie mensual, por escalera: cada escalón solo se
 * evalúa si el anterior no tuvo nada verificable que decir.
 *
 *   a. racha (3 meses monótonos)
 *   b. contra-promedio (±25% del semestre)
 *   c. en banda (el mismo cálculo, dentro de la banda)
 *   d. muestra corta (no hay base para hablar de tendencia)
 *   e. historia disponible (hay base, pero ni racha ni semestre que comparar)
 *
 * Ninguno de los escalones relaja `MIN_ORDENES_INSIGHT` ni el mínimo de meses: los
 * fallbacks describen la FALTA de base, no la sustituyen. (d) y (e) se reparten
 * los dos motivos posibles de ese silencio — muestra chica vs historia corta — así
 * que la segunda línea de la tarjeta nunca queda vacía teniendo serie.
 */
export function widgetInsight(data: WidgetInsightData | null | undefined): WidgetInsight | null {
  return insightRacha(data)
    ?? insightContraPromedio(data)
    ?? insightEnBanda(data)
    ?? insightMuestraCorta(data)
    ?? insightHistoriaDisponible(data);
}
