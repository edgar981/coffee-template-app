import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import { createNotification } from '@/lib/notifications';

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const automation = await prisma.automation.findUnique({
    where: { tipo: 'stock_bajo' },
  });

  if (!automation?.activa) {
    return NextResponse.json({ message: 'Automatización inactiva', created: 0 });
  }

  const products = await prisma.product.findMany({
    where: { activo: true },
  });

  let created = 0;

  for (const p of products) {
    const minimo = p.stock_minimo ?? 5;
    if (p.stock <= minimo) {
      // Avoid duplicate notifications — check if one already exists today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const existing = await prisma.notification.findFirst({
        where: {
          tipo:      'stock_bajo',
          mensaje:   { contains: p.nombre },
          createdAt: { gte: today },
        },
      });

      if (!existing) {
        await createNotification({
          tipo:    'stock_bajo',
          titulo:  'Stock bajo',
          mensaje: `${p.nombre} tiene solo ${p.stock} unidades (mínimo: ${minimo}).`,
          href:    '/admin/inventario',
        });
        created++;
      }
    }
  }

  if (created > 0) {
    await prisma.automation.update({
      where: { tipo: 'stock_bajo' },
      data: {
        veces_ejecutada:  { increment: created },
        ultima_ejecucion: new Date(),
      },
    });
  }

  return NextResponse.json({ created });
}