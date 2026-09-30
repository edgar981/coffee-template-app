// La lógica de filtrar/ordenar/contar del catálogo público de `/tienda` — extraída para que el
// panel "Filtrar y ordenar" (CORTE, § TIENDA-ENCABEZADO-Y-FILTRAR-ORDENAR-1) la consuma sin
// duplicar cálculo dentro del componente. PURA (capa 1): sin red, sin DOM, sin `useSiteContent`.
// Estructural sobre los campos que necesita —como `categoriasDelCatalogo`— en vez de importar el
// tipo `Product` completo, para no acoplar esta capa al modelo entero.
//
// EL EJE VIEJO DE LA PÁGINA (search + categoría + tostado + un `<select>` de orden) SIGUE VIVIENDO
// INTACTO, inline, en la rama Nayoli/no-CORTE de `app/(storefront)/tienda/page.tsx` (`ShopLegacy`):
// este módulo es CONSUMIDO SÓLO por la rama CORTE (`ShopCorte`) — no se tocó ni se reusó el cálculo
// de la rama vieja, para no arriesgar su byte-identidad por una diferencia de detalle (p. ej. un
// `.trim()` de más en la búsqueda que la rama vieja no hacía).

export type DisponibilidadFiltro = 'disponible' | 'agotado';

export type OrdenCatalogo =
  | 'featured'
  | 'bestseller'
  | 'name_asc'
  | 'name_desc'
  | 'price_asc'
  | 'price_desc';

export interface OpcionOrden {
  value: OrdenCatalogo;
  label: string;
}

/**
 * Los órdenes que el catálogo REALMENTE soporta con datos reales — "los de hoy más los que se
 * puedan con datos reales, ninguno inventado" (§ el spec de este slice). 'featured' es el orden que
 * ya trae `/api/catalog` (`createdAt asc`, § esa ruta) sin reordenar; 'bestseller' usa el campo real
 * `Product.bestseller`; 'name_*'/'price_*' ordenan sobre datos que todo producto tiene.
 *
 * LO QUE NO ENTRÓ, y por qué: "Más recientes"/"Más antiguos" duplicarían 'featured' —que YA es el
 * orden por fecha de creación ascendente que el servidor entrega— así que un segundo chip con el
 * MISMO resultado confundiría en vez de sumar una opción real. "Más relevantes" no tiene puntaje de
 * búsqueda que ordenar (no hay motor de relevancia). "Disponibilidad" no es un ORDEN: ya es su
 * propio FILTRO (§ `contarDisponibilidad`/`filtrarCatalogo`, abajo), como en la referencia.
 */
export const OPCIONES_ORDEN: readonly OpcionOrden[] = [
  { value: 'featured', label: 'Destacados' },
  { value: 'bestseller', label: 'Más vendidos' },
  { value: 'name_asc', label: 'Nombre: A-Z' },
  { value: 'name_desc', label: 'Nombre: Z-A' },
  { value: 'price_asc', label: 'Precio: menor a mayor' },
  { value: 'price_desc', label: 'Precio: mayor a menor' },
];

export interface ProductoOrdenable {
  nombre: string;
  precio: number;
  bestseller?: boolean;
}

/**
 * Ordena una COPIA del catálogo (nunca muta `list`). 'featured' devuelve el orden de ENTRADA tal
 * cual — es el que ya trae el servidor; esta función no lo redefine.
 *
 * `bestseller` usa `Array.prototype.sort`, ESTABLE desde ES2019/V8 ≥ 7.0 (Node lo garantiza): dentro
 * de cada grupo `true`/`false` se conserva el orden de llegada (el de 'featured'), no se reordena
 * una segunda vez ni queda en un orden arbitrario.
 */
export function ordenarCatalogo<T extends ProductoOrdenable>(
  list: readonly T[],
  orden: OrdenCatalogo,
): T[] {
  const copia = [...list];
  switch (orden) {
    case 'price_asc':
      return copia.sort((a, b) => a.precio - b.precio);
    case 'price_desc':
      return copia.sort((a, b) => b.precio - a.precio);
    case 'name_asc':
      return copia.sort((a, b) => a.nombre.localeCompare(b.nombre));
    case 'name_desc':
      return copia.sort((a, b) => b.nombre.localeCompare(a.nombre));
    case 'bestseller':
      return copia.sort((a, b) => Number(b.bestseller ?? false) - Number(a.bestseller ?? false));
    case 'featured':
    default:
      return copia;
  }
}

export interface ConteoDisponibilidad {
  disponible: number;
  agotado: number;
}

export interface ProductoConDisponibilidad {
  disponible?: boolean;
}

/**
 * Cuenta disponibles/agotados, para los conteos del filtro "Disponibilidad" (§ la referencia:
 * "In stock (10)" / "Out of stock (0)"). `disponible` ausente cuenta como DISPONIBLE: el catálogo
 * público SIEMPRE lo trae (`/api/catalog` lo deriva de `stock > 0`), así que la ausencia es sólo un
 * catálogo vacío o un objeto más laxo en un test — nunca un producto real sin el campo.
 */
export function contarDisponibilidad(list: readonly ProductoConDisponibilidad[]): ConteoDisponibilidad {
  let disponible = 0;
  let agotado = 0;
  for (const p of list) {
    if (p.disponible === false) agotado += 1;
    else disponible += 1;
  }
  return { disponible, agotado };
}

export interface RangoPrecio {
  min: number;
  max: number;
}

export interface ProductoConPrecio {
  precio: number;
}

/**
 * El rango [min, max] de precios del catálogo — los bordes del slider de Precio. Catálogo vacío →
 * `{min:0, max:0}`, DECLARADO: un slider con `Infinity`/`-Infinity` como borde no tiene forma que
 * dibujar, y un catálogo vacío no tiene nada que acotar.
 */
export function rangoPrecioCatalogo(list: readonly ProductoConPrecio[]): RangoPrecio {
  if (list.length === 0) return { min: 0, max: 0 };
  let min = list[0].precio;
  let max = list[0].precio;
  for (const p of list) {
    if (p.precio < min) min = p.precio;
    if (p.precio > max) max = p.precio;
  }
  return { min, max };
}

export interface FiltrosCatalogo {
  busqueda: string;
  /** 'all' = todas. */
  categoria: string;
  /** 'all' = todos ('' nunca matchea un `RoastLevel` real, así que no hace falta un valor especial). */
  tostado: string;
  /** Vacío = sin filtro (todas). Con ≥1 elemento, sólo pasan los productos en ese estado. */
  disponibilidad: ReadonlySet<DisponibilidadFiltro>;
  precioMin: number;
  precioMax: number;
}

export interface ProductoFiltrable {
  nombre: string;
  origen?: string | null;
  categoria?: string | null;
  tostado?: string | null;
  precio: number;
  disponible?: boolean;
}

/**
 * Filtra una COPIA del catálogo por los cinco ejes del panel (búsqueda, categoría, tostado,
 * disponibilidad, precio). Cada eje es un no-op en su valor "todo" (`'all'`, set vacío, el rango
 * completo del catálogo) — mismo criterio que la página de hoy (`ShopLegacy`), extendido con los
 * dos ejes nuevos que el panel agrega (disponibilidad, precio).
 */
export function filtrarCatalogo<T extends ProductoFiltrable>(
  list: readonly T[],
  f: FiltrosCatalogo,
): T[] {
  const termino = f.busqueda.trim().toLowerCase();
  return list.filter((p) => {
    if (termino) {
      const enNombre = p.nombre.toLowerCase().includes(termino);
      const enOrigen = (p.origen ?? '').toLowerCase().includes(termino);
      if (!enNombre && !enOrigen) return false;
    }
    if (f.categoria !== 'all' && p.categoria !== f.categoria) return false;
    if (f.tostado !== 'all' && p.tostado !== f.tostado) return false;
    if (f.disponibilidad.size > 0) {
      const estado: DisponibilidadFiltro = p.disponible === false ? 'agotado' : 'disponible';
      if (!f.disponibilidad.has(estado)) return false;
    }
    if (p.precio < f.precioMin || p.precio > f.precioMax) return false;
    return true;
  });
}
