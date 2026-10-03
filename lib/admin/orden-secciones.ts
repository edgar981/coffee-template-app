import type { BandaId } from '@/lib/config/site-content-defaults';

// LA PIEZA PURA del reordenamiento de bandas del home (§ EDITOR-TIENDA-ORDEN-1, fila 6 del plan de
// `docs/editor-tienda/DISENO.md`). Sin DOM, sin React, sin `postMessage`: el cálculo del nuevo
// `BandaId[]` se extrae para afirmarlo en un test en memoria, no en una sesión real con
// drag-and-drop — mismo criterio que `aplicarAjusteInventario`/`RepeaterEditor.mover`
// (`components/admin/RepeaterEditor.tsx`), que es el precedente directo de este archivo: ESTE
// reordena CLAVES de banda en vez de ítems de un repeater, pero la operación (swap/splice sobre un
// array corto) es la misma forma.
//
// `TiendaPaginas.tsx` es el ÚNICO llamador: es dueño del `BandaId[]` local (sembrado una vez de
// `content.orden` resuelto, § `resolverOrden`), y usa estas funciones para calcular el array
// SIGUIENTE ante un drag, un `dragEnter`, o una flecha de teclado en el asa — nunca para VALIDAR lo
// que llega de la red (eso es `resolverOrden`/`ordenEditableSchema`, en `lib/config/
// site-content-defaults.ts`/`lib/config/site-content-schema.ts`: el dominio CERRADO de `BANDA_IDS`
// y el sin-repetidos). Estas funciones ASUMEN que `orden` ya es válido —exactamente los 9 ids, sin
// duplicar— porque siempre arrancan de un `orden` que ya pasó por `resolverOrden`; preservan esa
// validez por construcción (mover un elemento dentro de un array no cambia su conjunto).

/**
 * Mueve `id` a la posición `indiceDestino` (clamped a `[0, orden.length - 1]`), preservando el
 * resto del orden relativo. Si `id` no está en `orden`, o el destino clamped coincide con la
 * posición actual, devuelve la MISMA referencia — así el llamador puede usar `===` para detectar
 * "no cambió" sin recorrer el array (evita marcar sucio el autoguardado o reenviar al iframe por un
 * drag que no movió nada).
 */
export function moverBandaAIndice(orden: readonly BandaId[], id: BandaId, indiceDestino: number): BandaId[] {
  const actual = orden.indexOf(id);
  if (actual < 0) return orden as BandaId[];
  const destino = Math.max(0, Math.min(orden.length - 1, indiceDestino));
  if (destino === actual) return orden as BandaId[];
  const sinId = orden.filter((v) => v !== id);
  const nuevo = sinId.slice();
  nuevo.splice(destino, 0, id);
  return nuevo;
}

/**
 * Mueve `id` un paso en `dir` (-1 arriba, 1 abajo) — las flechas de teclado del asa (§ "mouse y
 * teclado: flechas para mover, accesible"). En el borde (primero/-1, último/+1) no hace nada: el
 * clamp de `moverBandaAIndice` ya devuelve la misma referencia.
 */
export function moverBandaEnDireccion(orden: readonly BandaId[], id: BandaId, dir: -1 | 1): BandaId[] {
  const actual = orden.indexOf(id);
  if (actual < 0) return orden as BandaId[];
  return moverBandaAIndice(orden, id, actual + dir);
}

/**
 * Mueve `idArrastrado` a la posición que HOY ocupa `idDestino` — el drag-and-drop con mouse:
 * arrastrar A sobre B pone a A donde estaba B (el patrón "reorder on dragover", sin librería). Si
 * `idDestino` ya no está en `orden` (remontaje a mitad de un drag, o el id no existe) no hace nada
 * — un destino que desapareció no debe mover nada a ciegas.
 */
export function moverBandaConDestino(orden: readonly BandaId[], idArrastrado: BandaId, idDestino: BandaId): BandaId[] {
  const destino = orden.indexOf(idDestino);
  if (destino < 0) return orden as BandaId[];
  return moverBandaAIndice(orden, idArrastrado, destino);
}

/**
 * Reordena cualquier lista de ítems con `bandaId` OPCIONAL según `orden` — la usa `TiendaPaginas`
 * para pintar las `SeccionConfig` de la home en la secuencia elegida, sin importar el tipo
 * `SeccionConfig` acá (genérico por `bandaId`, para no crear un import `lib/` → `components/admin/`
 * por un solo campo). Los ítems SIN `bandaId` (cualquier página que no sea home) se quedan al
 * final, en su orden original de `items` — defensivo: hoy nunca ocurre para 'home' (las 9
 * `SeccionConfig` de esa página declaran `bandaId`, § tienda-secciones.ts), pero esta función no lo
 * asume. Un id de `orden` sin ítem correspondiente se omite — no debería pasar nunca
 * (`resolverOrden` siempre completa con los 9 ids conocidos de `BANDA_IDS`), pero omitir en vez de
 * inventar un hueco es la misma regla SOFT del resto de este eje.
 */
export function ordenarPorBanda<T extends { bandaId?: BandaId }>(
  items: readonly T[],
  orden: readonly BandaId[],
): T[] {
  const porBanda = new Map<BandaId, T>();
  const sinBanda: T[] = [];
  for (const it of items) {
    if (it.bandaId) porBanda.set(it.bandaId, it);
    else sinBanda.push(it);
  }
  const ordenados: T[] = [];
  for (const id of orden) {
    const it = porBanda.get(id);
    if (it) ordenados.push(it);
  }
  return [...ordenados, ...sinBanda];
}
