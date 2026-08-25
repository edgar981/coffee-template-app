import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import prisma from '@duna/core';
import { storage } from '@/lib/storage';
import { siteContentEditableSchema } from '@/lib/config/site-content-schema';
import { readSiteContent } from '@/lib/config/site-content-read';

// Contenido del storefront (SiteContent). GET devuelve el contenido RESUELTO (defaults
// aplicados) para que el editor prellene con lo efectivo. PUT valida y hace UPSERT del
// singleton, MERGEANDO la(s) sección(es) entrante(s) en lo existente —editar el hero no
// pisa otras secciones futuras—. Guardado a OWNER/MANAGER, re-chequeo acá (defensa en
// profundidad, como el resto de /api/*).

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) };
  }
  return {};
}

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  return NextResponse.json(await readSiteContent());
}

export async function PUT(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const parsed = siteContentEditableSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }

  const row = await prisma.siteContent.findUnique({ where: { id: 'default' } });
  const existing =
    row?.content && typeof row.content === 'object' && !Array.isArray(row.content)
      ? (row.content as Record<string, unknown>)
      : {};
  // El editor manda la sección COMPLETA, así que reemplazar la sección (no deep-merge)
  // es correcto; el spread preserva las OTRAS secciones.
  const nuevo = { ...existing, ...parsed.data };

  const imagenVieja = (existing.hero as { imagen?: string } | undefined)?.imagen;
  const imagenNueva = parsed.data.hero?.imagen;

  await prisma.siteContent.upsert({
    where:  { id: 'default' },
    update: { content: nuevo as never },
    create: { id: 'default', content: nuevo as never },
  });

  // Borra el blob viejo si la imagen CAMBIÓ, DESPUÉS de confirmar el write (como en
  // productos). `storage.delete` es no-op sobre paths estáticos / URLs foráneas / blobs
  // no-borrables por entorno, así que volver al default (`/images/…`) no borra nada.
  if (imagenVieja && imagenNueva && imagenVieja !== imagenNueva) {
    try { await storage.delete(imagenVieja); }
    catch (e) { console.error('[site-content] no se pudo borrar el blob viejo del hero:', e); }
  }

  return NextResponse.json({ ok: true });
}
