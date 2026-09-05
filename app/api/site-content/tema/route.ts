import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { paletaEditableSchema } from '@/lib/config/palette-schema';
import { guardarTemaBorrador, publicarSeccion, descartarSeccion } from '@/lib/config/site-content-write';

// El TEMA (la paleta del storefront), flujo BORRADOR/PUBLICADO. La MISMA máquina que las secciones
// de contenido (§ site-content-write) pero con su propia VALIDACIÓN —3 hex o null, no campos de
// texto— y su propia route, porque `tema` es clave NO-sección (no pasa por el schema de secciones del
// PUT de `/api/site-content`). La paleta se mudó de SiteSetting (guardar=publicar al instante) a acá
// para ganar el borrador (§ doctrina: la frontera borrador/no-borrador es de PANTALLA, no por campo).
//
//   PUT                                 = guardar el borrador del tema.
//   POST { accion: 'publicar' | 'descartar' } = mover el borrador a lo publicado / limpiarlo.
//
// El storefront lee lo PUBLICADO (`content.tema`, § layout); el editor lee el draft-merged
// (GET /api/site-content → readSiteContentParaEditor). Guardado a OWNER/MANAGER, re-chequeo acá
// (defensa en profundidad, igual que el resto de /api/*).

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) };
  }
  return {};
}

// PUT = GUARDAR el borrador del tema. La validación es la que MANDA (`paletaEditableSchema`): un valor
// que no sea hex de 6 dígitos —o una paleta a medias— devuelve 400 y no llega al motor de derivación.
export async function PUT(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const parsed = paletaEditableSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }
  const d = parsed.data;

  try {
    // El wire usa las claves históricas (`paletaFondo…`); lo GUARDADO usa la forma de `content.tema`
    // (`fondo/tinta/acento`). El par (`fuentePar`) ya viene con su nombre final. El mapeo vive acá.
    await guardarTemaBorrador({ fondo: d.paletaFondo, tinta: d.paletaTinta, acento: d.paletaAcento, fuentePar: d.fuentePar });
  } catch (e) {
    console.error('[site-content/tema] PUT guardarTemaBorrador:', e);
    return NextResponse.json({ error: 'No se pudo guardar el borrador del tema.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// POST = PUBLICAR / DESCARTAR el borrador del tema. Reusa las funciones key-agnósticas del write con
// la clave `tema`. Publicar el tema no mueve blobs (la paleta no tiene imágenes), así que se ignora
// el `blobsABorrar` que devuelven —siempre vacío para `tema`—.
export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = (await req.json().catch(() => null)) as { accion?: string } | null;
  const accion = body?.accion;
  if (accion !== 'publicar' && accion !== 'descartar') {
    return NextResponse.json({ error: 'Acción inválida.' }, { status: 400 });
  }

  try {
    if (accion === 'publicar') await publicarSeccion('tema');
    else await descartarSeccion('tema');
  } catch (e) {
    console.error('[site-content/tema] POST', accion, e);
    return NextResponse.json({ error: `No se pudo ${accion}.` }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
