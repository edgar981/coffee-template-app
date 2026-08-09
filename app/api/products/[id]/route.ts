import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@duna/core';
import { headers } from 'next/headers';
import { storage } from '@/lib/storage';
import { sanitizeGaleria, blobsRetirados, MAX_GALERIA_IMAGENES } from '@/lib/product-gallery';
import { aplicarPatchProducto, trae } from '@/lib/product-update';
import { sanitizeOpciones, validarOpciones } from '@/lib/moliendas-opciones';

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
  // temprano. El tope cuenta tomas adicionales, no la portada. Solo si el body
  // TRAE la clave: un PATCH que no habla de la galería no la valida ni la toca.
  if (trae(body, 'imagenes')) {
    const galeria = sanitizeGaleria(body.imagenes);
    if (galeria.length > MAX_GALERIA_IMAGENES) {
      return NextResponse.json(
        { error: `La galería admite máximo ${MAX_GALERIA_IMAGENES} imágenes adicionales (llegaron ${galeria.length}).` },
        { status: 400 },
      );
    }
  }

  // Opciones de molienda. Esta es la validación que MANDA — la del modal es aviso
  // temprano — y su regla dura es la del checkout: si el producto declara
  // opciones, al menos una tiene que estar disponible. Sin eso, `moliendaAceptada`
  // rechaza todas y el producto queda vivo en el catálogo pero incompraable.
  //
  // Sólo si el body TRAE la clave — la misma regla general del endpoint
  // (§ El PATCH de producto es PARCIAL de verdad). Acá importa el doble: este
  // PATCH también lo llama el "Desactivar" con un body de un solo campo, y
  // escribir `moliendasOpciones` sin condición vaciaría la lista por desactivar
  // un producto. Eso no sería perder un campo: sería cambiarle el comportamiento
  // a su card en la tienda.
  //
  // ESTA validación se queda en el handler porque produce un 400; QUIÉN escribe
  // el campo es de `datosDelPatch`. Las dos comparten las funciones puras, así
  // que no pueden discrepar sobre qué es una lista válida.
  if (trae(body, 'moliendasOpciones')) {
    const problemas = validarOpciones(sanitizeOpciones(body.moliendasOpciones));
    if (problemas.length > 0) {
      return NextResponse.json({ error: problemas[0].mensaje }, { status: 400 });
    }
  }

  // La escritura entera —campos presentes + el asiento de kardex si tocó el
  // stock— vive en `lib/product-update`, en UNA transacción y bajo
  // `SELECT … FOR UPDATE`. Está ahí y no acá porque es lo que el carril de
  // integración tiene que poder afirmar contra una base real: que un PATCH
  // parcial no toca nada más, y que la puerta del modal deja su firma.
  //
  // `previo` son las imágenes ANTES de la edición, leídas de la BASE dentro de
  // la misma transacción: si el borrado de blobs se disparara con URLs enviadas
  // por el navegador, cualquier admin podría borrar cualquier blob del store
  // mandando otras.
  const resultado = await aplicarPatchProducto(id, body);
  if (!resultado) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
  const { previo, updated } = resultado;

  // Reemplazo de imagen: el blob viejo queda sin referencias, se borra. Va
  // DESPUÉS del update y sin poder tumbarlo — si el borrado falla queda un blob
  // huérfano (basura barata), mientras que borrar antes de confirmar el update
  // dejaría un producto apuntando a una imagen que ya no existe. `storage.delete`
  // ignora por sí solo las URLs que no administra (las estáticas de public/).
  // La portada anterior solo se borra si además dejó de estar en la galería:
  // degradar la portada a toma adicional NO puede borrar su blob.
  //
  // ESTO SE DEFIENDE SOLO desde que el update es parcial, y por una razón que hay
  // que conservar: el diff es BASE-ANTES contra BASE-DESPUÉS, nunca contra el
  // body. Un PATCH que no habla de imágenes deja las dos lecturas idénticas, así
  // que no hay nada retirado y no se borra nada. Reescribir esto para decidir
  // desde `body` reabriría el agujero: era el update el que mentía, no el diff.
  const anterior = previo.imagen;
  const portadaRetirada = anterior && anterior !== updated.imagen && !updated.imagenes.includes(anterior);

  // De la galería sale lo que ya no está, excluyendo lo que siga en uso como
  // portada nueva (promover una toma a portada no puede borrar ese blob).
  const galeriaRetirada = blobsRetirados(previo.imagenes, updated.imagenes, [updated.imagen]);

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