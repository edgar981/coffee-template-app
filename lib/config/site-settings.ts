import 'server-only';
import { cache } from 'react';
import { readSiteSettings } from './site-settings-read';

export type { SiteSettings } from './site-settings-read';

/**
 * LA fuente runtime de la config del negocio PARA RENDERS (layouts, páginas server).
 * Envuelve el lector RAW (`readSiteSettings`) con `cache()`: dedupe por request, así que
 * el server layout y una página que la lean en el mismo request hacen UNA sola query.
 *
 * Server-only: los lectores CLIENTE (páginas del admin/storefront) la reciben por
 * provider, no la importan. Los contextos que NO son renders —route handlers, el motor,
 * el carril— usan `readSiteSettings` directo (§ site-settings-read: `server-only` no
 * resuelve fuera del build de Next, y `cache()` no aplica sin request).
 */
export const getSiteSettings = cache(readSiteSettings);
