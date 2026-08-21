// Concentración de ingresos — la regla pura detrás de "¿quién?" (bloque CLIENTES
// Y CANALES de Analítica).
//
// Responde una sola pregunta y la responde como HECHO, no como consejo: qué
// porción de los ingresos pagados viene de los N clientes más grandes. Un 80% en
// cinco clientes es un riesgo de concentración; un 20% es una base repartida.
// Cuál de las dos cosas hacer con eso es del owner — la página no lo sugiere
// (misma regla que lib/metrics/insights.ts).
//
// PURO: sin Prisma. El endpoint agrega en SQL y esto reparte.

import { MIN_ORDENES_INSIGHT } from './insights';

/**
 * Cuántos clientes entran en el "top". 5 porque es el mismo corte del Top 5 de la
 * página de Clientes: dos rankings del mismo dato con cortes distintos obligan al
 * operador a preguntarse cuál mirar.
 */
export const TOP_CONCENTRACION = 5;

/**
 * Piso de muestra: por debajo de estos clientes con PAGOS, el % de concentración
 * no se emite.
 *
 * ── POR QUÉ 15 Y NO 6, QUE ERA EL PISO ANTERIOR ─────────────────────────────
 *
 * El piso viejo era `TOP_CONCENTRACION + 1`, o sea el mínimo que evita el 100%
 * trivial. Cerraba el caso DEGENERADO y no el casi-degenerado: **con 6 clientes el
 * top-5 es cinco sextos del padrón**, así que "tus 5 mejores son el 90%" seguía
 * siendo aritmética con forma de hallazgo. La aritmética del corte:
 *
 *     piso  6 → el top-5 es el 83% del padrón
 *     piso 10 → el 50%   ("la mitad tiene más de la mitad" es casi tautología)
 *     piso 15 → el 33%   ← un TERCIO: un grupo que puede concentrar sin serlo
 *                          por definición, así que un >50% ya es asimetría real
 *
 * **Y el argumento que lo decide sobre 20 o 25 es otro** (owner, 2026-08-21): 15 es
 * exactamente `MIN_ORDENES_INSIGHT`, así que la página tiene UN solo número de
 * "muestra suficiente" y no dos parecidos que alguien tenga que recordar cuál es
 * cuál. Se importa de allá en vez de re-teclearse, para que no puedan divergir.
 *
 * Cierra el `TODO(cliente)` que tenía el piso viejo. Los CORTES DE BANDA de abajo
 * sí siguen siendo placeholder.
 */
export const MIN_CLIENTES_CONCENTRACION = MIN_ORDENES_INSIGHT;

/**
 * ── LOS CORTES DE BANDA · relativos, nunca absolutos ────────────────────────
 *
 * Un umbral ABSOLUTO ("≥70% es concentrado") miente según el tamaño del padrón: el
 * mismo 63% es casi neutro con 10 clientes y una alarma con 500. Lo que se compara
 * es cuánto supera el top-5 SU PARTE PROPORCIONAL:
 *
 *     proporcional = top.length / clientes      (5 de 15 → 33%)
 *     ratio        = pct / proporcional
 *
 * Medido en dev el día que se escribió: el 63,2% que la página mostraba era contra
 * un proporcional del 50% —ratio 1,26—, o sea **apenas por encima de lo que daría
 * un reparto perfectamente parejo**. La frase sin caracterizar estaba diciendo
 * "alarma" sobre un hecho neutro; ése es el defecto que las bandas cierran.
 *
 * TODO(cliente): calibrar con operación real, igual que los cortes de la cartera.
 * Lo que NO es placeholder es la forma relativa.
 */
export const RATIO_CONCENTRADO = 1.5;
export const RATIO_REPARTIDO   = 1.1;

/**
 * Cómo se LEE el porcentaje. Es el HECHO caracterizado, no un consejo: la página
 * dice "están concentrados", nunca "deberías diversificar" (§ texto = hecho).
 *
 * `null` es la banda del medio, y no es indecisión: es la regla de la casa
 * —preferir callar a afirmar sin base— con precedente en este mismo vecindario
 * (`insightEnBanda`, para "hay muestra pero no hay tendencia que nombrar").
 */
export type BandaConcentracion = 'concentrado' | 'repartido' | null;

export interface ClienteIngreso {
  id:     string;
  nombre: string;
  /** Dinero PAGADO por este cliente (suma de sus Payments), no `total_compras`. */
  total:  number;
  /** Órdenes no canceladas — la misma definición que la lista de Clientes. */
  ordenes: number;
}

export interface Concentracion {
  /** Los N primeros por dinero pagado, desc. Se muestran siempre que existan. */
  top:            ClienteIngreso[];
  /** Ingresos del top. */
  totalTop:       number;
  /** Ingresos de TODOS los clientes con pagos. */
  total:          number;
  /**
   * % del total que aporta el top. `null` cuando no hay base suficiente — ver
   * {@link MIN_CLIENTES_CONCENTRACION}. `null` significa "no me consta", y la
   * página muestra la lista sin el titular en vez de inventar un porcentaje.
   */
  pct:            number | null;
  /** Clientes con ingresos > 0. Es la muestra sobre la que decide la guarda. */
  clientes:       number;
  /**
   * Cómo se LEE ese `pct` — ver {@link BandaConcentracion}. `null` con muestra
   * insuficiente Y en la banda del medio: en los dos casos la página dice el hecho
   * sin adjetivarlo, que es lo correcto y no una omisión.
   */
  banda:          BandaConcentracion;
}

/**
 * Reparte la concentración. `clientes` llega con el dinero YA pagado por cada
 * uno; acá solo se ordena, se corta y se divide.
 *
 * Los clientes en 0 se descartan antes de contar la muestra: un cliente que
 * nunca pagó no diluye una concentración, y dejarlos dentro haría que importar
 * una lista de contactos "mejorara" el número sin que entrara un solo peso.
 */
export function concentracionIngresos(
  clientes: ClienteIngreso[],
  n: number = TOP_CONCENTRACION,
): Concentracion {
  const conIngresos = clientes.filter(c => c.total > 0);
  // Desempate por nombre: mismo motivo que en la tabla de margen — el orden no
  // puede cambiar entre recargas sin que haya cambiado un dato.
  const ordenados = [...conIngresos].sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre));

  const top      = ordenados.slice(0, n);
  const totalTop = top.reduce((s, c) => s + c.total, 0);
  const total    = ordenados.reduce((s, c) => s + c.total, 0);

  const hayBase = ordenados.length >= MIN_CLIENTES_CONCENTRACION && total > 0;

  const pct = hayBase ? (totalTop / total) * 100 : null;

  // LA PARTE PROPORCIONAL del top: lo que le tocaría si todos pagaran igual. Es el
  // referente contra el que un porcentaje significa algo — sin él, "63%" no se
  // puede leer sin saber contra cuántos.
  const proporcional = ordenados.length > 0 ? (top.length / ordenados.length) * 100 : 0;
  const ratio        = pct !== null && proporcional > 0 ? pct / proporcional : null;

  let banda: BandaConcentracion = null;
  if (ratio !== null) {
    if (ratio >= RATIO_CONCENTRADO)     banda = 'concentrado';
    else if (ratio <= RATIO_REPARTIDO)  banda = 'repartido';
  }

  return {
    top,
    totalTop,
    total,
    pct,
    clientes: ordenados.length,
    banda,
  };
}
