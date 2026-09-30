// Una LISTA PLANA sobre slots FIJOS del modelo — nació para los beneficios de Suscripción (bullet1..4)
// y GENERALIZA (§ HISTORIA-FOTOS-PANEL-Y-GIRO-1) a los slots de imagen del collage de brandStory
// (imagen1..4): el editor la muestra como filas + "+ Agregar"/flechas/"×"; el modelo NO cambia (siguen
// siendo campos planos). El valor de cada slot puede ser texto o una URL — la lógica no distingue.
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

/** Mueve el valor en `i` una posición (arriba con dir=-1, abajo con dir=1) — SWAP posicional, SIN
 *  compactar (§ HISTORIA-FOTOS-PANEL-Y-GIRO-1: las flechas del collage de brandStory; mismo patrón
 *  que `mover` de `RepeaterEditor.tsx`). Intercambia también huecos —no filtra vacíos, sólo cambia de
 *  lugar—. Sin efecto si `i + dir` cae fuera de rango. */
export function mover(valores: string[], i: number, dir: -1 | 1): string[] {
  const j = i + dir;
  if (j < 0 || j >= valores.length) return valores;
  const out = valores.slice();
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}
