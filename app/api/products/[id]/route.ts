import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import { storage } from '@/lib/storage';
import { sanitizeGaleria, blobsRetirados, MAX_GALERIA_IMAGENES } from '@/lib/product-gallery';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await params;

  const body    = await req.json();

  // Galería: se normaliza (solo strings no vacíos, sin duplicados) y se valida
  // el tope ACÁ, que es la validación que manda — la del formulario es aviso
  // temprano. El tope cuenta tomas adicionales, no la portada.
  const galeria = sanitizeGaleria(body.imagenes);
  if (galeria.length > MAX_GALERIA_IMAGENES) {
    return NextResponse.json(
      { error: `La galería admite máximo ${MAX_GALERIA_IMAGENES} imágenes adicionales (llegaron ${galeria.length}).` },
      { status: 400 },
    );
  }

  // Estado ANTERIOR de las imágenes, para borrar del store lo que esta edición
  // deje sin referencias. Se lee de la BASE y no se recibe del cliente a
  // propósito: si el borrado se disparara con URLs enviadas por el navegador,
  // cualquier admin podría borrar cualquier blob del store mandando otras.
  const previo = await prisma.product.findUnique({
    where:  { id },
    select: { imagen: true, imagenes: true },
  });

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
      imagenes:    galeria,
      updatedAt:   new Date(),
    },
  });

  // Reemplazo de imagen: el blob viejo queda sin referencias, se borra. Va
  // DESPUÉS del update y sin poder tumbarlo — si el borrado falla queda un blob
  // huérfano (basura barata), mientras que borrar antes de confirmar el update
  // dejaría un producto apuntando a una imagen que ya no existe. `storage.delete`
  // ignora por sí solo las URLs que no administra (las estáticas de public/).
  // La portada anterior solo se borra si además dejó de estar en la galería:
  // degradar la portada a toma adicional NO puede borrar su blob.
  const anterior = previo?.imagen ?? '';
  const portadaRetirada = anterior && anterior !== updated.imagen && !updated.imagenes.includes(anterior);

  // De la galería sale lo que ya no está, excluyendo lo que siga en uso como
  // portada nueva (promover una toma a portada no puede borrar ese blob).
  const galeriaRetirada = blobsRetirados(previo?.imagenes, updated.imagenes, [updated.imagen]);

  for (const url of [...(portadaRetirada ? [anterior] : []), ...galeriaRetirada]) {
    try {
      await storage.delete(url);
    } catch (e) {
      console.error('[products] no se pudo borrar la imagen retirada', url, e);
    }
  }

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

  // Auditable-record guard (the REAL enforcement): a product referenced by any
  // OrderItem is NOT deletable — deleting it would strip the product link off
  // historical order lines. The supported path for a product with history is to
  // DEACTIVATE it (activo: false, via PATCH), keeping the catalogue clean without
  // rewriting the past.
  const product = await prisma.product.findUnique({
    where:   { id },
    include: { _count: { select: { orderItems: true } } },
  });
  if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

  const n = product._count.orderItems;
  if (n > 0) {
    return NextResponse.json(
      { error: `Aparece en ${n} ${n === 1 ? 'orden' : 'órdenes'}; desactívalo en lugar de eliminarlo para conservar el historial.` },
      { status: 409 },
    );
  }

  await prisma.product.delete({ where: { id: id } });

  // Mismo criterio que el reemplazo del PATCH: sin producto no queda nadie
  // referenciando sus imágenes, así que los blobs se van con él — la portada Y
  // toda la galería. Después del delete y sin poder tumbarlo: un blob huérfano
  // es basura barata, un 500 acá dejaría al operador creyendo que el producto no
  // se borró cuando sí. Las estáticas de `public/` las ignora el adaptador, y en
  // un entorno de dev `isDeletable` frena las del prefijo real.
  const suyas = [...new Set([product.imagen, ...product.imagenes].filter(Boolean))];
  for (const url of suyas) {
    try {
      await storage.delete(url);
    } catch (e) {
      console.error('[products] no se pudo borrar la imagen del producto eliminado', url, e);
    }
  }

  return NextResponse.json({ ok: true });
}