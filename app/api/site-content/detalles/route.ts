import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import prisma from '@duna/core';
import { auth } from '@/lib/auth';
import { storage } from '@/lib/storage';
import { siteContentEditableSchema } from '@/lib/config/site-content-schema';
import { guardarBorrador, publicarSeccion, descartarSeccion } from '@/lib/config/site-content-write';
import { DEFAULTS, mezclarBorrador, resolverVolverArriba, resolverRielSocial, resolverCarritoEnvio } from '@/lib/config/site-content-defaults';

// DETALLES DEL SITIO (§ PANEL-DETALLES-SITIO-1) — el nombre que el owner le dio (2026-09-23) a "volver
// arriba y redes sociales": los DOS ejes de chrome del grupo `PANEL-EDITOR-CHROME-METAS-1`
// (`lib/config/panel-controles.ts`, PENDIENTE_PANEL) que `PANEL-EDITOR-ENCABEZADO-1` dejó
// explícitamente FUERA ("son 'Detalles del sitio', fuera de este slice, con su propio disparador
// futuro"). Vivían en DOS claves META que
// `SeccionKey` EXCLUYE del REGISTRY (`volverArriba`, `rielSocial`; § site-content-defaults.ts) — no
// son una sección, así que el POST publicar/descartar del route GENÉRICO las rechaza con 400
// (`seccion in REGISTRY`, § app/api/site-content/route.ts:88). Por eso tienen su PROPIA ruta, MISMO
// patrón que `tema`/`encabezado`:
//
//   GET                                        = leer el draft-merged de las metas + si hay
//                                                 borrador pendiente.
//   PUT                                        = guardar el borrador de las metas.
//   POST { accion: 'publicar' | 'descartar' }  = mover las metas al PUBLICADO / limpiarlas del borrador.
//
// La validación de PUT es `siteContentEditableSchema` (LA MISMA del route genérico) acotada con
// `.pick()` a sólo estas claves — el pick no es cosmético: sin él, esta ruta aceptaría (y
// escribiría) cualquiera de las 27 claves del schema completo, exactamente lo que el gate `seccion in
// REGISTRY` del route genérico existe para impedir del otro lado (§ el docstring de
// `app/api/site-content/encabezado/route.ts`, el mismo argumento).
//
// EL GET ES PROPIO, A DIFERENCIA DE `encabezado`/`tema` (que no tienen GET propio y se apoyan en el
// GENÉRICO `/api/site-content` + su `sinPublicar.encabezado`/`sinPublicar.tema`, calculados en
// `lib/config/site-content-read.ts`) — DECISIÓN DE ALCANCE de este slice, no una segunda forma de
// resolver el borrador. `lib/config/site-content-read.ts` NO está en `touches:` de este slice: sumarle
// una clave `sinPublicar.detalles` ahí habría ensanchado un archivo compartido fuera de lo declarado.
// La MECÁNICA (borrador sobre publicado) es la MISMA que usa ese archivo — `mezclarBorrador` +
// los resolvers de cada meta, todos YA exportados de `site-content-defaults.ts`, sin duplicar ningún
// cómputo—; sólo el PUNTO donde se arma la respuesta es local a esta ruta, acotado a las claves
// que le pertenecen (no resuelve el `SiteContentData` completo: sería resolver 15 secciones enteras
// para leer un puñado de booleanos).
//
// LAS PUBLICACIONES SON SECUENCIALES, NO ATÓMICAS — la MISMA tolerancia que
// `site-content-write.ts` ya acepta para el race guardar↔publicar de una sección (§ el docstring de
// `app/api/site-content/encabezado/route.ts`): un operador humano no alcanza la ventana de
// milisegundos entre dos escrituras, y un fallo a mitad de camino es visible en el editor (la píldora
// "Sin publicar" seguiría prendida) y recuperable reintentando "Publicar".
//
// § MUESTRARIO-CARRITO-BARRA-ENVIO-1 (2026-09-25) sumó una TERCERA meta a esta MISMA ruta:
// `carritoEnvio` (`{visible: boolean}`, la barra de progreso hacia el envío gratis del carrito —
// ver el docstring de `CarritoEnvioContent`, `site-content-defaults.ts`). El mecanismo de arriba NO
// cambió de forma — GENERALIZA a N metas cerradas de 1 clave cada una, no una segunda mitad
// paralela—: sólo crecieron `METAS_DETALLES`, el `.pick()` de `detallesEditableSchema` y la
// respuesta del GET.

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) };
  }
  return {};
}

// Acota el schema COMPLETO a las claves de Detalles del sitio — ver el docstring de arriba.
const detallesEditableSchema = siteContentEditableSchema.pick({
  volverArriba: true,
  rielSocial: true,
  carritoEnvio: true,
});

const METAS_DETALLES = ['volverArriba', 'rielSocial', 'carritoEnvio'] as const;

const esObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

// Borrado de blobs huérfanos, best-effort, DESPUÉS del write (§ route genérico). Ninguna de las
// metas tiene imágenes (cada una es `{visible: boolean}`, dominio cerrado de 1 clave), así que
// `blobsABorrar` es siempre `[]` hoy — el contrato se mantiene por la misma razón que en
// `encabezado/route.ts`: si alguna de ellas ganara un campo de imagen mañana, el borrado ya está
// cableado.
async function borrarBlobs(urls: string[]) {
  await Promise.allSettled(
    urls.map((u) => storage.delete(u).catch((e) => console.error('[site-content/detalles] no se pudo borrar blob:', u, e))),
  );
}

// GET = leer el draft-merged de `volverArriba`/`rielSocial`/`carritoEnvio` + si hay borrador
// pendiente para cualquiera de las tres (una sola píldora "Sin publicar", como `encabezado`).
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const row = await prisma.siteContent.findUnique({ where: { id: 'default' } });
  const content = esObj(row?.content) ? row!.content : {};
  const borrador = esObj(row?.borrador) ? row!.borrador : {};
  const merged = mezclarBorrador(content, borrador) as { volverArriba?: unknown; rielSocial?: unknown; carritoEnvio?: unknown };

  return NextResponse.json({
    contenido: {
      volverArriba: resolverVolverArriba(merged.volverArriba, DEFAULTS.volverArriba),
      rielSocial: resolverRielSocial(merged.rielSocial, DEFAULTS.rielSocial),
      carritoEnvio: resolverCarritoEnvio(merged.carritoEnvio, DEFAULTS.carritoEnvio),
    },
    sinPublicar: METAS_DETALLES.some((m) => m in borrador),
  });
}

// PUT = GUARDAR el borrador de las metas de Detalles del sitio.
export async function PUT(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const parsed = detallesEditableSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }

  let blobsABorrar: string[];
  try {
    ({ blobsABorrar } = await guardarBorrador(parsed.data));
  } catch (e) {
    console.error('[site-content/detalles] PUT guardarBorrador:', e);
    return NextResponse.json({ error: 'No se pudo guardar el borrador.' }, { status: 500 });
  }
  await borrarBlobs(blobsABorrar);
  return NextResponse.json({ ok: true });
}

// POST = PUBLICAR / DESCARTAR las metas, una por una (§ no-atómico, arriba).
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
    for (const meta of METAS_DETALLES) {
      const r = accion === 'publicar' ? await publicarSeccion(meta) : await descartarSeccion(meta);
      blobsABorrar.push(...r.blobsABorrar);
    }
  } catch (e) {
    console.error('[site-content/detalles] POST', accion, e);
    return NextResponse.json({ error: `No se pudo ${accion}.` }, { status: 500 });
  }
  await borrarBlobs(blobsABorrar);
  return NextResponse.json({ ok: true });
}
