// Una LISTA PLANA sobre slots FIJOS del modelo (los beneficios de Suscripción: bullet1..4). El editor
// la muestra como filas + "+ Agregar" + "×"; el modelo NO cambia (siguen siendo campos planos).
//
// DECISIÓN (diagnóstico b): se COMPACTA, no se dejan huecos. El storefront ya cierra huecos al mostrar
// (`.filter`); si el editor dejara un agujero interior al quitar la fila del medio, editor y storefront
// coincidirían SÓLO en lo renderizado, no en el DATO —y el operador que borra la fila 2 quedaría con un
// hueco invisible—. Compactando, la lista del editor ES el dato empacado y el `.filter` del storefront
// es un no-op → coinciden en el dato. El orden de los llenos se preserva (igual que el filter).
//
// PURO (capa 1).

/** Empaca: los valores no-vacíos primero (en su orden), rellenando con '' hasta `n`. Sin huecos. */
export function empacar(valores: string[], n: number): string[] {
  const llenos = valores.map(v => v ?? '').filter(v => v.trim() !== '');
  const out = llenos.slice(0, n);
  while (out.length < n) out.push('');
  return out;
}

/** Quita el `i`-ésimo valor y COMPACTA (los de abajo suben). Longitud fija (rellena con ''). */
export function quitar(valores: string[], i: number): string[] {
  return empacar(valores.filter((_, idx) => idx !== i), valores.length);
}

/** El índice del ÚLTIMO valor no-vacío, o -1 si están todos vacíos. Cuántas filas mostrar de arranque
 *  = este + 1 (así una lista con hueco interior legado muestra el hueco como fila vacía, para resolverlo). */
export function ultimoLleno(valores: string[]): number {
  let ultimo = -1;
  valores.forEach((v, i) => { if ((v ?? '').trim() !== '') ultimo = i; });
  return ultimo;
}
