import prisma from '@duna/core';
import type { Prisma, Product } from '@duna/core';
import { sanitizeGaleria } from '@duna/core/product-gallery';
import { sanitizeOpciones } from '@duna/core/moliendas-opciones';

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
  // Las opciones de molienda del cliente. Un campo más con la misma regla, y ese
  // es el punto: cuando se construyó su editor, la presencia de clave vivía en un
  // bloque propio dentro del handler porque el endpoint todavía pisaba todo lo
  // demás. Al volverse general la regla, el caso especial dejó de serlo.
  //
  // Que se escriba acá NO reescribe historia: las órdenes guardan la molienda como
  // STRING (`OrderItem.moliendaSeleccionada`) y ninguna vista la re-deriva del
  // producto, así que renombrar o quitar una opción sólo cambia lo que se ofrece
  // de ahora en adelante. El cast es el de `prisma/seed.ts`: la columna es Json y
  // el cliente generado no acepta una interfaz sin index signature.
  if (hay('moliendasOpciones')) {
    data.moliendasOpciones = sanitizeOpciones(body.moliendasOpciones) as unknown as Prisma.InputJsonValue;
  }

  return data;
}

// ─── El asiento del kardex que faltaba: la puerta del modal ──────────────────
// El stock se puede editar por DOS puertas: `/api/inventory/adjust` (Ajustar
// Stock) y el campo Stock del modal de producto. Eso se mantiene — decisión del
// owner, 2026-08-05: la de Ajustar Stock es la operación de inventario, la del
// modal es la corrección de ficha, y las dos son legítimas.
//
// Lo que NO se mantiene es que la segunda fuera SILENCIOSA. El PATCH escribía
// `stock` directo, sin asiento, así que el kardex se desfasaba del stock real
// sin una sola fila que lo explicara. Se descubrió al reconstruir el incidente
// del PATCH destructivo: el stock fue 28 → 0 → 28 y el kardex no registró nada;
// la cadena cerró de casualidad porque el owner reteclé el mismo número.
//
// **Dos puertas al mismo dato con una sola dejando asiento es cómo el kardex
// deja de ser confiable.** No se cierra la puerta: se le pone la firma.

/** Motivo fijo del asiento que deja una edición de ficha. */
export const MOTIVO_EDICION_PRODUCTO = 'Edición de producto';
/** Motivo del asiento inaugural, el que hace que toda cadena empiece en cero. */
export const MOTIVO_STOCK_INICIAL = 'Stock inicial';

export interface PatchProductoResult {
  /** Imágenes ANTES de la edición, para el diff de blobs del endpoint. */
  previo:  { imagen: string; imagenes: string[] };
  updated: Product;
}

/**
 * Aplica el PATCH y, si tocó el stock, escribe su asiento — en UNA transacción:
 * o cuajan los dos o ninguno. Devuelve `null` si el producto no existe.
 *
 * EL `SELECT … FOR UPDATE` NO ES OPCIONAL, por lo mismo que en
 * `aplicarAjusteInventario`: en READ COMMITTED dos ediciones concurrentes leen
 * el mismo stock antes de que cualquiera escriba, registran el mismo
 * `stock_anterior` y el kardex afirma dos movimientos donde hubo uno. El lock
 * serializa a los concurrentes SOBRE ESA FILA, así que el segundo lee lo que el
 * primero ya escribió y su asiento ENCADENA. Y como el lock es de la misma
 * tabla, también serializa contra un Ajustar Stock simultáneo: las dos puertas
 * comparten la cola, que es lo que hace que la cadena sea una sola.
 *
 * El asiento se escribe SÓLO si el body TRAE `stock` **y** el valor cambió.
 * Editar la descripción no es un movimiento de inventario: sin esa segunda
 * condición, cada guardado del modal dejaría un asiento fantasma de N → N y el
 * kardex se volvería ilegible por exceso, que es otra forma de no ser confiable.
 */
export async function aplicarPatchProducto(
  id: string,
  body: Record<string, unknown>,
): Promise<PatchProductoResult | null> {
  return prisma.$transaction(async (tx) => {
    // Fila lockeada: todo lo que el asiento afirma sale de acá, no de un
    // snapshot leído antes de la transacción.
    const [bloqueado] = await tx.$queryRaw<{ nombre: string; stock: number }[]>`
      SELECT "nombre", "stock" FROM "Product" WHERE "id" = ${id} FOR UPDATE`;
    if (!bloqueado) return null;

    // Ya bajo el lock, así que es el mismo estado que vio el SELECT de arriba.
    const previo = await tx.product.findUniqueOrThrow({
      where:  { id },
      select: { imagen: true, imagenes: true },
    });

    const updated = await tx.product.update({
      where: { id },
      data:  { ...datosDelPatch(body), updatedAt: new Date() },
    });

    if (trae(body, 'stock') && updated.stock !== bloqueado.stock) {
      await tx.inventoryLog.create({
        data: {
          producto_id:     id,
          producto_nombre: bloqueado.nombre,
          // `ajuste` es el tipo de valor ABSOLUTO, que es exactamente lo que hace
          // el campo del modal: fija el stock, no lo mueve por un delta.
          tipo:            'ajuste',
          cantidad:        updated.stock,
          stock_anterior:  bloqueado.stock,   // de la fila lockeada
          stock_nuevo:     updated.stock,
          motivo:          MOTIVO_EDICION_PRODUCTO,
        },
      });
    }

    return { previo, updated };
  });
}

/**
 * Crea el producto y su asiento INAUGURAL, en una transacción.
 *
 * El asiento va SIEMPRE, incluso con stock 0, y eso es el punto: hace que la
 * cadena de todo producto arranque en su primera fila, desde cero. Sin él, un
 * producto nacido con stock 42 tiene un kardex que empieza en el aire y ningún
 * recorrido puede reconciliarlo con el stock real — es el mismo agujero que la
 * puerta silenciosa, sólo que en el origen.
 */
export async function crearProductoConAsiento(
  data: Prisma.ProductUncheckedCreateInput,
): Promise<Product> {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({ data });
    await tx.inventoryLog.create({
      data: {
        producto_id:     product.id,
        producto_nombre: product.nombre,
        tipo:            'ajuste',
        cantidad:        product.stock,
        stock_anterior:  0,
        stock_nuevo:     product.stock,
        motivo:          MOTIVO_STOCK_INICIAL,
      },
    });
    return product;
  });
}
