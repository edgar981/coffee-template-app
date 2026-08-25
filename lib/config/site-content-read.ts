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
  return { contenido, sinPublicar };
}
