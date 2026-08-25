'use client';

import { useCallback, useRef, useState } from 'react';
import HeroSection from '@/components/storefront/home/HeroSection';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { PreviewProvider } from '@/components/storefront/PreviewMode';
import { DEFAULTS, type HeroContent } from '@/lib/config/site-content-defaults';

// VISTA PREVIA EN VIVO — los componentes REALES del storefront renderizados en el panel,
// alimentados por el estado del FORM. Sin iframe: se teclea y la vista cambia en el mismo render.
//
// El provider local (`SiteContentProvider value={{ ...DEFAULTS, hero }}`) es el ÚNICO en el
// subárbol del admin, así que HeroSection lee el `hero` que le pasamos —EL FORM EN VIVO—, no el
// borrador persistido; y como el objeto es nuevo en cada render, el cambio del form re-renderiza
// la vista. `PreviewProvider` (useIsPreview=true) apaga las animaciones de entrada y la flecha:
// el contenido se ve asentado desde el primer render (nada esperando una intersección).
//
// Se renderiza a ancho DESKTOP (1280) y se escala por `paneW/1280` (RO sobre el pane, patrón del
// iframe retirado): el `92vh` del hero resuelve contra el viewport REAL del admin (~800px fijo),
// así que sale proporcional —el acoplamiento que fundía el iframe no existe acá—. El pane toma el
// alto del contenido escalado (una RO sobre el contenido), sin scroll: el hero cabe.

const DESKTOP_W = 1280;

export default function VistaTiendaEnVivo({ hero }: { hero: HeroContent }) {
  const roPane = useRef<ResizeObserver | null>(null);
  const roContenido = useRef<ResizeObserver | null>(null);
  const [paneW, setPaneW] = useState(0);
  const [contenidoH, setContenidoH] = useState(0);

  // RO sobre el PANE → ancho real → factor de escala. Ignora el aviso de ancho 0 (nodo saliendo);
  // se recalcula al colapsar el rail o redimensionar (el pane cambia de ancho).
  const paneRef = useCallback((nodo: HTMLDivElement | null) => {
    roPane.current?.disconnect(); roPane.current = null;
    if (!nodo) return;
    const ro = new ResizeObserver(es => { for (const e of es) { const w = Math.round(e.contentRect.width); if (w > 0) setPaneW(w); } });
    ro.observe(nodo); roPane.current = ro;
  }, []);

  // RO sobre el CONTENIDO (1280 de ancho, sin escalar) → su alto natural, para dimensionar el pane
  // al alto escalado. Se re-mide cuando el form cambia el alto (texto más largo).
  const contenidoRef = useCallback((nodo: HTMLDivElement | null) => {
    roContenido.current?.disconnect(); roContenido.current = null;
    if (!nodo) return;
    const ro = new ResizeObserver(es => { for (const e of es) { const h = Math.round(e.contentRect.height); if (h > 0) setContenidoH(h); } });
    ro.observe(nodo); roContenido.current = ro;
  }, []);

  const scale = paneW > 0 ? paneW / DESKTOP_W : 0;
  const contenido = { ...DEFAULTS, hero }; // objeto NUEVO por render → la vista sigue al form

  return (
    <div
      ref={paneRef}
      className="tienda-vivo-pane"
      style={scale > 0 && contenidoH > 0 ? { height: contenidoH * scale } : undefined}
    >
      {scale > 0 && (
        <div
          ref={contenidoRef}
          style={{ width: DESKTOP_W, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}
        >
          <SiteContentProvider value={contenido}>
            <PreviewProvider>
              <div className="bg-[#faf7f4] font-inter">
                <HeroSection />
              </div>
            </PreviewProvider>
          </SiteContentProvider>
        </div>
      )}
    </div>
  );
}
