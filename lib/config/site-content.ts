import 'server-only';
import { cache } from 'react';
import { readSiteContent } from './site-content-read';

export type { SiteContentData, HeroContent } from './site-content-defaults';

/**
 * El contenido del storefront PARA RENDERS (el layout/página server). Envuelve el lector RAW
 * con `cache()` (dedupe por request) y `server-only`. Los componentes CLIENTE lo reciben por
 * provider, no lo importan. Los no-renders usan `readSiteContent` directo (§ site-content-read).
 */
export const getSiteContent = cache(readSiteContent);
