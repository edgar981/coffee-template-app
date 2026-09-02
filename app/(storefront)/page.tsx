import HeroSection from "@/components/storefront/home/HeroSection";
import TrustBadges from "@/components/storefront/home/TrustBadges";
import FeaturedProducts from "@/components/storefront/home/FeaturedProducts";
import BrandStory from "@/components/storefront/home/BrandStory";
import GrindChooser from "@/components/storefront/home/GrindChooser";
import SubscriptionCTA from "@/components/storefront/home/SubscriptionCTA";
import TestimonialSection from "@/components/storefront/home/TestimonialSection";
import { getSiteSettings } from "@/lib/config/site-settings";
// v1: Newsletter hidden — restore import when the newsletter feature ships
// import Newsletter from "@/components/storefront/home/Newsletter";

// La home lee el contenido PUBLICADO por el SiteContentProvider del layout. El borrador ya no se
// sirve acá: la vista previa del panel renderiza los componentes reales alimentados por el form
// (§ /admin/tienda), así que se retiró el gate de sesión / `?borrador` que existía para el iframe.
//
// `negocio` sale de SiteSetting (identidad) y se PASA a GrindChooser para el alt de sus imágenes —no
// lo lee el componente por hook, porque también se monta en la vista previa del panel (§ GrindChooser).
// `getSiteSettings` es React.cache, así que dedupe con la lectura del layout.
export default async function Home() {
  const { nombre } = await getSiteSettings();
  return (
    <>
      <HeroSection />
      <TrustBadges />
      <FeaturedProducts />
      <BrandStory />
      <GrindChooser negocio={nombre} />
      <SubscriptionCTA />
      <TestimonialSection />
      {/* v1: Newsletter hidden — restore when the newsletter feature ships */}
      {/* <Newsletter /> */}
    </>
  );
}
