import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { storage } from '@/lib/storage';
import { siteContentEditableSchema } from '@/lib/config/site-content-schema';
import { readSiteContentParaEditor } from '@/lib/config/site-content-read';
import { REGISTRY } from '@/lib/config/site-content-defaults';
import { guardarBorrador, publicarSeccion, descartarSeccion } from '@/lib/config/site-content-write';

// Contenido del storefront (SiteContent), flujo BORRADOR/PUBLICADO. Guardar deja de publicar:
// el PUT escribe el BORRADOR; PUBLICAR (POST) copia una sección del borrador a lo publicado;
// DESCARTAR (POST) la limpia sin publicar. La vista previa del panel lee el borrador (gateada a
// admin, § la página del storefront); la tienda pública lee lo publicado. Guardado a
// OWNER/MANAGER, re-chequeo acá (defensa en profundidad).

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) };
  }
  return {};
}

// Borrado de blobs huérfanos, DESPUÉS del write y best-effort: un fallo del delete NO tumba el
// 200 (el write ya commiteó; un blob huérfano es basura barata). Si el WRITE falla, las funciones
// de escritura lanzan y no se llega acá — no se borra nada.
async function borrarBlobs(urls: string[]) {
  await Promise.allSettled(
    urls.map((u) => storage.delete(u).catch((e) => console.error('[site-content] no se pudo borrar blob:', u, e))),
  );
}

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  // El editor muestra/edita el BORRADOR (draft-merged) y sabe qué secciones tienen cambios sin
  // publicar. La tienda pública NO usa este endpoint —lee lo publicado por su loader (§ layout)—.
  return NextResponse.json(await readSiteContentParaEditor());
}

// PUT = GUARDAR: escribe el BORRADOR, no publica.
export async function PUT(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const parsed = siteContentEditableSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }

  let blobsABorrar: string[];
  try {
    ({ blobsABorrar } = await guardarBorrador(parsed.data));
  } catch (e) {
    console.error('[site-content] PUT guardarBorrador:', e);
    return NextResponse.json({ error: 'No se pudo guardar el borrador.' }, { status: 500 });
  }
  await borrarBlobs(blobsABorrar);
  return NextResponse.json({ ok: true });
}

// POST = PUBLICAR / DESCARTAR una sección.
export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = (await req.json().catch(() => null)) as { accion?: string; seccion?: string } | null;
  const accion = body?.accion;
  const seccion = body?.seccion;
  if ((accion !== 'publicar' && accion !== 'descartar') || !seccion || !(seccion in REGISTRY)) {
    return NextResponse.json({ error: 'Acción o sección inválida.' }, { status: 400 });
  }

  let blobsABorrar: string[];
  try {
    ({ blobsABorrar } = accion === 'publicar' ? await publicarSeccion(seccion) : await descartarSeccion(seccion));
  } catch (e) {
    console.error('[site-content] POST', accion, e);
    return NextResponse.json({ error: `No se pudo ${accion}.` }, { status: 500 });
  }
  await borrarBlobs(blobsABorrar);
  return NextResponse.json({ ok: true });
}
