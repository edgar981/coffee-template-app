import { Fragment } from "react";
import HeroSection from "@/components/storefront/home/HeroSection";
import TrustBadges from "@/components/storefront/home/TrustBadges";
import FeaturedProducts from "@/components/storefront/home/FeaturedProducts";
import BrandStory from "@/components/storefront/home/BrandStory";
import GrindChooser from "@/components/storefront/home/GrindChooser";
import SubscriptionCTA from "@/components/storefront/home/SubscriptionCTA";
import TestimonialSection from "@/components/storefront/home/TestimonialSection";
import { getSiteSettings } from "@/lib/config/site-settings";
import { getSiteContent } from "@/lib/config/site-content";
import { esquemaStyle } from "@/lib/config/esquema-style";
import { resolverOrden, type BandaId } from "@/lib/config/site-content-defaults";
// v1: Newsletter hidden — restore import when the newsletter feature ships
// import Newsletter from "@/components/storefront/home/Newsletter";

// La home lee el contenido PUBLICADO por el SiteContentProvider del layout. El borrador ya no se
// sirve acá: la vista previa del panel renderiza los componentes reales alimentados por el form
// (§ /admin/tienda), así que se retiró el gate de sesión / `?borrador` que existía para el iframe.
//
// `negocio` sale de SiteSetting (identidad) y se PASA a GrindChooser para el alt de sus imágenes —no
// lo lee el componente por hook, porque también se monta en la vista previa del panel (§ GrindChooser).
// `getSiteSettings` es React.cache, así que dedupe con la lectura del layout.
//
// EL ESQUEMA POR BANDA (§ eje 5b, mitad B) se resuelve UNA vez acá —`content.esquemas`, el mapa
// bandaId→esquema— y se pasa como `style` a la <section> raíz de cada componente (§ doctrina, el
// wrapper vive en el elemento raíz de la banda, sin <div> nuevo). Banda AUSENTE del mapa →
// `esquemaStyle` devuelve `{}` → la clase de la banda cae a su fallback `var(--sf-banda,<token de
// hoy>)` → byte-idéntico. `getSiteContent` es React.cache, así que dedupe con la lectura del layout.
//
// EL ORDEN (§ eje 5, parte c) se resuelve en `content.orden` y decide en qué SECUENCIA se montan las
// 7 bandas — antes JSX fijo, ahora un `.map` sobre `resolverOrden(orden)` (SIEMPRE las 7, completo por
// construcción). `BANDAS` es el registro bandaId→render: GrindChooser (id 'presentaciones') es la
// ÚNICA banda con un prop extra (`negocio`); las demás sólo toman `style`. Sin fila, `orden` resuelve
// al orden de HOY → mismo árbol que el JSX fijo de ayer → byte-idéntico. Newsletter queda FUERA del
// registro y de `BANDA_IDS`: sigue oculta/comentada en v1, así que nunca aparece en `orden`.
export default async function Home() {
  const [{ nombre }, content] = await Promise.all([getSiteSettings(), getSiteContent()]);
  const { esquemas, tema, orden } = content;
  const bandaStyle = (bandaId: string) =>
    esquemaStyle(esquemas[bandaId], tema.fondo, tema.tinta, tema.acento) as React.CSSProperties;

  const BANDAS: Record<BandaId, (style: React.CSSProperties) => React.ReactNode> = {
    hero: (style) => <HeroSection style={style} />,
    trustBadges: (style) => <TrustBadges style={style} />,
    featured: (style) => <FeaturedProducts style={style} />,
    brandStory: (style) => <BrandStory style={style} />,
    presentaciones: (style) => <GrindChooser negocio={nombre} style={style} />,
    subscriptionCTA: (style) => <SubscriptionCTA style={style} />,
    testimonials: (style) => <TestimonialSection style={style} />,
  };

  return (
    <>
      {resolverOrden(orden).map((id) => (
        <Fragment key={id}>{BANDAS[id](bandaStyle(id))}</Fragment>
      ))}
      {/* v1: Newsletter hidden — restore when the newsletter feature ships */}
      {/* <Newsletter style={bandaStyle('newsletter')} /> */}
    </>
  );
}
