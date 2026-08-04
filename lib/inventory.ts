import prisma from '@/lib/prisma';
import { cruzoMinimo } from '@/lib/metrics/inventory-filters';
import type { InventoryLog, Product } from '@/src/generated/prisma/client';

// EL ajuste manual de inventario. Vivía inline en `/api/inventory/adjust`; se
// extrajo acá SIN CAMBIAR NADA para poder testear su concurrencia, que es donde
// está el defecto del item 1 del backlog y que un route handler no deja
// ejercitar (el carril de integración cubre cadenas, no handlers HTTP — ver
// CLAUDE.md § Las tres capas).
//
// El route handler queda con lo suyo: sesión, parseo y códigos de estado.

/** Salida que excede el stock disponible → el llamador responde 409. */
export class InsufficientStockError extends Error {
  constructor() {
    super('Stock insuficiente para esta salida');
    this.name = 'InsufficientStockError';
  }
}

/** El producto no existe → el llamador responde 404. */
export class ProductoNoEncontradoError extends Error {
  constructor() {
    super('Producto no encontrado');
    this.name = 'ProductoNoEncontradoError';
  }
}

/** Cantidad no numérica o negativa → el llamador responde 400. */
export class CantidadInvalidaError extends Error {
  constructor() {
    super('Cantidad inválida');
    this.name = 'CantidadInvalidaError';
  }
}

export interface AjusteInventarioInput {
  producto_id: string;
  /** `salida` decrementa, `entrada`/`devolucion` incrementan, `ajuste` FIJA. */
  tipo:        string;
  cantidad:    unknown;
  motivo?:     string | null;
}

export interface AjusteInventarioResult {
  product: Product;
  log:     InventoryLog;
  /** El movimiento hizo que el producto CRUZARA su mínimo — el llamador emite el
   *  evento post-commit. Se devuelve en vez de emitirse acá para no meter el
   *  motor de automatizaciones dentro de la transacción. */
  cruzoElMinimo: boolean;
}

/**
 * Aplica el movimiento y escribe el asiento de kardex en UNA transacción: o
 * cuajan los dos o ninguno.
 *
 * EL `SELECT … FOR UPDATE` NO ES OPCIONAL. Postgres corre en READ COMMITTED, así
 * que dos transacciones concurrentes pueden LEER el mismo stock antes de que
 * cualquiera escriba: sin el lock, las dos registran el mismo `stock_anterior` y
 * el kardex reporta dos movimientos donde hubo uno. Con tipos delta
 * (`entrada`/`devolucion`/`salida`) además se aplican los dos, y el asiento de la
 * segunda miente sobre cuánto había de verdad.
 *
 * El lock serializa a los concurrentes SOBRE ESA FILA: el segundo espera, lee el
 * valor que el primero ya escribió, y su asiento encadena. Mismo patrón que el
 * POST de pagos. Testeado en tests/integracion/ajuste-concurrente.test.ts, que
 * se escribió antes de este fix y se vio fallar.
 */
export async function aplicarAjusteInventario(
  input: AjusteInventarioInput,
): Promise<AjusteInventarioResult> {
  const qty = Number(input.cantidad);
  if (!Number.isFinite(qty) || qty < 0) throw new CantidadInvalidaError();

  const { anterior, updated, log } = await prisma.$transaction(async (tx) => {
    // Estado ANTERIOR real, ya serializado contra cualquier otro ajuste sobre
    // este mismo producto. Todo lo que el asiento afirma sale de acá.
    const [product] = await tx.$queryRaw<
      { nombre: string; stock: number; stock_minimo: number; activo: boolean }[]
    >`SELECT "nombre", "stock", "stock_minimo", "activo"
        FROM "Product" WHERE "id" = ${input.producto_id} FOR UPDATE`;
    if (!product) throw new ProductoNoEncontradoError();

    if (input.tipo === 'salida') {
      // `where stock >= qty` impide sobrevender aunque dos salidas se crucen: si
      // el stock ya no alcanza, no toca ninguna fila y se rechaza.
      const res = await tx.product.updateMany({
        where: { id: input.producto_id, stock: { gte: qty } },
        data:  { stock: { decrement: qty }, updatedAt: new Date() },
      });
      if (res.count === 0) throw new InsufficientStockError();
    } else if (input.tipo === 'entrada' || input.tipo === 'devolucion') {
      await tx.product.update({
        where: { id: input.producto_id },
        data:  { stock: { increment: qty }, updatedAt: new Date() },
      });
    } else {
      // 'ajuste' — fija el valor directo.
      await tx.product.update({
        where: { id: input.producto_id },
        data:  { stock: qty, updatedAt: new Date() },
      });
    }

    // Valor post-operación REAL, releído de la base y no recalculado en JS.
    const post = await tx.product.findUniqueOrThrow({ where: { id: input.producto_id } });
    const asiento = await tx.inventoryLog.create({
      data: {
        producto_id:     input.producto_id,
        producto_nombre: product.nombre,
        tipo:            input.tipo,
        cantidad:        qty,
        stock_anterior:  product.stock,   // de la fila LOCKEADA, no de un snapshot
        stock_nuevo:     post.stock,
        motivo:          input.motivo || null,
      },
    });
    return { anterior: product, updated: post, log: asiento };
  });

  return {
    product: updated,
    log,
    // El cruce se evalúa con los DOS valores de la misma transacción, así que dos
    // movimientos concurrentes ya no pueden creerse ambos "el que cruzó" y hacer
    // que la campana avise dos veces del mismo hecho.
    cruzoElMinimo: cruzoMinimo(anterior.stock, updated.stock, {
      stock_minimo: anterior.stock_minimo,
      activo:       anterior.activo,
    }),
  };
}
