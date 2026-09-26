"use client";

import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import HeroCurtina from "@/components/storefront/home/HeroCurtina";
import HeroFicha from "@/components/storefront/home/HeroFicha";
import HeroMedia from "@/components/storefront/home/HeroMedia";
import HeroMediaMarquesina from "@/components/storefront/home/HeroMediaMarquesina";

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
  media: HeroMedia, // § TEMAS-HERO-MEDIA-1
  // La clave es `'sticky'`, NO `'marquesina'`: ese nombre YA está reservado en el catálogo de
  // presets (`PLIEGO.variantes.hero`, themes.ts) como el placeholder de una composición de hero
  // AJENA a ésta (el diseño "Pliego" — un tema distinto de "cafeone"/CORTE, con su propio
  // catálogo de variantes pendientes de construir). Reusar ese nombre para ESTA composición
  // habría vuelto VÁLIDO por accidente un pedido de PLIEGO que `themes.test.ts` afirma que debe
  // seguir fallando por nombre — medido, no supuesto (§ MUESTRARIO-HERO-MARQUESINA-STICKY-1,
  // DECISIONS.md, el desvío del nombre de esta clave).
  sticky: HeroMediaMarquesina, // § MUESTRARIO-HERO-MARQUESINA-STICKY-1
};

export default function HeroSection({ style }: { style?: React.CSSProperties } = {}) {
  const { hero } = useSiteContent();

  // `?? HeroCurtina` es la red: una `variante` inesperada (no debería ocurrir — el resolver ya la
  // clampa al set cerrado, § `resolverVariante`) cae a la canónica en vez de no renderizar nada.
  const Layout = VARIANTES[hero.variante] ?? HeroCurtina;
  return <Layout style={style} />;
}
