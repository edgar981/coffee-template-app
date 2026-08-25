import prisma from '@duna/core';
import { resolverSiteContent, type SiteContentData } from './site-content-defaults';

// Lector RAW del contenido del storefront — sin `server-only` ni `react/cache`, para los
// contextos que NO son renders (route handlers, carril). Mismo motivo que readSiteSettings:
// `server-only` no resuelve en tsx.
//
// SOFT: sin fila devuelve los defaults resueltos; NUNCA lanza (a diferencia de
// `readSiteSettings`, que usa `findUniqueOrThrow` y falla ruidoso). El vacío es legítimo.
export async function readSiteContent(): Promise<SiteContentData> {
  const row = await prisma.siteContent.findUnique({ where: { id: 'default' } });
  return resolverSiteContent(row?.content ?? {});
}
