import {
  BUSINESS_TZ, dayKeyStart, zonedDayKey,
  startOfZonedDay, startOfZonedWeek, startOfZonedMonth, startOfZonedYear,
} from '@duna/core/timezone';

// ── EL BUCKETEO DEL STRIP DE PAGOS ──────────────────────────────────────────
//
// La tira agrupa los pagos del rango en barras a lo largo del tiempo. Dos reglas
// duras, y las dos son la MISMA idea —el eje temporal se ancla al CALENDARIO, no
// al rango— aplicada a la escala y al corte:
//
// 1. ESCALERA de cinco peldaños con tope de 31 barras. Se elige el peldaño MÁS
//    FINO cuyo conteo de buckets ≤ 31: día → semana → mes → trimestre → año. Si
//    ni el año alcanza (>31 años), el strip NO dibuja (devuelve null); la tabla
//    sigue completa. NUNCA se trunca a 31 barras de un peldaño más fino —eso
//    escondería datos sin decirlo—.
//
// 2. Los buckets se anclan al CALENDARIO (semana = lunes de Bogotá vía
//    `startOfZonedWeek`), no al inicio del rango. Es lo que hace que la MISMA
//    semana caiga en el MISMO bucket sin importar por dónde entró el rango —el
//    defecto de la maqueta, que hacía `floor((fecha - desde) / 7)` y cortaba
//    distinto según el `desde`—. La primera y la última barra pueden ser buckets
//    PARCIALES (el rango arranca a mitad de semana / termina a mitad de mes): es
//    correcto, y `parcial` lo marca para que el eje lo declare.
//
// Puro y en `lib/` para poder afirmar las dos reglas en capa 1 (el conteo ≤31 por
// fuerza bruta, y que sin el anclaje dos rangos del mismo período cortan distinto).

export const MAX_BARRAS = 31;

export type Escala = 'dia' | 'semana' | 'mes' | 'trimestre' | 'anio';

/** La escalera, de más fino a más grueso. El primero que quepa en 31 gana. */
const ESCALERA: Escala[] = ['dia', 'semana', 'mes', 'trimestre', 'anio'];

// Bogotá NO tiene horario de verano, así que un día son 86.4M ms EXACTOS y la
// aritmética de días/semanas sobre instantes de medianoche es entera y segura.
const DIA_MS = 86_400_000;

export interface Bucket {
  /** Clave estable del bucket; un pago cae en él si `bucketKey(fecha)` coincide. */
  key: string;
  /** Instante UTC del inicio del bucket (medianoche Bogotá del día ancla). */
  inicio: Date;
  /** Instante UTC del inicio del bucket SIGUIENTE (fin exclusivo). */
  fin: Date;
  /** El bucket-calendario se sale del rango seleccionado (sólo el 1º y el último). */
  parcial: boolean;
}

const anioDe = (ref: Date, tz: string) => Number(zonedDayKey(ref, tz).slice(0, 4));
const mesDe  = (ref: Date, tz: string) => Number(zonedDayKey(ref, tz).slice(5, 7));

/** El inicio (instante UTC) del bucket de `escala` que CONTIENE a `ref`. */
function inicioBucket(ref: Date, escala: Escala, tz: string): Date {
  switch (escala) {
    case 'dia':       return startOfZonedDay(ref, tz, 0);
    case 'semana':    return startOfZonedWeek(ref, tz, 0);                       // lunes
    case 'mes':       return startOfZonedMonth(ref, tz, 0);
    case 'trimestre': return startOfZonedMonth(ref, tz, -((mesDe(ref, tz) - 1) % 3));
    case 'anio':      return startOfZonedYear(ref, tz, 0);
  }
}

/** El inicio del bucket SIGUIENTE al que contiene a `ref`. */
function siguienteBucket(ini: Date, escala: Escala, tz: string): Date {
  switch (escala) {
    case 'dia':       return startOfZonedDay(ini, tz, 1);
    case 'semana':    return startOfZonedWeek(ini, tz, 1);
    case 'mes':       return startOfZonedMonth(ini, tz, 1);
    case 'trimestre': return startOfZonedMonth(ini, tz, 3);
    case 'anio':      return startOfZonedYear(ini, tz, 1);
  }
}

/** Cuántos buckets de `escala` TOCA el rango [desde, hasta] (instantes de día). */
function contarBuckets(desde: Date, hasta: Date, escala: Escala, tz: string): number {
  const a = inicioBucket(desde, escala, tz);
  const b = inicioBucket(hasta, escala, tz);
  switch (escala) {
    case 'dia':       return Math.round((+b - +a) / DIA_MS) + 1;
    case 'semana':    return Math.round((+b - +a) / (7 * DIA_MS)) + 1;
    case 'mes':       return mesesEntre(a, b, tz) + 1;
    case 'trimestre': return Math.floor(mesesEntre(a, b, tz) / 3) + 1;
    case 'anio':      return anioDe(b, tz) - anioDe(a, tz) + 1;
  }
}

/** Meses de calendario entre dos inicios de bucket (b ≥ a). */
function mesesEntre(a: Date, b: Date, tz: string): number {
  return (anioDe(b, tz) * 12 + mesDe(b, tz)) - (anioDe(a, tz) * 12 + mesDe(a, tz));
}

/**
 * El peldaño MÁS FINO cuyo conteo de buckets ≤ 31, o `null` si ni el año alcanza
 * (>31 años). `desde`/`hasta` son day keys (`YYYY-MM-DD`) del rango; se anclan al
 * inicio del día en Bogotá para no reabrir la trampa de TZ (§ dayKeyStart).
 */
export function elegirEscala(desdeKey: string, hastaKey: string, tz = BUSINESS_TZ): Escala | null {
  const desde = dayKeyStart(desdeKey, tz);
  const hasta = dayKeyStart(hastaKey, tz);
  for (const escala of ESCALERA) {
    if (contarBuckets(desde, hasta, escala, tz) <= MAX_BARRAS) return escala;
  }
  return null; // ni el año cabe en 31 barras: el strip no dibuja.
}

/** El bucket (su `key`) en el que cae un pago, anclado al calendario. */
export function bucketKey(fecha: Date, escala: Escala, tz = BUSINESS_TZ): string {
  const ini = inicioBucket(fecha, escala, tz);
  switch (escala) {
    case 'dia':       return zonedDayKey(ini, tz);              // YYYY-MM-DD
    case 'semana':    return zonedDayKey(ini, tz);              // el lunes, YYYY-MM-DD
    case 'mes':       return zonedDayKey(ini, tz).slice(0, 7);  // YYYY-MM
    case 'trimestre': return `${anioDe(ini, tz)}-T${Math.floor((mesDe(ini, tz) - 1) / 3) + 1}`;
    case 'anio':      return String(anioDe(ini, tz));
  }
}

/**
 * La lista ORDENADA de buckets que cubre el rango, de `desde` a `hasta` inclusive.
 * Incluye buckets vacíos (una barra de 0 sigue siendo una barra) y marca `parcial`
 * en el primero/último cuando el rango arranca/termina a mitad de bucket.
 */
export function bucketsDelRango(desdeKey: string, hastaKey: string, escala: Escala, tz = BUSINESS_TZ): Bucket[] {
  const rangoIni = dayKeyStart(desdeKey, tz);
  const rangoFin = startOfZonedDay(dayKeyStart(hastaKey, tz), tz, 1); // exclusivo: día siguiente a `hasta`
  const ultimo   = inicioBucket(dayKeyStart(hastaKey, tz), escala, tz);
  const out: Bucket[] = [];
  let cursor = inicioBucket(rangoIni, escala, tz);
  while (+cursor <= +ultimo) {
    const fin = siguienteBucket(cursor, escala, tz);
    out.push({
      key: bucketKey(cursor, escala, tz),
      inicio: cursor,
      fin,
      // Parcial si el bucket-calendario se sale del rango. Por construcción sólo el
      // primero (arranca antes de `desde`) y el último (termina después de `hasta`).
      parcial: +cursor < +rangoIni || +fin > +rangoFin,
    });
    cursor = fin;
  }
  return out;
}

/**
 * Conveniencia para el consumidor: elige la escala y devuelve los buckets, o `null`
 * si el rango no dibuja (>31 años). El strip llama a esto una vez.
 */
export function bucketear(desdeKey: string, hastaKey: string, tz = BUSINESS_TZ): { escala: Escala; buckets: Bucket[] } | null {
  const escala = elegirEscala(desdeKey, hastaKey, tz);
  if (escala === null) return null;
  return { escala, buckets: bucketsDelRango(desdeKey, hastaKey, escala, tz) };
}
