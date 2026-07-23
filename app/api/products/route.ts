import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const products = await prisma.product.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await req.json();

  const product = await prisma.product.create({
    data: {
      nombre:      body.nombre,
      slug:        body.slug || body.nombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      descripcion: body.descripcion  || '',
      categoria:   body.categoria,
      precio:      Number(body.precio)      || 0,
      costo:       Number(body.costo)       || 0,
      sku:         body.sku                 || null,
      stock:       Number(body.stock)       || 0,
      stock_minimo: Number(body.stock_minimo) || 5,
      activo:      body.activo              ?? true,
      peso_gramos: body.peso_gramos ? Number(body.peso_gramos) : null,
      variante:    body.variante            || null,
      origen:      body.origen              || null,
      tostado:     body.tostado             || null,
      imagen:      body.imagen              || '',
      imagenes:    body.imagenes            || [],
    },
  });

  return NextResponse.json(product, { status: 201 });
}