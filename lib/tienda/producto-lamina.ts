// LA COMPOSICIÓN «LÁMINA ABIERTA» DE LA PÁGINA DE PRODUCTO (§ PRODUCTO-CHAMISAS-LAMINA-1, la línea
// «cálida, hecha por mujeres» de Las Chamisas aplicada a `/tienda/[slug]`). PURO (capa 1): sin red,
// sin DOM. Reusa el MISMO color por café que la composición «Láminas» del catálogo
// (`lib/tienda/laminas.ts`, `colorDeLamina`/`coloresPorProducto`) — nunca una segunda derivación que
// pudiera divergir del color que el visitante ya vio en /tienda.

import type { Product } from '@/types/product';
import { colorDeLamina } from './laminas';
import type { RaicesPaleta } from '@/lib/config/palette-derive';
import { TOSTION_LABELS } from '@/constants/roast-levels';
import { siguienteIndiceGaleria } from '@/lib/storefront/galeria';

// EL ÍNDICE SIGUIENTE/ANTERIOR DE LA GALERÍA (§ PRODUCTO-LAMINA-GALERIA-1) ES UN RE-EXPORT, NO UNA
// SEGUNDA DEFINICIÓN. `siguienteIndiceGaleria` (`lib/storefront/galeria.ts`) ya resuelve EXACTAMENTE
// este problema para `GaleriaProducto.tsx` (la composición «Actual»): en bucle, con `total <= 1`
// devuelve el mismo índice sin lanzar. Re-derivar la misma aritmética acá —aunque sea una línea—
// sería la MISMA familia de defecto que `razonDelServidor`/`cruzoMinimo` duplicados (§ CLAUDE.md):
// dos definiciones del mismo hecho que pueden divergir el día que alguien ajuste una sin la otra.
// Se re-exporta (no se importa solo en el componente) para que el test de este slice —"el índice
// siguiente/anterior (vuelta al inicio)"— viva junto a las demás reglas puras de esta composición,
// sin fingir una segunda implementación.
export { siguienteIndiceGaleria };

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
 *  diverge entre el catálogo y esta lista). Las notas viajan COMPLETAS (§ PRODUCTO-CHAMISAS-
 *  FIDELIDAD-1, diferencia 7: la maqueta muestra "la frase completa de notas", no un recorte a dos —
 *  el llamador las pasa por `fraseNotas`, la misma función que ya arma la frase del producto
 *  principal, para que las dos tarjetas de la página hablen con la misma voz). */
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
      notas: p.notas ?? [],
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

// ── EL PUNTO DE LAS NOTAS (§ PRODUCTO-CHAMISAS-FIDELIDAD-1, diferencia 1) ─────────────────────────
// La maqueta aprobada pinta el punto de cada píldora con un color FUERTE —saturado, oscuro— de la
// MISMA familia que el café (`--punto`, derivado de `--cafe`), nunca un segundo color que el dueño
// tenga que elegir aparte (§ el spec: "derivalo; no pidas un segundo color al dueño"). `color`
// (arriba) es uno de los roles de `paletaLaminas`/`coloresPorProducto` — a veces ya oscuro, a veces
// pálido de por sí (una raíz custom puede producir un pastel) — así que un punto "lleno con `color`
// tal cual" se pierde contra el fondo de la píldora (`lavado`, la MISMA familia aclarada) en el caso
// pálido. Eso era el defecto medido: el punto quedaba hueco y pálido.
//
// POR QUÉ HSL Y NO EL MOTOR OKLCH DE `palette-derive.ts`: ese motor (`oscurecer`/`pisoContraste`)
// vive fuera del `touches:` de este slice, y sus primitivas de conversión (`hexToOklab`/
// `oklabToHex`) no están exportadas — exportarlas sería editar un archivo que este slice no toca.
// Probado el camino disponible (`pisoContraste(color, color, objetivo, 'oscurecer')`, que SÍ es
// exportado): sólo camina la LUMINOSIDAD a CROMA constante, y el croma de un pastel casi blanco ya
// es bajo — el resultado oscurece pero no SATURA, y queda un marrón sucio, no el rojo vívido que la
// maqueta pide. HSL resuelve las dos cosas de un golpe: fija la SATURACIÓN a un piso vívido y la
// LUMINOSIDAD a un tono medio-oscuro legible, preservando el MATIZ del color de la lámina — "ese
// mismo café, más fuerte", no un color ajeno.
//
// Es DECORATIVO (el punto es `aria-hidden`, nunca texto), así que no lleva piso de contraste WCAG
// como los roles de lectura del motor — su única exigencia es DISTINGUIRSE del fondo pálido de la
// píldora, y fijar luminosidad a un tono medio (0.42) mientras el fondo se queda claro (`lavado`, ya
// floreado hacia blanco) garantiza esa distancia para cualquier matiz.
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to255 = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to255(r)}${to255(g)}${to255(b)}`;
}

/** El piso de SATURACIÓN del punto — nunca más pálido que esto, aunque `colorLamina` ya lo sea. */
const PUNTO_SATURACION_MIN = 0.65;
/** La LUMINOSIDAD fija del punto — un tono medio-oscuro, siempre legible contra `lavado` (el fondo
 *  aclarado de la píldora), sea cual sea el matiz de origen. */
const PUNTO_LUMINOSIDAD = 0.42;

/** El color FUERTE del punto de una nota, derivado del color de la lámina (nunca un segundo color
 *  elegido aparte): mismo matiz, saturación y luminosidad llevadas a un piso vívido/legible. */
export function colorPuntoNota(colorLamina: string): string {
  const { h, s } = hexToHsl(colorLamina);
  return hslToHex(h, Math.max(s, PUNTO_SATURACION_MIN), PUNTO_LUMINOSIDAD);
}
