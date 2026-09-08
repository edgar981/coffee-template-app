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
export default async function Home() {
  const [{ nombre }, content] = await Promise.all([getSiteSettings(), getSiteContent()]);
  const { esquemas, tema } = content;
  const bandaStyle = (bandaId: string) =>
    esquemaStyle(esquemas[bandaId], tema.fondo, tema.tinta, tema.acento) as React.CSSProperties;
  return (
    <>
      <HeroSection style={bandaStyle('hero')} />
      <TrustBadges style={bandaStyle('trustBadges')} />
      <FeaturedProducts style={bandaStyle('featured')} />
      <BrandStory style={bandaStyle('brandStory')} />
      <GrindChooser negocio={nombre} style={bandaStyle('presentaciones')} />
      <SubscriptionCTA style={bandaStyle('subscriptionCTA')} />
      <TestimonialSection style={bandaStyle('testimonials')} />
      {/* v1: Newsletter hidden — restore when the newsletter feature ships */}
      {/* <Newsletter style={bandaStyle('newsletter')} /> */}
    </>
  );
}
