'use client';

import type { ComponentType } from 'react';
import HeroSection from '@/components/storefront/home/HeroSection';
import BrandStory from '@/components/storefront/home/BrandStory';
import GrindChooser from '@/components/storefront/home/GrindChooser';
import SubscriptionCTA from '@/components/storefront/home/SubscriptionCTA';
import TestimonialSection from '@/components/storefront/home/TestimonialSection';
import NosotrosHistoria from '@/components/storefront/nosotros/NosotrosHistoria';
import NosotrosGaleria from '@/components/storefront/nosotros/NosotrosGaleria';
import SuscripcionPlanes from '@/components/storefront/suscripciones/SuscripcionPlanes';
import SuscripcionPasos from '@/components/storefront/suscripciones/SuscripcionPasos';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { PreviewProvider } from '@/components/storefront/PreviewMode';
import { EscalaDesktop } from '@/components/admin/EscalaDesktop';
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
// LA ESCALA (render a 1280 + transform scale) vive en `EscalaDesktop` —extraída acá porque la vista
// previa de paleta es su segundo consumidor (§ EscalaDesktop)—. Este componente ya sólo aporta lo
// ESPECÍFICO de la vista de contenido: el mapa de secciones, el provider y el `PreviewProvider`.
//
// DOS MODOS (los pasa a EscalaDesktop):
//  · GRANDE (edición): ancho completo, escala `paneW/1280`; el chrome del pane (border, bg,
//    max-height con scroll) lo da `.tienda-vivo-pane`. Un `92vh` (el hero) resuelve contra el
//    viewport REAL del admin (~800px fijo) → sale proporcional.
//  · COMPACTO (la tarjeta de lectura): scale-to-FIT de la sección ENTERA en la caja del thumb
//    (`.tienda-tarjeta__mini`, con su `> * { pointer-events: none }`), centrada (letterbox mínimo).

const COMPONENTES: Record<SeccionVista, ComponentType> = {
  hero: HeroSection,
  brandStory: BrandStory,
  // GrindChooser toma `negocio` opcional para el alt (identidad); en el preview va sin prop (el alt de
  // un preview no se usa). Todo-opcional → asignable a ComponentType, como NosotrosGaleria.
  presentaciones: GrindChooser,
  subscriptionCTA: SubscriptionCTA,
  testimonials: TestimonialSection,
  nosotrosHistoria: NosotrosHistoria,
  // La galería toma `negocio` opcional para el fallback del alt; en el preview va sin prop (el alt de
  // un preview no se usa). Todo-opcional → asignable a ComponentType.
  nosotrosGaleria: NosotrosGaleria,
  // SuscripcionPlanes toma `whatsapp` opcional para el CTA; en el preview va sin prop → el CTA se oculta
  // (un `wa.me/` sin número es un botón muerto). Todo-opcional → asignable a ComponentType.
  suscripcionPlanes: SuscripcionPlanes,
  suscripcionPasos: SuscripcionPasos,
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
  const Comp = COMPONENTES[seccion];
  // Objeto NUEVO por render → la vista sigue al form. El caller garantiza que `valor` calza con
  // `seccion`, así que el cast es honesto (la clave es dinámica y TS no la puede estrechar).
  const contenido = { ...DEFAULTS, [seccion]: valor } as SiteContentData;

  return (
    <EscalaDesktop compacto={compacto} className={compacto ? 'tienda-tarjeta__mini' : 'tienda-vivo-pane'}>
      <SiteContentProvider value={contenido}>
        <PreviewProvider>
          <div className="bg-[#faf7f4] font-inter">
            <Comp />
          </div>
        </PreviewProvider>
      </SiteContentProvider>
    </EscalaDesktop>
  );
}
