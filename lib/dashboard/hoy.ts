// Reglas puras de la pantalla "Hoy" del Dashboard. Viven en `lib/` —y no dentro
// del handler o del componente— porque cada una tiene una DECISIÓN que afirmar en
// capa 1: cuántos buckets tiene el día, qué es un hueco, y cuándo la curva no
// dibuja. El SQL agrega; esto decide la FORMA.

/** El día tiene 24 horas: la curva de pedidos SIEMPRE es de 24 buckets, uno por
 *  hora en reloj de Bogotá (índice 0 = 00:00 … 23 = 23:00). Es fija, no depende de
 *  cuándo llegó el primer pedido: recortar la ventana escondería ventas reales
 *  —hay pedidos a las 00:47 y 23:49 en un storefront 24h— y una curva que esconde
 *  ventas es peor que horas vacías. */
export const HORAS_DIA = 24;

/** Una fila del agregado por hora: la hora (0–23, reloj de Bogotá) y su conteo. */
export interface HoraRow {
  hora: number;
  n:    number;
}

/**
 * Rellena las 24 horas a partir del agregado disperso. Una hora SIN pedidos es un
 * 0 real, no un hueco: omitirla desplazaría el eje y haría leer las 3pm donde son
 * las 2. El resultado es un array de largo 24, índice = hora.
 *
 * Defensivo con horas fuera de rango: `EXTRACT(HOUR …)` siempre da 0–23, pero una
 * fila corrupta no debe desbordar el array ni desplazar el resto.
 */
export function bucketsPorHora(rows: HoraRow[]): number[] {
  const buckets = new Array<number>(HORAS_DIA).fill(0);
  for (const { hora, n } of rows) {
    if (Number.isInteger(hora) && hora >= 0 && hora < HORAS_DIA) buckets[hora] = n;
  }
  return buckets;
}

/**
 * ¿La curva dibuja, o declara? Un día sin un solo pedido no es una curva plana que
 * dibujar —eso se leería como "ventas en cero toda la mañana"—: es la ausencia de
 * datos, y la pantalla la DECLARA ("Sin pedidos hoy"), como Pagos y Trayectoria.
 * Misma regla, un juez único: si todos los buckets son 0, no hay nada que trazar.
 */
export function curvaDibuja(buckets: number[]): boolean {
  return buckets.some(n => n > 0);
}
