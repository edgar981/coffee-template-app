"use client";

import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import FeaturedProductsCuadricula from "@/components/storefront/home/FeaturedProductsCuadricula";
import FeaturedProductsGrilla from "@/components/storefront/home/FeaturedProductsGrilla";

// La banda de Destacados — DISPATCHER de VARIANTES DE COMPOSICIÓN (§ TEMAS-FEATURED-GRILLA-1),
// gemelo de HeroSection/GrindChooser en la FORMA (mapa de claves → componente, `?? canónica` como
// red), pero DISTINTO en la FUENTE: `featured` es una banda ESTRUCTURAL, sin sección propia en
// `SiteContentData` (§ `VARIANTES_ESTRUCTURALES`, `site-content-defaults.ts`) — así que su clave no
// vive en `content.featured.variante` (esa clave no existe: escribir ahí crearía una huérfana, §
// `mergePresetEnContent`), sino en la META key-agnóstica `content.variantesBandas.featured`.
//
// La registry del home (`app/(storefront)/page.tsx`) sigue montando ESTE componente sin cambios —
// `featured: (style) => <FeaturedProducts style={style} />`—; el dispatch de variante vive DENTRO,
// no en esa registry. `featured` no tiene gate de visibilidad propio (no es `SeccionKey`): su
// posición en `content.orden` decide si se monta, no `visible`.
const VARIANTES: Record<string, typeof FeaturedProductsCuadricula> = {
  cuadricula: FeaturedProductsCuadricula,
  grilla: FeaturedProductsGrilla,
};

export default function FeaturedProducts({ style }: { style?: React.CSSProperties } = {}) {
  const { variantesBandas } = useSiteContent();

  // `?? FeaturedProductsCuadricula` es la red: `resolverVariantesBandas` NO clampa (a diferencia de
  // `resolverVariante`) — sin override guardado la clave está AUSENTE del mapa, y una clave basura
  // tampoco sobrevive a ese resolver (§ su docstring: "ni siquiera aparece en el resultado"). Las dos
  // caen acá, en la canónica, sin lanzar.
  const Layout = VARIANTES[variantesBandas.featured] ?? FeaturedProductsCuadricula;
  return <Layout style={style} />;
}
