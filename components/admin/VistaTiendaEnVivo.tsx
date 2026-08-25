'use client';

import { useCallback, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import HeroSection from '@/components/storefront/home/HeroSection';
import BrandStory from '@/components/storefront/home/BrandStory';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { PreviewProvider } from '@/components/storefront/PreviewMode';
import { DEFAULTS, type SiteContentData } from '@/lib/config/site-content-defaults';
import type { SeccionVista } from '@/components/admin/tienda-secciones';

// VISTA PREVIA EN VIVO — los componentes REALES del storefront renderizados en el panel,
// alimentados por el estado del FORM. Sin iframe: se teclea y la vista cambia en el mismo render.
//
// GENÉRICA por sección: `seccion` elige qué componente del storefront renderizar (hero →
// HeroSection, brandStory → BrandStory) y `valor` es el form de ESA sección. El provider local
// (`SiteContentProvider value={{ ...DEFAULTS, [seccion]: valor }}`) es el ÚNICO en el subárbol del
// admin, así que el componente lee el valor que le pasamos —EL FORM EN VIVO—, no el borrador
// persistido; y como el objeto es nuevo en cada render, el cambio del form re-renderiza la vista.
// `PreviewProvider` (useIsPreview=true) apaga las animaciones de entrada y la flecha: el contenido
// se ve asentado desde el primer render (nada esperando una intersección — la razón por la que
// BrandStory cambia `whileInView`→`animate` en preview).
//
// Se renderiza a ancho DESKTOP (1280) y se escala por `paneW/1280` (RO sobre el pane): un `92vh`
// (el hero) resuelve contra el viewport REAL del admin (~800px fijo), así que sale proporcional
// —el acoplamiento que fundía el iframe no existe acá—. El pane toma el alto del contenido
// escalado (una RO sobre el contenido), sin scroll.

const DESKTOP_W = 1280;

const COMPONENTES: Record<SeccionVista, ComponentType> = {
  hero: HeroSection,
  brandStory: BrandStory,
};

export default function VistaTiendaEnVivo({ seccion, valor }: { seccion: SeccionVista; valor: unknown }) {
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
  // al alto escalado. Se re-mide cuando el form cambia el alto (texto más largo, sección oculta).
  const contenidoRef = useCallback((nodo: HTMLDivElement | null) => {
    roContenido.current?.disconnect(); roContenido.current = null;
    if (!nodo) return;
    const ro = new ResizeObserver(es => { for (const e of es) { const h = Math.round(e.contentRect.height); if (h > 0) setContenidoH(h); } });
    ro.observe(nodo); roContenido.current = ro;
  }, []);

  const scale = paneW > 0 ? paneW / DESKTOP_W : 0;
  const Comp = COMPONENTES[seccion];
  // Objeto NUEVO por render → la vista sigue al form. El caller garantiza que `valor` calza con
  // `seccion`, así que el cast es honesto (la clave es dinámica y TS no la puede estrechar).
  const contenido = { ...DEFAULTS, [seccion]: valor } as SiteContentData;

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
                <Comp />
              </div>
            </PreviewProvider>
          </SiteContentProvider>
        </div>
      )}
    </div>
  );
}
