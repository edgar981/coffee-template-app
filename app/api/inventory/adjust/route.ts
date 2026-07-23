import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import { createNotification } from '@/lib/notifications';

// Salida que excede el stock disponible: el decremento atómico condicional no
// afecta ninguna fila (count 0) y lanzamos esto para responder 409.
class InsufficientStockError extends Error {}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { producto_id, tipo, cantidad, motivo } = await req.json();

  const product = await prisma.product.findUnique({ where: { id: producto_id } });
  if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

  const qty = Number(cantidad);
  if (!Number.isFinite(qty) || qty < 0) {
    return NextResponse.json({ error: 'Cantidad inválida' }, { status: 400 });
  }

  // Decremento atómico donde YA ocurre (ajuste manual del admin), sin cambiar
  // CUÁNDO se descuenta en el ciclo del pedido. La 'salida' usa un updateMany
  // condicional (where stock >= qty) para que dos ajustes concurrentes no puedan
  // sobrevender: si el stock ya no alcanza, no toca ninguna fila y se rechaza.
  // 'entrada'/'devolucion' incrementan; 'ajuste' fija el valor directo. El log y
  // el decremento van en la misma transacción para que ambos cuajen o ninguno.
  let updatedProduct;
  let log;
  try {
    ({ updatedProduct, log } = await prisma.$transaction(async (tx) => {
      if (tipo === 'salida') {
        const res = await tx.product.updateMany({
          where: { id: producto_id, stock: { gte: qty } },
          data:  { stock: { decrement: qty }, updatedAt: new Date() },
        });
        if (res.count === 0) throw new InsufficientStockError();
      } else if (tipo === 'entrada' || tipo === 'devolucion') {
        await tx.product.update({
          where: { id: producto_id },
          data:  { stock: { increment: qty }, updatedAt: new Date() },
        });
      } else {
        // 'ajuste' — fija el valor directo (mismo comportamiento que antes).
        await tx.product.update({
          where: { id: producto_id },
          data:  { stock: qty, updatedAt: new Date() },
        });
      }

      // Valor post-operación real (no recalculado en JS) para el log.
      const updated = await tx.product.findUniqueOrThrow({ where: { id: producto_id } });
      const created = await tx.inventoryLog.create({
        data: {
          producto_id,
          producto_nombre: product.nombre,
          tipo,
          cantidad:        qty,
          stock_anterior:  product.stock,
          stock_nuevo:     updated.stock,
          motivo:          motivo || null,
        },
      });
      return { updatedProduct: updated, log: created };
    }));
  } catch (e) {
    if (e instanceof InsufficientStockError) {
      return NextResponse.json({ error: 'Stock insuficiente para esta salida' }, { status: 409 });
    }
    throw e;
  }

  const newStock = updatedProduct.stock;

  // Check stock_bajo automation and fire internal notification
  const stockMinimo = product.stock_minimo ?? 5;
  if (newStock <= stockMinimo) {
    const automation = await prisma.automation.findUnique({
      where: { tipo: 'stock_bajo' },
    });

    if (automation?.activa) {
      await createNotification({
        tipo:    'stock_bajo',
        titulo:  'Stock bajo',
        mensaje: `${product.nombre} tiene solo ${newStock} unidades (mínimo: ${stockMinimo}).`,
        href:    '/admin/inventario',
      });

      await prisma.automation.update({
        where: { tipo: 'stock_bajo' },
        data:  {
          veces_ejecutada:  { increment: 1 },
          ultima_ejecucion: new Date(),
        },
      });
    }
  }

  return NextResponse.json({ product: updatedProduct, log });
}