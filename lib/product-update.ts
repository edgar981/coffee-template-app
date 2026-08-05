import type { Prisma } from '@/src/generated/prisma/client';
import { sanitizeGaleria } from '@/lib/product-gallery';

// ─── Qué escribe un PATCH de producto ────────────────────────────────────────
// Un PATCH es PARCIAL por definición: escribe los campos que el body TRAE y no
// toca los demás. El endpoint no lo hacía — aplicaba un fallback a cada campo
// (`body.descripcion || ''`, `Number(body.precio) || 0`, `body.sku || null`), y
// un fallback sobre una clave AUSENTE no es un default, es un borrado.
//
// El bug que esto cierra no era teórico ni de un cliente exótico: lo disparaba un
// botón de la propia UI. "Desactivar", la acción secundaria del diálogo de
// borrado, manda `{ activo: false }` y nada más. Con los fallbacks, ese click
// vaciaba la descripción, ponía precio, costo y stock en CERO, borraba SKU,
// variante, origen, tostado y peso… y dejaba `imagen: ''` con `imagenes: []`.
//
// Lo irreversible venía después: el mismo endpoint borra del store los blobs que
// la edición dejó sin referencias, así que veía la portada y la galería enteras
// como "retiradas" y las BORRABA de Vercel Blob. En producción `isDeletable` no
// frena nada (producción borra sin restricción de prefijo — ver CLAUDE.md
// § Storage), o sea que desactivar un producto le borraba las imágenes de verdad.
// La base tiene respaldos; los blobs no.
//
// Por qué vive acá y no dentro del route handler: es exactamente el criterio de
// `lib/inventory.ts` — se extrae lo que tiene el defecto para poder afirmarlo en
// un test. El carril de integración no monta handlers HTTP, así que la única
// forma de que un test vea esta decisión contra una base real es que sea una
// función. Ver `tests/integracion/patch-producto-parcial.test.ts`.

/**
 * ¿El body TRAE este campo? Presencia de la clave, no verdad del valor: `''`,
 * `0`, `false` y `null` son ediciones legítimas (vaciar un SKU, poner precio en
 * cero) y tienen que poder escribirse. `undefined` se trata como ausente porque
 * es lo que produce `JSON.parse` de una clave que no vino y lo que manda un
 * cliente que arma el objeto con campos opcionales.
 */
export function trae(body: Record<string, unknown>, campo: string): boolean {
  return Object.hasOwn(body, campo) && body[campo] !== undefined;
}

/**
 * Los campos que este PATCH debe escribir, ya normalizados.
 *
 * El manejo de cada valor PRESENTE es idéntico al que tenía el endpoint —esta
 * tanda arregla la ausencia, no cambia la semántica de lo que sí llega— con una
 * sola excepción anotada abajo (`imagenes`).
 *
 * Los campos que el endpoint nunca escribió (`variedad`, `proceso`, `altitudMin`,
 * `altitudMax`, `molienda`, `notas`, `notasCata`, `descripcionCorta`,
 * `bestseller`, `badge`, `agotado`) siguen sin escribirse: agregarlos es una
 * decisión de producto, no parte de este arreglo.
 */
export function datosDelPatch(body: Record<string, unknown>): Prisma.ProductUncheckedUpdateInput {
  const data: Prisma.ProductUncheckedUpdateInput = {};
  const hay = (campo: string) => trae(body, campo);

  if (hay('nombre'))       data.nombre       = body.nombre as string;
  // Un slug vacío NO borra el slug: la columna es única y obligatoria, y quedarse
  // sin él rompería la URL del producto en la tienda. Se conserva tal cual estaba.
  if (hay('slug') && body.slug) data.slug    = body.slug as string;
  if (hay('descripcion'))  data.descripcion  = (body.descripcion as string) || '';
  if (hay('categoria'))    data.categoria    = body.categoria as string;
  if (hay('precio'))       data.precio       = Number(body.precio) || 0;
  if (hay('costo'))        data.costo        = Number(body.costo)  || 0;
  if (hay('sku'))          data.sku          = (body.sku as string) || null;
  if (hay('stock'))        data.stock        = Number(body.stock)  || 0;
  if (hay('stock_minimo')) data.stock_minimo = Number(body.stock_minimo) || 5;
  if (hay('activo'))       data.activo       = (body.activo as boolean) ?? true;
  if (hay('peso_gramos'))  data.peso_gramos  = body.peso_gramos ? Number(body.peso_gramos) : null;
  if (hay('variante'))     data.variante     = (body.variante as string) || null;
  if (hay('origen'))       data.origen       = (body.origen   as string) || null;
  if (hay('tostado'))      data.tostado      = (body.tostado  as string) || null;
  if (hay('imagen'))       data.imagen       = (body.imagen   as string) || '';
  // `imagenes` es el ÚNICO campo cuyo trato cambia además de la presencia, y no
  // por gusto: es el que dispara el borrado de blobs. Antes se escribía siempre
  // —`sanitizeGaleria(undefined)` es `[]`— así que un body sin la clave vaciaba
  // la galería y el borrado se llevaba todos sus blobs.
  if (hay('imagenes'))     data.imagenes     = sanitizeGaleria(body.imagenes);

  return data;
}
