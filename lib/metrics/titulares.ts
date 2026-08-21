import { formatCOP } from '@duna/core/utils';
import { PERIODO_SUJETO, PERIODO_EN_CURSO, type PeriodoKey } from '@/lib/metrics/periodo';
import { CARTERA_DIAS_MEDIO, type ResumenCartera } from '@/lib/metrics/cartera';
import type { FilaMargen } from '@/lib/metrics/margen';
import type { Concentracion } from '@/lib/metrics/concentracion';

// LOS TITULARES de Analítica: la respuesta primero, la evidencia después.
//
// El rediseño acertó las PREGUNTAS y falló la PRESENTACIÓN: cada bloque abría
// con la evidencia —una tabla, un chart de dos líneas, tres buckets— y dejaba la
// respuesta para que el lector la dedujera. Eso es una página de analista. Un
// dueño lee la frase, y solo abre el detalle si la frase lo sorprende.
//
// Es exactamente el patrón de `lib/metrics/insights.ts` aplicado a la página que
// se construyó sin él, y hereda sus dos reglas duras:
//
//   - **Texto = HECHO, nunca instrucción ni causa inventada.** "Te quedaron $X
//     después de costos", jamás "deberías subir precios" ni "por eso bajaron las
//     ventas".
//   - **Preferir callar a afirmar sin base.** Sin ventas no se fabrica un titular
//     con un cero; se dice que no hay ventas, que es el hecho verdadero.
//
// PURO y testeado (capa 1). Vive fuera del componente porque la redacción de
// estas frases ES la decisión de producto de este pase: si viviera en el JSX,
// cambiar un `if` de plural rompería el titular sin que nada lo notara.

/**
 * Titular de RENTABILIDAD. La primera línea que lee el dueño, y la que responde
 * "¿gané plata?" sin abrir nada.
 *
 * `hayVentas` viaja aparte del margen porque **cero y "no hubo ventas" son
 * hechos distintos**: un margen de 0 con ventas significa que se vendió justo al
 * costo —información real y bastante alarmante—, y un 0 sin ventas solo significa
 * que no pasó nada. Colapsarlos haría que un mes tranquilo se leyera como un mes
 * catastrófico.
 */
export function titularRentabilidad(input: {
  periodo:     PeriodoKey;
  margenTotal: number;
  hayVentas:   boolean;
}): string {
  const sujeto = PERIODO_SUJETO[input.periodo];
  // Un período CERRADO se narra en pasado: "el mes pasado no hay ventas todavía"
  // le promete al dueño un cambio en un mes que ya terminó.
  if (!input.hayVentas) {
    return PERIODO_EN_CURSO[input.periodo]
      ? `${sujeto} no hay ventas cobradas todavía`
      : `${sujeto} no hubo ventas cobradas`;
  }
  // La PÉRDIDA se nombra pérdida. "Te quedaron −$50.000" obliga a decodificar un
  // signo; "perdiste" no se puede leer mal, y es justo el caso en que leer mal
  // cuesta más caro.
  if (input.margenTotal < 0)  return `${sujeto} perdiste ${formatCOP(Math.abs(input.margenTotal))} después de costos`;
  if (input.margenTotal === 0) return `${sujeto} no te quedó nada después de costos`;
  return `${sujeto} te quedaron ${formatCOP(input.margenTotal)} después de costos`;
}

/**
 * Segunda línea de RENTABILIDAD: el SKU que más plata dejó.
 *
 * `null` cuando no hay filas costeables — sin producto que nombrar, la línea no
 * se emite en vez de decir "Tu producto más rentable: —".
 *
 * Toma la PRIMERA fila y no re-ordena: `agregarMargenPorSku` ya devuelve la tabla
 * ordenada por margen total desc. Re-ordenar acá sería una segunda definición de
 * "más rentable" que podría discrepar de la que muestra la tabla justo debajo.
 */
export function titularProductoEstrella(filas: FilaMargen[]): string | null {
  const mejor = filas[0];
  if (!mejor) return null;
  return `Tu producto más rentable: ${mejor.producto} (${formatCOP(mejor.margenTotal)})`;
}

/**
 * Titular de CARTERA. Lidera con el total y **asciende el bucket vencido a la
 * primera línea** cuando existe.
 *
 * Que lo viejo salga en el titular es el punto entero del pase: antes había que
 * leer tres tarjetas y compararlas para descubrir que una parte de la plata
 * llevaba semanas quieta. Es el único dato de esta página que puede exigir una
 * llamada hoy mismo.
 */
export function titularCartera(cartera: ResumenCartera): string {
  const base = `${formatCOP(cartera.total)} en la calle`;
  const vencido = cartera.buckets.find(b => b.bucket === 'vencido');
  if (!vencido || vencido.conteo === 0) return base;
  return `${base} · ${formatCOP(vencido.monto)} hace más de ${CARTERA_DIAS_MEDIO} días`;
}

/**
 * Titular de CLIENTES: la frase de concentración, ascendida a encabezado del
 * bloque.
 *
 * `null` respeta la guarda de muestra de `concentracionIngresos` — con menos
 * clientes que el piso, el % es 100% por aritmética y no por concentración, así
 * que el bloque abre sin titular y muestra la lista. Callar es el
 * comportamiento correcto, no un hueco.
 */
export function titularConcentracion(c: Concentracion): string | null {
  if (c.pct === null) return null;
  const n = c.top.length;

  // EL PADRÓN VA EN LA FRASE, y es el arreglo que motivó esta redacción: el
  // porcentaje no se puede leer sin saber contra cuántos. Antes decía "viene de 5
  // clientes" y el único conteo a la vista era el de RECURRENCIA —el padrón entero,
  // acumulado—, que parecía su denominador y no lo era: en dev, 63% calculado sobre
  // 10 pagadores junto a un "18 clientes" de otra métrica.
  //
  // `que pagaron` no es adorno: declara la POBLACIÓN. Un cliente con pedido
  // pendiente no está en esos N.
  const cuerpo = `${Math.round(c.pct)}% viene de ${n} de los ${c.clientes} clientes que pagaron`;

  // ── LA ESTRUCTURA NO CAMBIA ENTRE BANDAS, SÓLO EL ADJETIVO ─────────────────
  //
  // Las tres dicen lo mismo en el mismo orden. Es lo que permite compararlas de un
  // vistazo entre recargas o entre períodos: si la de "repartido" cambiara de sujeto
  // ("los 5 que más pagaron dejaron el 35%"), el operador tendría que releer la
  // frase entera para ver qué cambió, en vez de leer una palabra.
  //
  // Y CARACTERIZAR ES DECIR EL HECHO, no aconsejar. La frase neutra ya interpretaba
  // por omisión: el MISMO tono para 63% y para 5% le dice al operador que significan
  // lo mismo, y no es cierto. "Están concentrados" es estado, como el "no entró
  // ningún pago" de Pagos; "deberías diversificar" sería consejo, y eso no entra.
  if (c.banda === 'concentrado') return `Tus ingresos están concentrados: el ${cuerpo}`;
  if (c.banda === 'repartido')   return `Tus ingresos están repartidos: el ${cuerpo}`;
  // Banda del medio: el hecho sin adjetivo. No es indecisión — es preferir callar a
  // afirmar sin base, con el precedente de `insightEnBanda`.
  return `El ${cuerpo}`;
}
