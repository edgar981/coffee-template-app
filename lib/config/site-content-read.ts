import prisma from '@duna/core';
import { REGISTRY, mezclarBorrador, resolverSiteContent, type SiteContentData } from './site-content-defaults';

const esObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

// Lector RAW del contenido del storefront — sin `server-only` ni `react/cache`, para los
// contextos que NO son renders (route handlers, carril). Mismo motivo que readSiteSettings:
// `server-only` no resuelve en tsx.
//
// SOFT: sin fila devuelve los defaults resueltos; NUNCA lanza (a diferencia de
// `readSiteSettings`, que usa `findUniqueOrThrow` y falla ruidoso). El vacío es legítimo.

// PUBLICADO — lo que lee la tienda EN VIVO. Sólo `content`, jamás el borrador.
export async function readSiteContent(): Promise<SiteContentData> {
  const row = await prisma.siteContent.findUnique({ where: { id: 'default' } });
  return resolverSiteContent(row?.content ?? {});
}

// PARA EL EDITOR del panel: el contenido draft-merged (lo que el editor muestra y edita —el
// borrador sobre lo publicado) MÁS qué secciones tienen cambios sin publicar (`seccion in
// borrador`), para la píldora "Sin publicar" y los botones Publicar/Descartar. Una sola query.
export async function readSiteContentParaEditor(): Promise<{
  contenido: SiteContentData;
  sinPublicar: Record<string, boolean>;
}> {
  const row = await prisma.siteContent.findUnique({ where: { id: 'default' } });
  const borrador = esObj(row?.borrador) ? row!.borrador : {};
  const contenido = resolverSiteContent(mezclarBorrador(row?.content ?? {}, borrador));
  const sinPublicar: Record<string, boolean> = {};
  for (const key of Object.keys(REGISTRY)) sinPublicar[key] = key in borrador;
  // `tema` (la paleta) NO está en el REGISTRY —es clave no-sección, como `paginas`— pero también se
  // borronea: su píldora "Sin publicar" y sus botones Publicar/Descartar salen de este mismo flag.
  sinPublicar.tema = 'tema' in borrador;
  // EL ENCABEZADO (§ PANEL-EDITOR-ENCABEZADO-1): TRES metas no-sección (`cromo`, `navWordmark`,
  // `navTratamiento`) editadas como UNA sola sección del panel (`EncabezadoSeccion.tsx`, con su
  // propia ruta de publicar/descartar, `/api/site-content/encabezado`, patrón `tema/route.ts`). La
  // píldora "Sin publicar" se prende si CUALQUIERA de las tres está en el borrador — el operador
  // edita las tres juntas, así que el flag es UNO solo, gemelo del de `tema`.
  sinPublicar.encabezado = 'cromo' in borrador || 'navWordmark' in borrador || 'navTratamiento' in borrador;
  return { contenido, sinPublicar };
}
