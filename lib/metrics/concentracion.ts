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

/**
 * Cuántos clientes entran en el "top". 5 porque es el mismo corte del Top 5 de la
 * página de Clientes: dos rankings del mismo dato con cortes distintos obligan al
 * operador a preguntarse cuál mirar.
 */
export const TOP_CONCENTRACION = 5;

/**
 * Piso de muestra: por debajo de estos clientes con ingresos, el % de
 * concentración no se emite.
 *
 * Con 5 clientes o menos el top-5 ES el total y el número da 100% — un dato
 * cierto que se lee como una alarma ("¡todo depende de 5 clientes!") cuando lo
 * único que dice es que el negocio tiene cinco clientes. Misma familia de guarda
 * que `MIN_ORDENES_INSIGHT`, y por el mismo motivo: una cifra ruidosa entrena a
 * ignorar la línea entera.
 *
 * TODO(cliente): calibrar con el volumen real cuando haya operación.
 */
export const MIN_CLIENTES_CONCENTRACION = TOP_CONCENTRACION + 1;

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

  return {
    top,
    totalTop,
    total,
    pct:      hayBase ? (totalTop / total) * 100 : null,
    clientes: ordenados.length,
  };
}
