// Parseo del import de catálogo — PURO y testeable (capa 1). Es la parte riesgosa del
// import: convierte lo que entra (una hoja pegada, un CSV subido, una lista de WhatsApp)
// en filas. PEGADO y ARCHIVO usan ESTE MISMO parseo — no hay ruta paralela: los dos
// producen `FilaGrid[]` antes de cualquier validación (la valida `motivoInvalida`, y el
// endpoint la re-valida por fila).
//
// DOS EJES, y la interfaz los nombra los DOS (era el malentendido de la coma):
//   · SALTO DE LÍNEA = un producto (un producto por línea);
//   · el SEPARADOR    = corta cada línea en columnas Nombre·Precio·Categoría·SKU·Stock.
// El default es TAB (una hoja pegada trae tabs); la coma/`;` son OPT-IN. NO se auto-
// detecta la coma: hacerlo convertía tres nombres pegados en tres COLUMNAS de un
// producto sin que nadie lo eligiera. Con Tab ese mismo pegado cae como un nombre raro
// —visiblemente mal— en vez de parecer correcto.
//
// EL TOKENIZADOR ES QUOTE-AWARE (RFC-4180): un campo que EMPIEZA con comilla está
// entrecomillado y el separador/salto de línea de adentro son literales (`"Café, tueste
// medio",28000` es UN campo, no dos). Un campo que no empieza con comilla la trata como
// texto (`Café 12"` sobrevive). Sin esto, un pegado con `"Café, tueste medio"` se partía
// mal EN SILENCIO — el defecto que esto arregla, independiente del CSV.

export type Sep = 'tab' | 'coma' | 'puntoycoma';
export const SEPARADOR: Record<Sep, string> = { tab: '\t', coma: ',', puntoycoma: ';' };
export const SEP_LABEL: Record<Sep, string> = { tab: 'Tabulación', coma: 'Coma', puntoycoma: 'Punto y coma' };

/** Una fila de la grilla — todo string (el input crudo antes de crear el producto). */
export interface FilaGrid { nombre: string; precio: string; categoria: string; sku: string; stock: string; }

/**
 * El separador por DEFECTO de un ARCHIVO, leído de su extensión — no de su contenido.
 * Un `.csv` es, por definición del formato, separado por comas; un `.tsv`, por tabs.
 * Esto NO es el auto-detector que se quitó: el usuario ELIGIÓ un archivo `.csv`, así que
 * la coma es una lectura del formato, no una adivinanza sobre lo que escribió. El pegado,
 * en cambio, siempre arranca en Tab (no hay extensión que declare nada).
 */
export function sepDeArchivo(nombre: string): Sep {
  const n = nombre.toLowerCase();
  if (n.endsWith('.tsv')) return 'tab';
  if (n.endsWith('.csv')) return 'coma';
  return 'tab';
}

/**
 * Tokeniza el texto en filas de celdas respetando comillas (RFC-4180). Una comilla sólo
 * ABRE un campo entrecomillado si es el primer carácter del campo; adentro, `""` es una
 * comilla literal y el separador/`\n` son literales. `\r\n` y `\n` cierran fila. Sirve
 * para tab, coma y `;` por igual.
 */
export function tokenizar(texto: string, sep: Sep): string[][] {
  const d = SEPARADOR[sep];
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let enComillas = false;
  let campoInicia = true; // en el 1er carácter del campo (decide si una comilla abre)
  const n = texto.length;
  let i = 0;
  while (i < n) {
    const ch = texto[i];
    if (enComillas) {
      if (ch === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i += 2; continue; } // comilla escapada
        enComillas = false; i++; continue;                            // cierra
      }
      campo += ch; i++; continue;
    }
    if (campoInicia && ch === '"') { enComillas = true; campoInicia = false; i++; continue; }
    if (ch === d)    { fila.push(campo); campo = ''; campoInicia = true; i++; continue; }
    if (ch === '\r') { i++; continue; }                               // el LF cierra la fila
    if (ch === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; campoInicia = true; i++; continue; }
    campo += ch; campoInicia = false; i++;
  }
  fila.push(campo); filas.push(fila);
  return filas;
}

/** Cada fila una fila; cada fila cortada por el separador en Nombre·Precio·Categoría·
 *  SKU·Stock (ese orden). Ignora filas en blanco y recorta cada celda. Salta un
 *  encabezado si la 1ª celda es exactamente "nombre"/"producto"/"name" (case-insensitive):
 *  un producto llamado así es improbable, y el match es EXACTO —"Nombre del producto" NO
 *  se salta, cae como fila editable que el operador borra—, para no tragarse un producto
 *  real por adivinar de más. Pegado y archivo pasan por acá igual. */
export function parsear(texto: string, sep: Sep): FilaGrid[] {
  const filasRaw = tokenizar(texto, sep)
    .map(cs => cs.map(x => x.trim()))
    .filter(cs => cs.some(x => x !== ''));
  const filas: FilaGrid[] = [];
  filasRaw.forEach((c, i) => {
    if (i === 0 && /^(nombre|producto|name)$/i.test(c[0] ?? '')) return; // encabezado
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
