import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import { createNotification } from '@/lib/notifications';

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { producto_id, tipo, cantidad, motivo } = await req.json();

  const product = await prisma.product.findUnique({ where: { id: producto_id } });
  if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

  const qty = Number(cantidad);
  const newStock =
    tipo === 'entrada'   ? product.stock + qty :
    tipo === 'salida'    ? Math.max(0, product.stock - qty) :
    tipo === 'devolucion'? product.stock + qty :
    qty; // ajuste — set directly

  // Use a transaction so both operations succeed or both fail
  const [updatedProduct, log] = await prisma.$transaction([
    prisma.product.update({
      where: { id: producto_id },
      data:  { stock: newStock, updatedAt: new Date() },
    }),
    prisma.inventoryLog.create({
      data: {
        producto_id,
        producto_nombre: product.nombre,
        tipo,
        cantidad:        qty,
        stock_anterior:  product.stock,
        stock_nuevo:     newStock,
        motivo:          motivo || null,
      },
    }),
  ]);

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