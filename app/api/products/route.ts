import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@duna/core';
import { headers } from 'next/headers';
import { sanitizeGaleria, MAX_GALERIA_IMAGENES } from '@duna/core/product-gallery';
import { sanitizeOpciones, validarOpciones } from '@duna/core/moliendas-opciones';
import { crearProductoConAsiento, slugDeNombre } from '@duna/core/product-update';
import type { Prisma } from '@duna/core';

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

  // Mismo tope y misma normalización que el PATCH: un producto no puede NACER
  // con una galería fuera de límite.
  const galeria = sanitizeGaleria(body.imagenes);
  if (galeria.length > MAX_GALERIA_IMAGENES) {
    return NextResponse.json(
      { error: `La galería admite máximo ${MAX_GALERIA_IMAGENES} imágenes adicionales (llegaron ${galeria.length}).` },
      { status: 400 },
    );
  }

  // Opciones de molienda: mismas reglas que el PATCH — un producto no puede
  // NACER con una lista que lo deje incompraable. Solo se tocan si el body las
  // trae; ausentes = producto que no pide molienda (columna null).
  const opciones = body.moliendasOpciones !== undefined
    ? sanitizeOpciones(body.moliendasOpciones)
    : null;
  if (opciones) {
    const problemas = validarOpciones(opciones);
    if (problemas.length > 0) {
      return NextResponse.json({ error: problemas[0].mensaje }, { status: 400 });
    }
  }

  // Crea el producto Y su asiento inaugural en una transacción, para que la
  // cadena del kardex de TODO producto empiece en su primera fila (ver
  // `crearProductoConAsiento`).
  const product = await crearProductoConAsiento({
      nombre:      body.nombre,
      slug:        body.slug || slugDeNombre(body.nombre),
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
      imagenes:    galeria,
      // El cast es el mismo de `prisma/seed.ts`: la columna es Json y el cliente
      // generado no acepta una interfaz sin index signature.
    ...(opciones ? { moliendasOpciones: opciones as unknown as Prisma.InputJsonValue } : {}),
  }, { id: session.user.id, nombre: session.user.name ?? null });

  return NextResponse.json(product, { status: 201 });
}