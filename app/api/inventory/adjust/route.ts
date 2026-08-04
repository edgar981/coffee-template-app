import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import { cruzoMinimo } from '@/lib/metrics/inventory-filters';
import { runEventAutomations } from '@/lib/automations/engine';

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

  // CRUCE del mínimo, no estado bajo: `cruzoMinimo` compara el stock de antes
  // contra el de después con el MISMO predicado que pinta la card de Alertas de
  // Stock (`isLowStock`), y es literalmente la misma función que usa el descuento
  // al despachar. Antes esto avisaba en CADA ajuste que dejara el producto bajo
  // mínimo — un producto ya agotado generaba una notificación por cada movimiento.
  // Post-commit y fire-and-forget: `runEventAutomations` nunca lanza, así que un
  // fallo de aviso no puede tumbar un ajuste de inventario ya persistido.
  if (cruzoMinimo(product.stock, updatedProduct.stock, {
    stock_minimo: product.stock_minimo, activo: product.activo,
  })) {
    await runEventAutomations({ tipo: 'stock.cruzo_minimo', productoId: producto_id });
  }

  return NextResponse.json({ product: updatedProduct, log });
}