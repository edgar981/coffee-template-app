import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await params;

  const body    = await req.json();
  const updated = await prisma.product.update({
    where: { id: id },
    data: {
      nombre:      body.nombre,
      slug:        body.slug        || undefined,
      descripcion: body.descripcion || '',
      categoria:   body.categoria,
      precio:      Number(body.precio)       || 0,
      costo:       Number(body.costo)        || 0,
      sku:         body.sku                  || null,
      stock:       Number(body.stock)        || 0,
      stock_minimo: Number(body.stock_minimo) || 5,
      activo:      body.activo               ?? true,
      peso_gramos: body.peso_gramos ? Number(body.peso_gramos) : null,
      variante:    body.variante             || null,
      origen:      body.origen               || null,
      tostado:     body.tostado              || null,
      imagen:      body.imagen               || '',
      imagenes:    body.imagenes             || [],
      updatedAt:   new Date(),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await params;
  await prisma.product.delete({ where: { id: id } });

  return NextResponse.json({ ok: true });
}