// La taxonomía del catálogo se DERIVA de los productos, no se declara en un set cerrado.
// El cliente fija su taxonomía al importar su catálogo (§ el import de catálogo, Tanda B); un
// editor de categorías se la pediría dos veces. Estas funciones puras leen las categorías y los
// niveles de tostado que REALMENTE existen en el catálogo, y las pantallas construyen sus filtros
// desde acá — así un cliente no-café ve SUS categorías, y la dimensión "Tostión" (vocabulario
// cafetero) desaparece sola cuando ningún producto la puebla. Capa 1.

/** Las categorías DISTINTAS presentes en un catálogo, en orden ALFABÉTICO (es-CO).
 *  Alfabético y NO por conteo a propósito: es ESTABLE —agregar/quitar un producto no reordena las
 *  pestañas ni mueve la que el shopper ya ubicó—; el orden por conteo las barajaría con cada venta.
 *  Ignora vacíos/espacios. El label de la pestaña ES la categoría misma (lo que el cliente escribió),
 *  sin mapa de labels. */
export function categoriasDelCatalogo(items: { categoria?: string | null }[]): string[] {
  const set = new Set<string>();
  for (const it of items) {
    const c = (it.categoria ?? '').trim();
    if (c) set.add(c);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'es-CO'));
}

/** ¿Algún producto del catálogo declara nivel de tostado? La sección de filtro "Nivel de Tostado"
 *  es vocabulario CAFETERO: se muestra sólo si el catálogo lo puebla (hide-on-empty, el patrón de
 *  SiteContent). Un catálogo no-café no la ve; el de Nayoli (todos con `tostado`) sí. */
export function catalogoTieneTostado(items: { tostado?: string | null }[]): boolean {
  return items.some(it => typeof it.tostado === 'string' && it.tostado.trim() !== '');
}
