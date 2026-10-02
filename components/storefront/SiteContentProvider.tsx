'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
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

// EL SETTER, SEGUNDO CONTEXT (§ EDITOR-TIENDA-POSTMESSAGE-1) — SÓLO para `EditorPuenteVivo.tsx`,
// que aplica el borrador en vivo del panel sin recargar el documento. `null` fuera del provider;
// `EditorPuenteVivo` decide su propio silencio con eso (§ su docstring) — ningún OTRO componente
// del storefront debe tocar este setter, así que no se exporta un nombre más genérico que invite a
// usarlo para otra cosa.
const SetterCtx = createContext<((actualizar: (prev: SiteContentData) => SiteContentData) => void) | null>(null);

export function SiteContentProvider({ value, children }: { value: SiteContentData; children: ReactNode }) {
  // El ESTADO INTERNO nace del `value` del servidor y es lo que `useSiteContent()` lee — pero deja
  // de ser la ÚNICA fuente de la verdad: `EditorPuenteVivo` puede adelantarlo entre una recarga y la
  // siguiente (§ su docstring). Si `value` cambia (una navegación real del servidor — nunca un
  // postMessage, que nunca toca esta prop), el estado interno se RE-SINCRONIZA: el servidor manda.
  const [actual, setActual] = useState(value);
  useEffect(() => { setActual(value); }, [value]);

  return (
    <Ctx.Provider value={actual}>
      <SetterCtx.Provider value={setActual}>{children}</SetterCtx.Provider>
    </Ctx.Provider>
  );
}

/** Fail-loud si se usa fuera del provider — eso es un bug de montaje, no el "vacío
 *  legítimo" del contenido (que el loader ya resolvió a defaults). */
export function useSiteContent(): SiteContentData {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSiteContent() fuera de <SiteContentProvider> (storefront)');
  return c;
}

/** SÓLO para `EditorPuenteVivo.tsx` (§ EDITOR-TIENDA-POSTMESSAGE-1): aplica una actualización
 *  funcional sobre el contenido en vivo. `null` fuera del provider. */
export function useSiteContentActualizador() {
  return useContext(SetterCtx);
}
