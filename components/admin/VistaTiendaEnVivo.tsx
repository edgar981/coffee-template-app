'use client';

import { useCallback, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import HeroSection from '@/components/storefront/home/HeroSection';
import BrandStory from '@/components/storefront/home/BrandStory';
import SubscriptionCTA from '@/components/storefront/home/SubscriptionCTA';
import TestimonialSection from '@/components/storefront/home/TestimonialSection';
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
// DOS MODOS, mismo render (no hay segunda representación que pueda divergir — es la razón por la
// que se retiró el iframe):
//  · GRANDE (edición): ancho completo, escala `paneW/1280`, el pane toma el alto del contenido
//    escalado. Un `92vh` (el hero) resuelve contra el viewport REAL del admin (~800px fijo) → sale
//    proporcional, sin el acoplamiento que fundía el iframe.
//  · COMPACTO (la tarjeta de lectura): scale-to-FIT de la sección ENTERA en una caja fija, centrada
//    (letterbox mínimo — ambas secciones son ~16:9). NO es una franja superior: como las secciones
//    centran su contenido, una franja lideraría con el padding; el fit muestra la composición real.
//    Alto fijo + `overflow:hidden` → sin scroll interno (el que atrapaba la página en lectura).

const DESKTOP_W = 1280;

const COMPONENTES: Record<SeccionVista, ComponentType> = {
  hero: HeroSection,
  brandStory: BrandStory,
  subscriptionCTA: SubscriptionCTA,
  testimonials: TestimonialSection,
};

export default function VistaTiendaEnVivo({
  seccion,
  valor,
  compacto = false,
}: {
  seccion: SeccionVista;
  valor: unknown;
  compacto?: boolean;
}) {
  const roPane = useRef<ResizeObserver | null>(null);
  const roContenido = useRef<ResizeObserver | null>(null);
  const [paneW, setPaneW] = useState(0);
  const [paneH, setPaneH] = useState(0);
  const [contenidoH, setContenidoH] = useState(0);

  // RO sobre el PANE → su tamaño real. En COMPACTO se usan ancho Y alto (la caja la fija el CSS);
  // en GRANDE sólo el ancho (el alto lo pone el contenido). Ignora el aviso de tamaño 0 (nodo
  // saliendo); se recalcula al colapsar el rail o redimensionar.
  const paneRef = useCallback((nodo: HTMLDivElement | null) => {
    roPane.current?.disconnect(); roPane.current = null;
    if (!nodo) return;
    const ro = new ResizeObserver(es => {
      for (const e of es) {
        const w = Math.round(e.contentRect.width);
        const h = Math.round(e.contentRect.height);
        if (w > 0) setPaneW(w);
        if (h > 0) setPaneH(h);
      }
    });
    ro.observe(nodo); roPane.current = ro;
  }, []);

  // RO sobre el CONTENIDO (1280 de ancho, sin escalar) → su alto natural, para el fit compacto y
  // para dimensionar el pane grande al alto escalado. Se re-mide cuando el form cambia el alto.
  const contenidoRef = useCallback((nodo: HTMLDivElement | null) => {
    roContenido.current?.disconnect(); roContenido.current = null;
    if (!nodo) return;
    const ro = new ResizeObserver(es => { for (const e of es) { const h = Math.round(e.contentRect.height); if (h > 0) setContenidoH(h); } });
    ro.observe(nodo); roContenido.current = ro;
  }, []);

  const Comp = COMPONENTES[seccion];
  // Objeto NUEVO por render → la vista sigue al form. El caller garantiza que `valor` calza con
  // `seccion`, así que el cast es honesto (la clave es dinámica y TS no la puede estrechar).
  const contenido = { ...DEFAULTS, [seccion]: valor } as SiteContentData;

  // ESCALA. Grande: por ancho. Compacto: scale-to-fit (el menor de ancho/alto), y el contenido se
  // CENTRA en la caja con los offsets (letterbox).
  let scale = 0, left = 0, top = 0;
  if (compacto) {
    if (paneW > 0 && paneH > 0 && contenidoH > 0) {
      scale = Math.min(paneW / DESKTOP_W, paneH / contenidoH);
      left = (paneW - DESKTOP_W * scale) / 2;
      top = (paneH - contenidoH * scale) / 2;
    }
  } else {
    scale = paneW > 0 ? paneW / DESKTOP_W : 0;
  }

  const estiloPane = compacto
    ? undefined // la caja la fija el CSS (.tienda-tarjeta__mini)
    : (scale > 0 && contenidoH > 0 ? { height: contenidoH * scale } : undefined);

  return (
    <div ref={paneRef} className={compacto ? 'tienda-tarjeta__mini' : 'tienda-vivo-pane'} style={estiloPane}>
      {/* Se monta con paneW>0 (no scale>0): en compacto la escala depende de `contenidoH`, que sólo
          se mide una vez montado el contenido. El `scale(0)` de un tick es medible e invisible. */}
      {paneW > 0 && (
        <div
          ref={contenidoRef}
          style={{ width: DESKTOP_W, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', top, left }}
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
