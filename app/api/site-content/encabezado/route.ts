import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { storage } from '@/lib/storage';
import { siteContentEditableSchema } from '@/lib/config/site-content-schema';
import { guardarBorrador, publicarSeccion, descartarSeccion } from '@/lib/config/site-content-write';

// EL ENCABEZADO (§ PANEL-EDITOR-ENCABEZADO-1, ampliado por § MUESTRARIO-DRAWER-MOVIL-TEMA-1): logo,
// sub-encabezado, color del nav, tratamiento tipográfico del nav y el drawer móvil de pantalla
// completa — cinco ejes que hasta hoy sólo escribía un preset (`mergePresetEnContent`, `themes.ts`).
// Los CINCO viven en CUATRO claves META que `SeccionKey` EXCLUYE del REGISTRY (`cromo`,
// `navWordmark`, `navTratamiento`, `navDrawerMovil`; § site-content-defaults.ts) — NO son una
// sección, así que el PUT/POST GENÉRICO de `/api/site-content` no sirve para publicarlas/
// descartarlas: su gate `seccion in REGISTRY` (route.ts:88) las rechaza con 400. El PUT genérico SÍ
// las acepta al borrador (`siteContentEditableSchema` ya las declara opcionales), pero sin ruta
// propia de publicar quedarían escribiendo un borrador que nunca se puede mover a lo publicado.
//
// El único precedente de una meta no-sección con flujo borrador/publicar es `tema`
// (`app/api/site-content/tema/route.ts`), resuelto con su PROPIA ruta reusando las funciones
// key-agnósticas del write (`guardarBorrador`/`publicarSeccion`/`descartarSeccion`) SIN tocar el
// route genérico ni su gate. Ésta es la MISMA forma, para TRES metas en vez de una:
//
//   PUT                                        = guardar el borrador de las TRES metas del Encabezado.
//   POST { accion: 'publicar' | 'descartar' }  = mover las tres al PUBLICADO / limpiarlas del borrador.
//
// La validación es `siteContentEditableSchema` (LA MISMA del route genérico) acotada con `.pick()` a
// sólo estas tres claves. El pick no es cosmético: sin él, esta ruta aceptaría (y escribiría)
// cualquiera de las 22 claves del schema completo — una segunda puerta genérica con otro nombre, que
// es justo lo que el gate `seccion in REGISTRY` del route genérico existe para acotar del otro lado.
//
// LAS TRES PUBLICACIONES SON SECUENCIALES, NO ATÓMICAS — decisión, no descuido. Es la MISMA
// tolerancia ya aceptada en `site-content-write.ts` para el race guardar↔publicar de una sección: un
// operador humano no alcanza la ventana de milisegundos entre dos escrituras, y un fallo a mitad de
// camino (dos de tres metas publicadas) es visible en el editor (la píldora "Sin publicar" seguiría
// prendida para la que falló) y recuperable reintentando "Publicar" — no un libro contable
// corrompido. Si algún día hiciera falta una publicación atómica de las tres, es una extensión de
// `site-content-write.ts` (fuera de `touches:` de este slice), no algo que esta ruta deba resolver
// por su cuenta.

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) };
  }
  return {};
}

// Acota el schema COMPLETO a las cuatro claves del Encabezado — ver el docstring de arriba.
const encabezadoEditableSchema = siteContentEditableSchema.pick({
  cromo: true,
  navWordmark: true,
  navTratamiento: true,
  navDrawerMovil: true,
});

const METAS_ENCABEZADO = ['cromo', 'navWordmark', 'navTratamiento', 'navDrawerMovil'] as const;

// Borrado de blobs huérfanos, best-effort, DESPUÉS del write (§ route genérico). El Encabezado no
// tiene imágenes propias, así que `blobsABorrar` es siempre `[]` hoy — el contrato se mantiene por
// si una de las tres metas gana un blob mañana.
async function borrarBlobs(urls: string[]) {
  await Promise.allSettled(
    urls.map((u) => storage.delete(u).catch((e) => console.error('[site-content/encabezado] no se pudo borrar blob:', u, e))),
  );
}

// PUT = GUARDAR el borrador de las tres metas del Encabezado.
export async function PUT(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const parsed = encabezadoEditableSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }

  let blobsABorrar: string[];
  try {
    ({ blobsABorrar } = await guardarBorrador(parsed.data));
  } catch (e) {
    console.error('[site-content/encabezado] PUT guardarBorrador:', e);
    return NextResponse.json({ error: 'No se pudo guardar el borrador del encabezado.' }, { status: 500 });
  }
  await borrarBlobs(blobsABorrar);
  return NextResponse.json({ ok: true });
}

// POST = PUBLICAR / DESCARTAR las tres metas del Encabezado, una por una (§ no-atómico, arriba).
export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = (await req.json().catch(() => null)) as { accion?: string } | null;
  const accion = body?.accion;
  if (accion !== 'publicar' && accion !== 'descartar') {
    return NextResponse.json({ error: 'Acción inválida.' }, { status: 400 });
  }

  const blobsABorrar: string[] = [];
  try {
    for (const meta of METAS_ENCABEZADO) {
      const r = accion === 'publicar' ? await publicarSeccion(meta) : await descartarSeccion(meta);
      blobsABorrar.push(...r.blobsABorrar);
    }
  } catch (e) {
    console.error('[site-content/encabezado] POST', accion, e);
    return NextResponse.json({ error: `No se pudo ${accion}.` }, { status: 500 });
  }
  await borrarBlobs(blobsABorrar);
  return NextResponse.json({ ok: true });
}
