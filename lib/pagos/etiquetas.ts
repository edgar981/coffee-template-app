import { BUSINESS_TZ } from '@duna/core/timezone';
import type { Escala } from './bucketeo';

// El RECORTE DE TIEMPO activo (el chip). Lleva su `escala` y su `key` para filtrar
// (`bucketKey(fecha, escala) === key`), y su `etiqueta` ya resuelta para pintarse solo.
// Nace de un clic en barra (bucket a la escala del strip) o en una celda de fecha
// (siempre 'dia'): los dos son un recorte de tiempo, con la misma forma.
export interface RecorteTiempo { escala: Escala; key: string; etiqueta: string; }

// Etiquetas del strip — el eje y el CHIP de bucket. Puras y es-CO/Bogotá.
//
// El chip vive en la cabecera FIJA mientras el strip scrollea, así que su etiqueta
// tiene que entenderse SOLA —el operador ve el chip sin ver la barra que lo produjo—:
// "jue 27 ago", "semana del 10 ago", "sep 2026", nunca "1 seleccionado". La misma
// etiqueta sirve para el eje del strip.

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const fmtDiaSemana = new Intl.DateTimeFormat('es-CO', { timeZone: BUSINESS_TZ, weekday: 'short', day: 'numeric', month: 'short' });
const fmtDia       = new Intl.DateTimeFormat('es-CO', { timeZone: BUSINESS_TZ, day: 'numeric', month: 'short' });
const fmtMes       = new Intl.DateTimeFormat('es-CO', { timeZone: BUSINESS_TZ, month: 'short', year: 'numeric' });
const compacta = (s: string) => s.replace(/\./g, '').replace(/\sde\s/g, ' ');
const anioDe = (d: Date) => Number(new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ, year: 'numeric' }).format(d));
const mesIdx = (d: Date) => Number(new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ, month: 'numeric' }).format(d)) - 1;

/** El título del strip según la escala: "Ingresos por semana". */
export function tituloEscala(escala: Escala): string {
  return { dia: 'Ingresos por día', semana: 'Ingresos por semana', mes: 'Ingresos por mes',
           trimestre: 'Ingresos por trimestre', anio: 'Ingresos por año' }[escala];
}

/** La etiqueta COMPLETA de un bucket, para el chip. Se entiende sola. */
export function etiquetaBucket(inicio: Date, escala: Escala): string {
  switch (escala) {
    case 'dia':       return compacta(fmtDiaSemana.format(inicio));      // "jue 27 ago"
    case 'semana':    return `semana del ${compacta(fmtDia.format(inicio))}`; // "semana del 10 ago"
    case 'mes':       return compacta(fmtMes.format(inicio));            // "sep 2026"
    case 'trimestre': return `T${Math.floor(mesIdx(inicio) / 3) + 1} ${anioDe(inicio)}`; // "T3 2026"
    case 'anio':      return String(anioDe(inicio));                     // "2026"
  }
}

/** La etiqueta CORTA para el eje del strip (menos ancho por barra). */
export function etiquetaEje(inicio: Date, escala: Escala): string {
  switch (escala) {
    case 'dia':       return String(Number(new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ, day: 'numeric' }).format(inicio))); // "27"
    case 'semana':    return compacta(fmtDia.format(inicio));            // "10 ago"
    case 'mes':       return cap(new Intl.DateTimeFormat('es-CO', { timeZone: BUSINESS_TZ, month: 'short' }).format(inicio).replace('.', '')); // "Ago"
    case 'trimestre': return `T${Math.floor(mesIdx(inicio) / 3) + 1}`;   // "T3"
    case 'anio':      return String(anioDe(inicio));                     // "2026"
  }
}
