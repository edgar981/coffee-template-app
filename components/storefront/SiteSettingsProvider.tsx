'use client';

import { createContext, useContext, type ReactNode } from 'react';
// `import type` (erased en compilación) desde un módulo server-only: no dispara el
// guard de `server-only` porque no entra al bundle cliente. Sólo viaja el TIPO.
import type { SiteSettings } from '@/lib/config/site-settings';

// Provider del STOREFRONT para la config editable del negocio. El layout server lee
// `getSiteSettings()` una vez y la inyecta acá; los componentes cliente (StoreFooter,
// checkout, suscripciones) la leen con `useSiteSettings()` — cero fetch por navegación,
// el valor persiste en el árbol cliente.
//
// Es un contexto PROPIO del storefront. El admin tiene el SUYO (commit 4): dos layouts,
// dos árboles que no se tocan, y el storefront no tiene sesión ni gate — compartir un
// provider ataría dos cosas independientes.
const Ctx = createContext<SiteSettings | null>(null);

export function SiteSettingsProvider({ value, children }: { value: SiteSettings; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Fail-loud si se usa fuera del provider — igual que el loader, no un fallback silencioso. */
export function useSiteSettings(): SiteSettings {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSiteSettings() fuera de <SiteSettingsProvider> (storefront)');
  return s;
}
