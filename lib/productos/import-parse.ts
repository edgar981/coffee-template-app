// Parseo del pegado del import de catálogo — PURO y testeable (capa 1). Es la parte
// riesgosa del import: convierte lo que el owner pega (una hoja de cálculo, una lista de
// WhatsApp, texto con comas) en filas.
//
// LA DECISIÓN: TSV-FIRST, PERO NUNCA EN SILENCIO. El dato limpio sale de una hoja de
// cálculo (copiar de una hoja da TSV), así que el default corta por TAB. Pero:
// - el separador es re-elegible y la grilla RE-VE el parseo, así que un pegado con comas
//   o `;` se corrige sin adivinar;
// - una línea SIN separador es una fila de sólo-Nombre (pegar una lista de nombres de un
//   chat → cada línea un nombre; precio y categoría se completan en la grilla).
// Nada se importa mal-parseado en silencio porque la grilla lo muestra y es editable.

export type Sep = 'tab' | 'coma' | 'puntoycoma';
export const SEPARADOR: Record<Sep, string> = { tab: '\t', coma: ',', puntoycoma: ';' };
export const SEP_LABEL: Record<Sep, string> = { tab: 'Tabulación', coma: 'Coma', puntoycoma: 'Punto y coma' };

/** Una fila de la grilla — todo string (el input crudo antes de crear el producto). */
export interface FilaGrid { nombre: string; precio: string; categoria: string; sku: string; stock: string; }

/** El separador más probable de la 1ª línea, para no obligar a elegir. Sin ninguno →
 *  `tab` (que no corta esa línea, así cada línea queda como una fila de sólo-nombre). */
export function detectarSep(texto: string): Sep {
  const primera = texto.split(/\r?\n/).find(l => l.trim() !== '') ?? '';
  if (primera.includes('\t')) return 'tab';
  if (primera.includes(';'))  return 'puntoycoma';
  if (primera.includes(','))  return 'coma';
  return 'tab';
}

/** Cada línea una fila; cada línea cortada por el separador en Nombre·Precio·Categoría·
 *  SKU·Stock (ese orden). Salta un encabezado si la 1ª celda es "nombre"/"producto"/"name". */
export function parsear(texto: string, sep: Sep): FilaGrid[] {
  const lineas = texto.split(/\r?\n/).map(l => l.replace(/\s+$/, '')).filter(l => l.trim() !== '');
  const filas: FilaGrid[] = [];
  lineas.forEach((linea, i) => {
    const c = linea.split(SEPARADOR[sep]).map(x => x.trim());
    if (i === 0 && /^(nombre|producto|name)$/i.test(c[0] ?? '')) return;
    filas.push({ nombre: c[0] ?? '', precio: c[1] ?? '', categoria: c[2] ?? '', sku: c[3] ?? '', stock: c[4] ?? '' });
  });
  return filas;
}

/** Por qué una fila NO puede crearse todavía (nombre y categoría son obligatorios en el
 *  modelo). `null` = lista. Es la MISMA regla que el endpoint rechaza por fila. */
export function motivoInvalida(f: FilaGrid): string | null {
  if (!f.nombre.trim())    return 'Falta el nombre';
  if (!f.categoria.trim()) return 'Falta la categoría';
  return null;
}
