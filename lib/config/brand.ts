// El INYECTOR de marca del lado de la app: arma el `Brand` que el núcleo de
// notificaciones recibe. Los campos PLANOS (nombre, tagline, remitente, replyTo) salen
// de `SiteSetting` (editable); `emailColors` es ESTRUCTURADO y sigue en `siteConfig`
// (código) en v1. El núcleo es agnóstico de tenant: recibe el `Brand`, nunca lo lee.
//
// Los route handlers llaman `await buildBrand()` y pasan el resultado a
// `createOrderWithCustomer`/`notifyOrderEnRoute`. El día del multitenant, esto se
// deriva del tenant de la request; el resto del seam no cambia.
//
// Lee `readSiteSettings` (el lector RAW), NO `getSiteSettings` (server-only): buildBrand
// corre en route handlers, en el motor de automatizaciones y en el CARRIL —contextos
// donde `server-only` no resuelve—.

import { siteConfig } from '@/lib/config/site';
import { readSiteSettings } from '@/lib/config/site-settings-read';
import type { Brand } from '@duna/core/notifications/brand';

export async function buildBrand(): Promise<Brand> {
  const s = await readSiteSettings();
  return {
    nombre:    s.nombre,
    tagline:   s.tagline,
    colors:    siteConfig.tienda.emailColors,
    remitente: s.emailRemitente,
    replyTo:   s.emailReplyTo ?? undefined,
  };
}
