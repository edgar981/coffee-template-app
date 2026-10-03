import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import prisma from '@duna/core';
import type { Prisma } from '@duna/core';
import { auth } from '@/lib/auth';
import { storage } from '@/lib/storage';
import { siteContentEditableSchema } from '@/lib/config/site-content-schema';
import { readSiteContentParaEditor } from '@/lib/config/site-content-read';
import { REGISTRY, DEFAULTS } from '@/lib/config/site-content-defaults';
import { guardarBorrador, publicarSeccion, descartarSeccion, setPaginaVisible } from '@/lib/config/site-content-write';
import { blobsHuerfanos } from '@/lib/config/site-content-blobs';

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

const esObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

// PUBLICAR/DESCARTAR VARIAS SECCIONES DE UNA VEZ (§ EDITOR-TIENDA-DESHACER-1) — el botón "Publicar"
// de la barra del editor actúa sobre TODAS las secciones con borrador pendiente de la página
// abierta (más 'orden'/'tema' si corresponde) EN UN SOLO GESTO: o se mueven TODAS a `content`, o
// ninguna. Llamar a `publicarSeccion`/`descartarSeccion` (site-content-write.ts) una vez por
// sección abriría UNA TRANSACCIÓN POR SECCIÓN — atómico por sección, no atómico como CONJUNTO (un
// fallo a mitad de camino dejaría publicadas sólo las primeras). Por eso estas dos funciones NO
// llaman a esas — repiten su MISMA lógica (mover `borrador[s]` a `content[s]`, o descartarlo) para
// TODA la lista, dentro de UNA sola `prisma.$transaction`.
//
// Viven ACÁ, no en `lib/config/site-content-write.ts` (fuera de `touches:` de este slice): son
// key-agnósticas igual que sus hermanas de una sola sección —`'orden'`/`'tema'` pasan por acá
// exactamente como cualquier clave del REGISTRY, sin un `if` especial—, y se exportan para que el
// carril (`tests/integracion/publicar-pagina.test.ts`) las importe DIRECTO, sin montar HTTP (mismo
// criterio de siempre: la escritura que hay que afirmar contra una base real tiene que ser una
// función, § CLAUDE.md "El PATCH de producto es PARCIAL de verdad"). Importar este módulo de ruta
// fuera de un request de Next es seguro — medido por ejecución (`next/headers` no se INVOCA al
// importar, sólo al llamar `requireAdmin`, que el carril nunca llama).
//
// Secciones SIN borrador en la lista se ignoran (mismo comportamiento que `publicarSeccion`/
// `descartarSeccion` para una sección sola): pedir publicar una lista donde ninguna tiene borrador
// es un no-op, nunca un error.
export async function publicarVariasSecciones(secciones: string[]): Promise<{ blobsABorrar: string[] }> {
  return prisma.$transaction(async (tx) => {
    const row = await tx.siteContent.findUnique({ where: { id: 'default' } });
    const content = esObj(row?.content) ? (row!.content as Record<string, unknown>) : {};
    const borrador = esObj(row?.borrador) ? (row!.borrador as Record<string, unknown>) : {};
    const nuevoContent = { ...content };
    const nuevoBorrador = { ...borrador };
    let algoCambio = false;
    for (const seccion of secciones) {
      if (!(seccion in borrador)) continue;
      nuevoContent[seccion] = borrador[seccion];
      delete nuevoBorrador[seccion];
      algoCambio = true;
    }
    if (!algoCambio) return { blobsABorrar: [] };
    await tx.siteContent.update({
      where: { id: 'default' },
      data: {
        content: nuevoContent as unknown as Prisma.InputJsonValue,
        borrador: nuevoBorrador as unknown as Prisma.InputJsonValue,
      },
    });
    return { blobsABorrar: blobsHuerfanos({ content, borrador }, { content: nuevoContent, borrador: nuevoBorrador }) };
  });
}

export async function descartarVariasSecciones(secciones: string[]): Promise<{ blobsABorrar: string[] }> {
  return prisma.$transaction(async (tx) => {
    const row = await tx.siteContent.findUnique({ where: { id: 'default' } });
    const content = esObj(row?.content) ? (row!.content as Record<string, unknown>) : {};
    const borrador = esObj(row?.borrador) ? (row!.borrador as Record<string, unknown>) : {};
    const nuevoBorrador = { ...borrador };
    let algoCambio = false;
    for (const seccion of secciones) {
      if (!(seccion in borrador)) continue;
      delete nuevoBorrador[seccion];
      algoCambio = true;
    }
    if (!algoCambio) return { blobsABorrar: [] };
    await tx.siteContent.update({
      where: { id: 'default' },
      data: { borrador: nuevoBorrador as unknown as Prisma.InputJsonValue },
    });
    return { blobsABorrar: blobsHuerfanos({ content, borrador }, { content, borrador: nuevoBorrador }) };
  });
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

  const body = (await req.json().catch(() => null)) as
    { accion?: string; seccion?: string; pagina?: string; visible?: boolean; secciones?: unknown } | null;
  const accion = body?.accion;

  // PUBLICAR/DESCARTAR VARIAS (§ EDITOR-TIENDA-DESHACER-1) — el "Publicar" de la barra de estado,
  // atómico sobre la lista completa (arriba, `publicarVariasSecciones`/`descartarVariasSecciones`).
  // Cada elemento se valida con el MISMO criterio que la sección única, abajo ('orden'/'tema' o una
  // clave del REGISTRY) — una lista con un valor inválido se rechaza ENTERA, nunca se publica una
  // parte y se ignora el resto en silencio.
  if (accion === 'publicarVarias' || accion === 'descartarVarias') {
    const secciones = body?.secciones;
    if (
      !Array.isArray(secciones) || secciones.length === 0 ||
      !secciones.every((s): s is string => typeof s === 'string' && (s === 'orden' || s === 'tema' || s in REGISTRY))
    ) {
      return NextResponse.json({ error: 'Lista de secciones inválida.' }, { status: 400 });
    }
    let blobsABorrar: string[];
    try {
      ({ blobsABorrar } = accion === 'publicarVarias'
        ? await publicarVariasSecciones(secciones)
        : await descartarVariasSecciones(secciones));
    } catch (e) {
      console.error('[site-content] POST', accion, e);
      return NextResponse.json({ error: `No se pudo ${accion === 'publicarVarias' ? 'publicar' : 'descartar'}.` }, { status: 500 });
    }
    await borrarBlobs(blobsABorrar);
    return NextResponse.json({ ok: true });
  }

  // TOGGLE de página (encender/apagar /nosotros): va directo a lo publicado, no por borrador.
  if (accion === 'setPaginaVisible') {
    const pagina = body?.pagina;
    if (!pagina || !(pagina in DEFAULTS.paginas) || typeof body?.visible !== 'boolean') {
      return NextResponse.json({ error: 'Página o valor inválido.' }, { status: 400 });
    }
    try {
      await setPaginaVisible(pagina, body.visible);
    } catch (e) {
      console.error('[site-content] POST setPaginaVisible:', e);
      return NextResponse.json({ error: 'No se pudo cambiar la visibilidad de la página.' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // 'orden' (§ EDITOR-TIENDA-ORDEN-1) es clave META —el orden de las bandas del home,
  // `site-content-defaults.ts`— fuera del REGISTRY a propósito (como `tema`/`paginas`): `tema` tiene
  // su propia ruta (`/api/site-content/tema`) por su validación dura; `orden` no la necesita —su
  // guardado YA pasa por este mismo PUT genérico (`ordenEditableSchema` ya declarado en
  // `siteContentEditableSchema`)— así que sólo falta aceptar esta clave acá, junto al REGISTRY.
  // `publicarSeccion`/`descartarSeccion` ya son key-agnósticas (site-content-write.ts) — no cambian.
  const seccion = body?.seccion;
  if ((accion !== 'publicar' && accion !== 'descartar') || !seccion || !(seccion === 'orden' || seccion in REGISTRY)) {
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
