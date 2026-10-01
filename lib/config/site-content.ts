import 'server-only';
import { cache } from 'react';
import { readSiteContent, readSiteContentParaEditor } from './site-content-read';
import { modoEditorActivo } from './modo-editor-gate';
import type { SiteContentData } from './site-content-defaults';

export type { SiteContentData, HeroContent } from './site-content-defaults';

// El punto ÚNICO de bifurcación publicado↔borrador (§ EDITOR-TIENDA-IFRAME-GATE-1, reescrito en
// `MODO-EDITOR-SOLO-EN-EL-IFRAME-1`): todas las páginas del storefront (home, /nosotros,
// /preguntas-frecuentes, /suscripciones, `template.tsx`, el layout) y `SiteContentProvider` llaman
// a `getSiteContent`, nunca a los lectores de `site-content-read` directo — así que cambiar QUÉ lee
// acá cambia qué ven TODAS sin tocarlas una por una. Sin la marca de modo editor (hoy un header
// por-request que `proxy.ts` pone a partir de `?editor=1`, no una cookie) o con sesión inválida,
// `modoEditorActivo()` devuelve `false` antes de tocar la base para el borrador, y el camino es
// IDÉNTICO al de siempre: `readSiteContent()` a secas.
async function resolverSegunModo(): Promise<SiteContentData> {
  if (await modoEditorActivo()) {
    const { contenido } = await readSiteContentParaEditor();
    return contenido;
  }
  return readSiteContent();
}

/**
 * El contenido del storefront PARA RENDERS (el layout/página server). Envuelve el resolver con
 * `cache()` (dedupe por request) y `server-only`. Los componentes CLIENTE lo reciben por
 * provider, no lo importan. Los no-renders usan `readSiteContent` directo (§ site-content-read).
 */
export const getSiteContent = cache(resolverSegunModo);
