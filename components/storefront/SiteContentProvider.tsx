'use client';

import { createContext, useContext, type ReactNode } from 'react';
// `import type` (erased en compilación) desde el módulo server-only: sólo viaja el TIPO.
import type { SiteContentData } from '@/lib/config/site-content';

// Provider del CONTENIDO del storefront (la home). El layout server lee `getSiteContent()`
// —ya RESUELTO: defaults aplicados, vacío legítimo respetado— y lo inyecta; las secciones
// cliente (HeroSection, y luego BrandStory/Testimonials/SubscriptionCTA) lo leen con
// `useSiteContent()`, sin fetch por navegación.
//
// Es un provider PROPIO, separado del de SiteSettings (identidad del negocio): son dos
// datos con cadencia y modo de falla distintos (§ Config del contenido — SiteContent).
const Ctx = createContext<SiteContentData | null>(null);

export function SiteContentProvider({ value, children }: { value: SiteContentData; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Fail-loud si se usa fuera del provider — eso es un bug de montaje, no el "vacío
 *  legítimo" del contenido (que el loader ya resolvió a defaults). */
export function useSiteContent(): SiteContentData {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSiteContent() fuera de <SiteContentProvider> (storefront)');
  return c;
}
