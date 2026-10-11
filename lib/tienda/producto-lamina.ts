// LA COMPOSICIÓN «LÁMINA ABIERTA» DE LA PÁGINA DE PRODUCTO (§ PRODUCTO-CHAMISAS-LAMINA-1, la línea
// «cálida, hecha por mujeres» de Las Chamisas aplicada a `/tienda/[slug]`). PURO (capa 1): sin red,
// sin DOM. Reusa el MISMO color por café que la composición «Láminas» del catálogo
// (`lib/tienda/laminas.ts`, `colorDeLamina`/`coloresPorProducto`) — nunca una segunda derivación que
// pudiera divergir del color que el visitante ya vio en /tienda.

import type { Product } from '@/types/product';
import { colorDeLamina } from './laminas';
import type { RaicesPaleta } from '@/lib/config/palette-derive';
import { TOSTION_LABELS } from '@/constants/roast-levels';

/** El color de la lámina del producto de ESTA página: el mismo `colorDeLamina` que usa /tienda,
 *  buscando el índice del producto dentro del catálogo COMPLETO — el orden que decide a qué color
 *  de la paleta de reserva cae por ciclo, así que un café no cambia de color entre su lámina del
 *  catálogo y la de su propia página. Un producto que (por algún error de datos) no está en el
 *  catálogo recibido cae al índice 0, nunca lanza. */
export function colorLaminaProducto(
  catalogo: readonly Product[],
  productoId: string,
  coloresPorProducto: Record<string, string>,
  raices?: RaicesPaleta,
): string {
  const indice = catalogo.findIndex((p) => p.id === productoId);
  return colorDeLamina(productoId, indice < 0 ? 0 : indice, coloresPorProducto, raices);
}

export interface LaminaRelacionada {
  productId: string;
  slug: string;
  nombre: string;
  color: string;
  precio: number;
  imagen: string;
  disponible: boolean;
  notas: string[];
}

/** «Te puede interesar»: el resto del catálogo, SIN el producto que la página ya muestra — cada uno
 *  con el color de SU PROPIA lámina (mismo índice de catálogo que /tienda, así que el color no
 *  diverge entre el catálogo y esta lista). */
export function laminasRelacionadas(
  catalogo: readonly Product[],
  productoActualId: string,
  coloresPorProducto: Record<string, string>,
  raices?: RaicesPaleta,
): LaminaRelacionada[] {
  return catalogo
    .map((p, indice) => ({ p, indice }))
    .filter(({ p }) => p.id !== productoActualId)
    .map(({ p, indice }) => ({
      productId: p.id,
      slug: p.slug,
      nombre: p.nombre,
      color: colorDeLamina(p.id, indice, coloresPorProducto, raices),
      precio: p.precio,
      imagen: p.imagen ?? '',
      disponible: p.disponible ?? false,
      notas: (p.notas ?? []).slice(0, 2),
    }));
}

/** La frase de notas, en español: "A." con una nota, "A y B." con dos, "A, B y C." con tres o más —
 *  el último elemento se separa con "y" en vez de coma, nunca "A, B, C." a secas. Las notas viajan
 *  TAL CUAL las escribió el catálogo (mismo criterio que los pills de «Láminas»/el selector «¿Qué te
 *  provoca?», que tampoco les tocan el caso — § CLAUDE.md, "lowercase pisaba lo que el dueño
 *  escribe"): no se fuerza minúscula aunque la maqueta aprobada las muestre así, porque eso sería
 *  una transformación de UN dato (las notas del catálogo) que ninguna otra pantalla del repo aplica
 *  y que el spec de este slice no pide en su texto. Sin notas, cadena vacía — el componente decide
 *  si omite la línea entera. */
export function fraseNotas(notas: readonly string[]): string {
  const limpias = notas.map((n) => n.trim()).filter(Boolean);
  if (limpias.length === 0) return '';
  if (limpias.length === 1) return `${limpias[0]}.`;
  const ultimo = limpias[limpias.length - 1];
  const resto = limpias.slice(0, -1);
  return `${resto.join(', ')} y ${ultimo}.`;
}

export interface DatoProductoLamina {
  label: string;
  value: string;
}

/** Los datos del producto para la etiqueta cosida — SÓLO los cuatro que el spec nombra (variedad,
 *  altitud, tostión, peso), y SÓLO los que el producto trae: un campo ausente se OMITE, nunca se
 *  pinta vacío (mismo criterio que la ficha técnica de la composición «Actual», que ya hace esta
 *  misma poda sobre un superconjunto de campos). La altitud exige el rango COMPLETO (min Y max,
 *  como ya exige «Actual») — un solo extremo no es un rango que mostrar. La tostión se ignora si el
 *  valor no es uno de los cuatro niveles conocidos (un catálogo no-café, § C3 hardening), igual que
 *  el chip de «Actual». */
export function datosProductoLamina(product: Pick<Product, 'variedad' | 'altitudMin' | 'altitudMax' | 'tostado' | 'peso_gramos'>): DatoProductoLamina[] {
  const datos: DatoProductoLamina[] = [];
  if (product.variedad) datos.push({ label: 'Variedad', value: product.variedad });
  if (product.altitudMin != null && product.altitudMax != null) {
    datos.push({
      label: 'Altitud',
      value: `${product.altitudMin.toLocaleString('es-CO')}–${product.altitudMax.toLocaleString('es-CO')} m s.n.m.`,
    });
  }
  if (product.tostado && TOSTION_LABELS[product.tostado]) {
    datos.push({ label: 'Tostión', value: TOSTION_LABELS[product.tostado] });
  }
  if (product.peso_gramos != null) datos.push({ label: 'Peso', value: `${product.peso_gramos} g` });
  return datos;
}
