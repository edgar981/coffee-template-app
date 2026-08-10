// ─── Galería de producto ─────────────────────────────────────────────────────
// LA fuente de cómo se compone y se valida la galería. La consumen el detalle
// del storefront, el formulario del admin y el endpoint de productos: si cada
// uno armara su propia lista, el orden y los duplicados divergirían entre lo que
// el operador edita y lo que el cliente ve.
//
// SEMÁNTICA (decisión del owner): `Product.imagen` es LA portada en todos sus
// usos —cards del catálogo, admin, hero del detalle—; `Product.imagenes[]` son
// tomas ADICIONALES que solo aparecen en la galería del detalle.

/**
 * Tope de tomas adicionales por producto. No cuenta la portada: un producto
 * puede mostrar hasta MAX_GALERIA_IMAGENES + 1 miniaturas. Se valida en el
 * cliente (aviso temprano) y en el servidor (la que manda).
 */
export const MAX_GALERIA_IMAGENES = 6;

/**
 * Lista completa que se muestra en el detalle: la portada primero y después las
 * adicionales, SIN repetir.
 *
 * La deduplicación es una guarda deliberada, no una limpieza pendiente. Los
 * seeds del catálogo traen `imagenes: [<la misma URL que imagen>]` —la galería
 * fue en su día "la lista completa, portada incluida"— y ese dato NO se migró:
 * la garantía vive acá, donde protege contra cualquier fuente futura (un
 * import, un seed nuevo, una edición manual), no solo contra esos 4 registros.
 * NO quitar esta dedupe creyendo que sobra, ni "arreglar" el dato para poder
 * quitarla: ver la sección de CLAUDE.md.
 *
 * Un producto sin adicionales devuelve `[imagen]` —longitud 1— que es la señal
 * que usa el detalle para no pintar una fila de miniaturas de un solo elemento.
 */
export function galeriaCompleta(
  imagen: string | null | undefined,
  imagenes: readonly string[] | null | undefined,
): string[] {
  const vistas = new Set<string>();
  const salida: string[] = [];

  for (const url of [imagen, ...(imagenes ?? [])]) {
    if (!url) continue;              // portada vacía o hueco en el array
    if (vistas.has(url)) continue;   // ya está — la portada repetida cae acá
    vistas.add(url);
    salida.push(url);
  }
  return salida;
}

/**
 * URLs que salieron de la galería en una edición: las que estaban en la versión
 * de la BASE y ya no están en la nueva. Es lo que el servidor borra del store.
 *
 * Se calcula contra el array PREVIO leído de la base y nunca contra algo que
 * mande el cliente: si el borrado se disparara con una lista del navegador,
 * cualquier admin podría borrar cualquier blob del store enviando otra.
 *
 * La portada NO se considera acá — su reemplazo lo maneja aparte el mismo
 * endpoint, comparando `imagen` previa contra la nueva. Pero sí se excluye del
 * borrado cualquier URL que siga en uso como portada nueva: mover una toma de
 * la galería a portada no puede borrar el blob que se acaba de promover.
 */
export function blobsRetirados(
  previas: readonly string[] | null | undefined,
  nuevas: readonly string[] | null | undefined,
  enUso: readonly (string | null | undefined)[] = [],
): string[] {
  const conservadas = new Set<string>([
    ...(nuevas ?? []),
    ...enUso.filter((u): u is string => Boolean(u)),
  ]);
  const vistas = new Set<string>();

  return (previas ?? []).filter(url => {
    if (!url || conservadas.has(url) || vistas.has(url)) return false;
    vistas.add(url);   // un array previo con duplicados no borra dos veces
    return true;
  });
}

/** Normaliza lo que llega en el body: solo strings no vacíos, sin duplicados. */
export function sanitizeGaleria(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  const vistas = new Set<string>();
  const salida: string[] = [];
  for (const item of valor) {
    if (typeof item !== 'string') continue;
    const url = item.trim();
    if (!url || vistas.has(url)) continue;
    vistas.add(url);
    salida.push(url);
  }
  return salida;
}
