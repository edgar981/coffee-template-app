import { headers } from "next/headers";

import HeroSection from "@/components/storefront/home/HeroSection";
import TrustBadges from "@/components/storefront/home/TrustBadges";
import FeaturedProducts from "@/components/storefront/home/FeaturedProducts";
import BrandStory from "@/components/storefront/home/BrandStory";
import GrindChooser from "@/components/storefront/home/GrindChooser";
import SubscriptionCTA from "@/components/storefront/home/SubscriptionCTA";
import TestimonialSection from "@/components/storefront/home/TestimonialSection";
// v1: Newsletter hidden — restore import when the newsletter feature ships
// import Newsletter from "@/components/storefront/home/Newsletter";

import { auth } from "@/lib/auth";
import { SiteContentProvider } from "@/components/storefront/SiteContentProvider";
import { readSiteContentBorrador } from "@/lib/config/site-content-read";
import { debeLeerBorrador } from "@/lib/config/site-content-gate";

// SERVER component (no lleva `"use client"`) porque necesita `searchParams` —que un `layout` no
// recibe— y la sesión. La señal `?borrador=1` es la única forma de leer el CONTENIDO SIN
// PUBLICAR, y sólo la sirve un admin (OWNER/MANAGER): la vista previa del panel la usa, la tienda
// pública nunca. Sin la señal, el chequeo de sesión NO corre → el tráfico público no lo paga.
//
// El gate vive acá y no en el layout porque `useSiteContent` lo consumen SÓLO las secciones de
// la home (hero, y brandStory a futuro), no el chrome (StoreNav/StoreFooter leen SiteSetting).
// Cuando corresponde borrador, se envuelven las secciones en un provider que PISA al de lo
// publicado del layout (el context más cercano gana).
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ borrador?: string }>;
}) {
  const { borrador } = await searchParams;
  const senal = borrador === "1";

  let contenidoBorrador = null;
  if (senal) {
    const session = await auth.api.getSession({ headers: await headers() });
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (debeLeerBorrador(role, senal)) {
      contenidoBorrador = await readSiteContentBorrador();
    }
  }

  const secciones = (
    <>
      <HeroSection />
      <TrustBadges />
      <FeaturedProducts />
      <BrandStory />
      <GrindChooser />
      <SubscriptionCTA />
      <TestimonialSection />
      {/* v1: Newsletter hidden — restore when the newsletter feature ships */}
      {/* <Newsletter /> */}
    </>
  );

  return contenidoBorrador ? (
    <SiteContentProvider value={contenidoBorrador}>{secciones}</SiteContentProvider>
  ) : (
    secciones
  );
}
