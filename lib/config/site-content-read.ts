import prisma from '@duna/core';
import { mezclarBorrador, resolverSiteContent, type SiteContentData } from './site-content-defaults';

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

// BORRADOR — lo que lee la VISTA PREVIA del panel (gateada a admin, commit 2). Overlay del
// borrador sobre lo publicado, por sección; sin fila o sin borrador, es idéntico a lo
// publicado. Nunca lo sirve la tienda pública: su único llamador es el render de preview
// detrás del gate de sesión.
export async function readSiteContentBorrador(): Promise<SiteContentData> {
  const row = await prisma.siteContent.findUnique({ where: { id: 'default' } });
  return resolverSiteContent(mezclarBorrador(row?.content ?? {}, row?.borrador ?? {}));
}
