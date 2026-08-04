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
 */
export async function aplicarAjusteInventario(
  input: AjusteInventarioInput,
): Promise<AjusteInventarioResult> {
  // ⚠ DEFECTO CONOCIDO (backlog item 1): esta lectura ocurre FUERA de la
  // transacción de abajo, así que dos peticiones concurrentes snapshotean el
  // mismo `stock`. Se conserva tal cual en esta extracción a propósito — el
  // commit siguiente trae el test que lo demuestra, y recién después el fix.
  const product = await prisma.product.findUnique({ where: { id: input.producto_id } });
  if (!product) throw new ProductoNoEncontradoError();

  const qty = Number(input.cantidad);
  if (!Number.isFinite(qty) || qty < 0) throw new CantidadInvalidaError();

  const { updated, log } = await prisma.$transaction(async (tx) => {
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
        stock_anterior:  product.stock,   // ⚠ del snapshot de AFUERA — ver arriba
        stock_nuevo:     post.stock,
        motivo:          input.motivo || null,
      },
    });
    return { updated: post, log: asiento };
  });

  return {
    product: updated,
    log,
    cruzoElMinimo: cruzoMinimo(product.stock, updated.stock, {
      stock_minimo: product.stock_minimo,
      activo:       product.activo,
    }),
  };
}
