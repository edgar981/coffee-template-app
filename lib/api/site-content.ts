import type { SiteContentData } from '@/lib/config/site-content-defaults';

// El contenido PUBLICADO del storefront (lo que ve el visitante) — para el AVISO de configuración del
// Dashboard (§ Backlog #65). NO confundir con `GET /api/site-content` (draft-merged), que muestra el
// BORRADOR del editor: éste es lo PUBLICADO, vía `readSiteContent` (§ el endpoint /publicado).
export async function getSiteContentPublicado(): Promise<SiteContentData> {
  const res = await fetch('/api/site-content/publicado');
  if (!res.ok) throw new Error('Error al cargar el contenido publicado de la tienda');
  return res.json();
}
