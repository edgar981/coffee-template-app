"use client";

import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import HeroCurtina from "@/components/storefront/home/HeroCurtina";
import HeroFicha from "@/components/storefront/home/HeroFicha";

// La Portada — DISPATCHER de VARIANTES DE COMPOSICIÓN (§ eje 5, EJE-5-VARIANTES-HERO). Segunda
// sección con `variantes` tras Presentaciones (§ eje 5e); mismo patrón: este componente sólo elige
// el esqueleto, el contenido y la lógica de cada layout viven en cada variante.
//
// La registry del home (`app/(storefront)/page.tsx`) sigue montando ESTE componente sin cambios —
// `hero: (style) => <HeroSection style={style} />`—; el dispatch de variante vive DENTRO, no en esa
// registry. Hero es `ocultable:false` (siempre renderiza; sin gate de visibilidad).
const VARIANTES: Record<string, typeof HeroCurtina> = {
  curtina: HeroCurtina,
  ficha: HeroFicha,
};

export default function HeroSection({ style }: { style?: React.CSSProperties } = {}) {
  const { hero } = useSiteContent();

  // `?? HeroCurtina` es la red: una `variante` inesperada (no debería ocurrir — el resolver ya la
  // clampa al set cerrado, § `resolverVariante`) cae a la canónica en vez de no renderizar nada.
  const Layout = VARIANTES[hero.variante] ?? HeroCurtina;
  return <Layout style={style} />;
}
