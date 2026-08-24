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

/**
 * LA VENTANA del eje de la curva de "Hoy": el rango `[0..horaFin]` y su largo `n`. El
 * eje SIEMPRE empieza en MEDIANOCHE (hora 0) y termina en AHORA (`horaFin`).
 *
 * ORIGEN FIJO, no ventana deslizante — "Hoy es lo que ha PASADO". El vacío de la
 * DERECHA sí sería mentira (horas que aún no ocurrieron, dibujadas como cero), y por
 * eso el borde derecho es AHORA. El vacío de la IZQUIERDA es DATO: esas horas pasaron
 * y tuvieron cero pedidos, así que se muestran. NO es la misma decisión invertida —son
 * dos cosas distintas: una hora futura no tiene dato; una hora pasada sin pedidos tiene
 * el dato "cero". Dos beneficios: la curva SUBE desde la base en vez de nacer en su pico
 * contra el borde, y el origen no cambia cada día → el eje se lee por HÁBITO.
 *
 * Ya no hay `primeraActividad` ni span mínimo: con el origen fijo en 0 su razón (que un
 * punto solo no quedara degenerado contra el borde) desaparece. `inicioEje` no depende
 * de los datos.
 *
 * `buckets` sólo se usa para EXTENDER el borde derecho si por desfase de reloj hubiera
 * actividad "futura" (`ultimaAct > horaActual`), para no esconderla.
 */
export function ventanaCurvaHoy(
  buckets: number[],
  horaActual: number,
): { inicioEje: number; horaFin: number; n: number } {
  const ultimaAct = buckets.reduce((last, c, i) => (c > 0 ? i : last), 0);
  const horaFin = Math.max(horaActual, ultimaAct);
  return { inicioEje: 0, horaFin, n: horaFin + 1 };
}

/**
 * Hora del día (0–23) → etiqueta de reloj (es-CO): 12 a.m. · 6 a.m. · 12 m. ·
 * 3 p.m. … Fuente ÚNICA para el eje de la curva Y el tag de alcance horario de
 * Pedidos, para que el mismo bucket se lea igual en las dos superficies.
 */
export function relojLabel(h: number): string {
  if (h === 0)  return '12 a.m.';
  if (h === 12) return '12 m.';
  return h < 12 ? `${h} a.m.` : `${h - 12} p.m.`;
}
