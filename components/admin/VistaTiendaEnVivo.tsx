'use client';

import type { ComponentType } from 'react';
import HeroSection from '@/components/storefront/home/HeroSection';
import Marquesina from '@/components/storefront/home/Marquesina';
import TrustBadges from '@/components/storefront/home/TrustBadges';
import BrandStory from '@/components/storefront/home/BrandStory';
import Origen from '@/components/storefront/home/Origen';
import GrindChooser from '@/components/storefront/home/GrindChooser';
import SubscriptionCTA from '@/components/storefront/home/SubscriptionCTA';
import TestimonialSection from '@/components/storefront/home/TestimonialSection';
import Spotlight from '@/components/storefront/home/Spotlight';
import NosotrosHistoria from '@/components/storefront/nosotros/NosotrosHistoria';
import NosotrosGaleria from '@/components/storefront/nosotros/NosotrosGaleria';
import SuscripcionPlanes from '@/components/storefront/suscripciones/SuscripcionPlanes';
import SuscripcionPasos from '@/components/storefront/suscripciones/SuscripcionPasos';
import PreguntasFrecuentes from '@/components/storefront/PreguntasFrecuentes';
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
  // NECESARIO POR CONSECUENCIA MECÁNICA de PANEL-EDITOR-MARQUESINA-1 (mismo patrón que 'origen'/
  // 'spotlight' abajo, § sus asientos en DECISIONS.md): sumar `'marquesina'` a `SeccionVista`
  // (tienda-secciones.ts) para que la sección "Marquesina" pueda entrar a `SECCIONES_TIENDA` vuelve
  // este `Record<SeccionVista, ComponentType>` NO-exhaustivo sin esta línea — `tsc` lo rechaza, y sin
  // ella en runtime `COMPONENTES['marquesina']` sería `undefined` y `<Comp />` reventaría el editor
  // al abrir "Marquesina". `Marquesina` toma sólo `style` opcional (con default `{}`) → asignable a
  // `ComponentType`, mismo patrón que `Spotlight`/`Origen`. Con `marquesina.visible` en `false` (el
  // default; la banda nace OFF) el componente devuelve `null` — la vista previa queda en blanco, no
  // rota (§ el docstring de `MARQUESINA` en tienda-secciones.ts, mismo caso que `SPOTLIGHT`).
  marquesina: Marquesina,
  // NECESARIO POR CONSECUENCIA MECÁNICA de PANEL-EDITOR-TRUSTBADGES-VISIBLE-1 (mismo patrón que
  // 'marquesina'/'origen'/'spotlight' arriba): sumar `'trustBadges'` a `SeccionVista` (tienda-
  // secciones.ts) para que la sección "Confianza" pueda entrar a `SECCIONES_TIENDA` vuelve este
  // `Record<SeccionVista, ComponentType>` NO-exhaustivo sin esta línea — `tsc` lo rechaza, y sin ella
  // en runtime `COMPONENTES['trustBadges']` sería `undefined` y `<Comp />` reventaría el editor al
  // abrir "Confianza". `TrustBadges` toma sólo `style` opcional (con default `{}`) → asignable a
  // `ComponentType`, mismo patrón que `Spotlight`/`Origen`. Con `trustBadges.visible` en `true` (el
  // default; la banda ya se monta hoy sin condición) la vista previa muestra las cuatro insignias
  // desde el primer render.
  trustBadges: TrustBadges,
  brandStory: BrandStory,
  // NECESARIO POR CONSECUENCIA MECÁNICA de PANEL-EDITOR-ORIGEN-1 (mismo patrón que 'spotlight' arriba,
  // § el asiento de PANEL-EDITOR-SPOTLIGHT-PIN-1): sumar `'origen'` a `SeccionVista` para que ORIGEN
  // pueda entrar a `SECCIONES_TIENDA` vuelve este `Record<SeccionVista, ComponentType>`
  // NO-exhaustivo sin esta línea. Origen toma sólo `style` opcional (con default `{}`, igual que
  // Spotlight) → asignable a `ComponentType`.
  origen: Origen,
  // GrindChooser toma `negocio` opcional para el alt (identidad); en el preview va sin prop (el alt de
  // un preview no se usa). Todo-opcional → asignable a ComponentType, como NosotrosGaleria.
  presentaciones: GrindChooser,
  subscriptionCTA: SubscriptionCTA,
  testimonials: TestimonialSection,
  // NECESARIO POR CONSECUENCIA MECÁNICA de PANEL-EDITOR-SPOTLIGHT-PIN-1 (fuera de su `touches:`
  // declarado, § el asiento de ese slice en DECISIONS.md): agregar `'spotlight'` a `SeccionVista`
  // (tienda-secciones.ts) para que la sección "Destacado" pueda entrar a `SECCIONES_TIENDA` vuelve
  // este `Record<SeccionVista, ComponentType>` NO-exhaustivo sin esta línea — `tsc` lo rechaza, y sin
  // ella en runtime `COMPONENTES['spotlight']` sería `undefined` y `<Comp />` reventaría el editor al
  // abrir "Destacado". Spotlight toma sólo `style` opcional (con default `{}`) → asignable a
  // `ComponentType`, mismo patrón que `NosotrosGaleria`/`SuscripcionPlanes` arriba. Con
  // `spotlight.visible` en `false` (el default; este slice no expone el toggle) el componente
  // devuelve `null` — la vista previa queda en blanco, no rota (§ el docstring de `SPOTLIGHT` en
  // tienda-secciones.ts).
  spotlight: Spotlight,
  nosotrosHistoria: NosotrosHistoria,
  // La galería toma `negocio` opcional para el fallback del alt; en el preview va sin prop (el alt de
  // un preview no se usa). Todo-opcional → asignable a ComponentType.
  nosotrosGaleria: NosotrosGaleria,
  // SuscripcionPlanes toma `whatsapp` opcional para el CTA; en el preview va sin prop → el CTA se oculta
  // (un `wa.me/` sin número es un botón muerto). Todo-opcional → asignable a ComponentType.
  suscripcionPlanes: SuscripcionPlanes,
  suscripcionPasos: SuscripcionPasos,
  // PreguntasFrecuentes sólo lee `useSiteContent()` (§ SUSCRIPCIONES-FAQ-EDITOR-1, verificado leyendo
  // la cadena entera: sin `useSiteSettings` ni otro hook con provider propio) — cubierto por el
  // `SiteContentProvider` de acá abajo, sin prop adicional.
  suscripcionFaq: PreguntasFrecuentes,
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
