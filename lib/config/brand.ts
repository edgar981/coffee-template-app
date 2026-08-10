// El INYECTOR de marca del lado de la app: conoce el tenant actual (Nayoli, vía
// `siteConfig`) y arma el `Brand` que el núcleo de notificaciones recibe. Vive en
// la app a propósito — `siteConfig` es contenido de tenant y no entra a core.
//
// Los route handlers llaman `buildBrand()` y pasan el resultado a
// `createOrderWithCustomer`/`notifyOrderEnRoute`. El día del multitenant, esto se
// deriva del tenant de la request; el resto del seam no cambia.

import { siteConfig } from '@/lib/config/site';
import type { Brand } from '@duna/core/notifications/brand';

export function buildBrand(): Brand {
  return {
    nombre:    siteConfig.tienda.nombre,
    tagline:   siteConfig.brand.tagline,
    colors:    siteConfig.tienda.emailColors,
    remitente: siteConfig.tienda.emailRemitente,
    replyTo:   siteConfig.tienda.emailReplyTo,
  };
}
