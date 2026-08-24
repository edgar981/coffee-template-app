'use client';

import { createContext, useContext, type ReactNode } from 'react';
// `import type` (erased en compilación) desde un módulo server-only: no dispara el
// guard de `server-only` porque no entra al bundle cliente. Sólo viaja el TIPO.
import type { SiteSettings } from '@/lib/config/site-settings';

// Provider del ADMIN para la config editable del negocio. El layout-gate
// (app/(admin)/admin/layout.tsx) lee `getSiteSettings()` en paralelo con la sesión
// y la inyecta acá; los lectores cliente (perfil, pedidos, pagos, clientes,
// ScheduleDeliveryModal) la leen con `useSiteSettings()` — cero fetch por navegación.
//
// Es un contexto PROPIO del admin, separado del storefront (commit 3). Son dos
// layouts, dos árboles que no se tocan, y el admin tiene sesión y gate que el
// storefront no — compartir un provider ataría dos cosas independientes.
const Ctx = createContext<SiteSettings | null>(null);

export function SiteSettingsProvider({ value, children }: { value: SiteSettings; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Fail-loud si se usa fuera del provider — igual que el loader, no un fallback silencioso. */
export function useSiteSettings(): SiteSettings {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSiteSettings() fuera de <SiteSettingsProvider> (admin)');
  return s;
}
