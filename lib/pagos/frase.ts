import { formatCOP } from '@duna/core/utils';
import { BUSINESS_TZ, dayKeyStart, zonedDayKey } from '@duna/core/timezone';
import { etiquetaDiaCorto, type RecorteTiempo } from './etiquetas';

// ── LA FRASE DE PAGOS ───────────────────────────────────────────────────────
//
// Reemplaza al título, al descargo del ledger y al stat "Total del período": la
// pantalla abre diciendo la RESPUESTA —"Este mes entraron $ 315.000 en 11 pagos"—
// en vez de un rótulo y una cifra que el lector tiene que juntar.
//
// Es el patrón de `lib/metrics/titulares.ts` (Analítica) aplicado a Pagos, y hereda
// sus dos reglas duras:
//   - **Texto = HECHO**, nunca instrucción ni causa inventada.
//   - **El vacío es la MISMA frase**, no un mensaje aparte: "Este mes no entró ningún
//     pago por Daviplata" dice qué pasó; "Sin resultados" hace dudar del filtro.
//
// PURO y en `lib/` por el motivo de siempre: la redacción ES la decisión de producto.
// Dentro del JSX, cambiar un `if` de concordancia rompería la frase sin que nada lo
// notara. Los cuatro ejes que se testean son concordancia, vacío, bucket y método.
//
// La frase sale en PARTES y no en un string, porque la cifra y el conteo van en
// semibold: un string obligaría al componente a re-partirlo con un regex, que es
// exactamente donde la tipografía se desincroniza de la gramática.

/** Un tramo de la frase. `fuerte` = va en semibold (la cifra y el conteo). */
export interface Tramo { t: string; fuerte?: boolean }

export interface Frase {
  /**
   * Eyebrow: el rango activo, con el método si filtra ("1 ago – 19 ago · Nequi").
   *
   * HOY SIN CONSUMIDOR, y declarado para que no se lea como un descuido: la cabecera
   * lo retiró —el rango ya se lee en el date picker, y la zona fija no scrollea— y su
   * destino es el topbar. Se conserva porque la línea ya está resuelta y testeada; si
   * el topbar no llega, se borra.
   */
  eyebrow: string;
  /** La frase en tramos, para pintarla con la cifra y el conteo en semibold. */
  tramos: Tramo[];
  /** La línea muted de abajo: promedio y mejor día, o el descargo del vacío. */
  subtitulo: string;
}

export interface EntradaFrase {
  /** Day keys del rango activo (`YYYY-MM-DD`). */
  desde: string;
  hasta: string;
  /** El recorte de un bucket (clic en un punto), si lo hay. */
  bucket: RecorteTiempo | null;
  /** El método filtrado, ya como etiqueta ("Nequi"), o `null` si son todos. */
  metodoLabel: string | null;
  total: number;
  conteo: number;
  /**
   * El día con más plata del recorte. `null` cuando la curva NO dibuja: sin curva
   * no hay de dónde leer ese pico, y afirmarlo igual sería una cifra sin respaldo
   * visible (misma regla de "preferir callar" de los insights).
   */
  mejorDia: { etiqueta: string; monto: number } | null;
  /** El reloj, como parámetro, para que un test pueda fijarlo. */
  ahora: Date;
}

/**
 * El SUJETO de la frase y su concordancia.
 *
 * `unDia` decide entró/entraron. La regla es la del diseño: **singular cuando el
 * alcance es un solo bucket o un solo día** ("El jue 14 ago entró…"), plural cuando
 * es un período ("Este mes entraron…"). No es la concordancia estricta del castellano
 * con el monto —es la del alcance— y por eso está acá y no en el JSX.
 */
function alcanceDe(e: EntradaFrase): { sujeto: string; unDia: boolean } {
  // 1. Un bucket recortado manda sobre el rango: es lo que el operador acaba de elegir.
  if (e.bucket) {
    const et = e.bucket.etiqueta;
    switch (e.bucket.escala) {
      case 'dia':    return { sujeto: `El ${et}`, unDia: true };   // "El jue 14 ago"
      case 'semana': return { sujeto: `La ${et}`, unDia: true };   // "La semana del 10 ago"
      case 'mes':    return { sujeto: `En ${et}`, unDia: true };   // "En sep 2026"
    }
  }
  // 2. Un rango de UN día: hoy se nombra "Hoy"; otro día, por su fecha.
  if (e.desde === e.hasta) {
    const hoyKey = zonedDayKey(e.ahora, BUSINESS_TZ);
    if (e.desde === hoyKey) return { sujeto: 'Hoy', unDia: true };
    return { sujeto: `El ${etiquetaDiaCorto(dayKeyStart(e.desde, BUSINESS_TZ))}`, unDia: true };
  }
  // 3. El mes en curso —el default de la pantalla— se nombra, no se deletrea.
  const hoy = zonedDayKey(e.ahora, BUSINESS_TZ);
  if (e.desde.slice(0, 7) === hoy.slice(0, 7) && e.desde.endsWith('-01') && e.hasta === hoy) {
    return { sujeto: 'Este mes', unDia: false };
  }
  // 4. Cualquier otro rango se dice tal cual: "Del 1 ago al 19 ago".
  const d = etiquetaDiaCorto(dayKeyStart(e.desde, BUSINESS_TZ));
  const h = etiquetaDiaCorto(dayKeyStart(e.hasta, BUSINESS_TZ));
  return { sujeto: `Del ${d} al ${h}`, unDia: false };
}

/** El eyebrow: el rango activo y, si filtra, el método. */
function eyebrowDe(e: EntradaFrase): string {
  const d = etiquetaDiaCorto(dayKeyStart(e.desde, BUSINESS_TZ));
  const h = etiquetaDiaCorto(dayKeyStart(e.hasta, BUSINESS_TZ));
  const rango = e.desde === e.hasta ? d : `${d} – ${h}`;
  return e.metodoLabel ? `${rango} · ${e.metodoLabel}` : rango;
}

/**
 * La frase completa de la cabecera de Pagos.
 *
 * El VACÍO no es un estado aparte: es la misma frase con otra redacción ("no entró
 * ningún pago"), porque lo que el operador necesita saber es que el filtro está bien
 * y simplemente no hubo plata — no que la pantalla falló.
 */
export function fraseDePagos(e: EntradaFrase): Frase {
  const { sujeto, unDia } = alcanceDe(e);
  const eyebrow = eyebrowDe(e);
  const porMetodo = e.metodoLabel ? ` por ${e.metodoLabel}` : '';

  if (e.conteo === 0) {
    return {
      eyebrow,
      tramos: [{ t: `${sujeto} no entró ningún pago${porMetodo}.` }],
      subtitulo: 'No es un error del filtro: simplemente no hubo.',
    };
  }

  const verbo = unDia ? 'entró' : 'entraron';
  const pagos = e.conteo === 1 ? 'pago' : 'pagos';
  const tramos: Tramo[] = [
    { t: `${sujeto} ${verbo} ` },
    { t: formatCOP(e.total), fuerte: true },
    { t: ' en ' },
    { t: `${e.conteo} ${pagos}`, fuerte: true },
    { t: `${porMetodo}.` },
  ];

  const promedio = `Promedio de ${formatCOP(Math.round(e.total / e.conteo))} por pago`;
  const subtitulo = e.mejorDia
    ? `${promedio} · el mejor día fue el ${e.mejorDia.etiqueta} con ${formatCOP(e.mejorDia.monto)}.`
    : `${promedio}.`;

  return { eyebrow, tramos, subtitulo };
}

/**
 * El día con más plata de un conjunto de pagos, para el subtítulo.
 *
 * Agrupa por DÍA de Bogotá (no por el bucket de la curva): "el mejor día" es una
 * afirmación sobre días, y con la curva en semanas seguiría siendo un día lo que se
 * nombra. Devuelve `null` sin pagos — no hay pico que nombrar.
 */
export function mejorDiaDe(
  pagos: { fecha: string | Date; monto: number }[],
  tz = BUSINESS_TZ,
): { etiqueta: string; monto: number } | null {
  const porDia = new Map<string, number>();
  for (const p of pagos) {
    const key = zonedDayKey(new Date(p.fecha), tz);
    porDia.set(key, (porDia.get(key) ?? 0) + p.monto);
  }
  let mejorKey: string | null = null;
  let mejorMonto = -Infinity;
  // Recorre en orden de inserción; con empate gana el PRIMERO que apareció, que es
  // determinista dado el orden de `pagos` (el server ya los entrega ordenados).
  for (const [key, monto] of porDia) {
    if (monto > mejorMonto) { mejorKey = key; mejorMonto = monto; }
  }
  if (mejorKey === null) return null;
  return { etiqueta: etiquetaDiaCorto(dayKeyStart(mejorKey, tz)), monto: mejorMonto };
}
