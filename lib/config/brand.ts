// El INYECTOR de marca del lado de la app: arma el `Brand` que el núcleo de
// notificaciones recibe. Los campos PLANOS (nombre, tagline, remitente, replyTo) salen
// de `SiteSetting` (editable); los COLORES se DERIVAN de la paleta del storefront
// (`content.tema`, § Tanda C2) — antes eran un set de 6 hex hand-picked en `siteConfig`.
// El núcleo es agnóstico de tenant: recibe el `Brand`, nunca lo lee.
//
// Los route handlers llaman `await buildBrand()` y pasan el resultado a
// `createOrderWithCustomer`/`notifyOrderEnRoute`. El día del multitenant, esto se
// deriva del tenant de la request; el resto del seam no cambia.
//
// Lee los lectores RAW (`readSiteSettings`, `readSiteContent`), NO los cacheados
// server-only: buildBrand corre en route handlers, en el motor de automatizaciones y en
// el CARRIL —contextos donde `server-only` no resuelve—. `readSiteContent` lee lo
// PUBLICADO (jamás el borrador): un correo lleva el tema en vivo, no el que se edita.

import { readSiteSettings } from '@/lib/config/site-settings-read';
import { readSiteContent } from '@/lib/config/site-content-read';
import { coloresCorreo } from '@/lib/config/email-colors';
import type { Brand } from '@duna/core/notifications/brand';

export async function buildBrand(): Promise<Brand> {
  const [s, content] = await Promise.all([readSiteSettings(), readSiteContent()]);
  const { fondo, tinta, acento } = content.tema;
  return {
    nombre:    s.nombre,
    tagline:   s.tagline,
    colors:    coloresCorreo(fondo, tinta, acento),
    remitente: s.emailRemitente,
    replyTo:   s.emailReplyTo ?? undefined,
  };
}
