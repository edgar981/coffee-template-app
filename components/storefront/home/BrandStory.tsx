"use client";

import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { REGISTRY, seccionEsVisible } from "@/lib/config/site-content-defaults";
import BrandStoryColumnas from "@/components/storefront/home/BrandStoryColumnas";
import BrandStoryCentrada from "@/components/storefront/home/BrandStoryCentrada";

// "Nuestra Historia" — DISPATCHER de VARIANTES DE COMPOSICIÓN (§ eje 5e, CORTE-BRANDSTORY-COLLAGE-1).
// Hasta este slice `brandStory.variantes.claves` tenía UNA sola clave —la canónica—, así que este
// componente ERA el layout entero; ahora que gana una segunda ("centrada"), sigue el mismo patrón
// que ya usan `HeroSection`/`GrindChooser`/`SubscriptionCTA`: hace el gate de visibilidad UNA vez y
// elige el esqueleto — el contenido y la lógica de cada layout viven en cada variante.
//
// PRIMERA sección OCULTABLE (§ doctrina original): si `visible=false`, no se renderiza (self-gate,
// ahora acá en vez de en el layout único de antes). La home la rinde como hermano plano (sin
// envoltorio ni separador), así que devolver null no deja hueco.
//
// La registry del home (`app/(storefront)/page.tsx`) sigue montando ESTE componente sin cambios —
// `brandStory: (style) => <BrandStory style={style} />`—; el dispatch de variante vive DENTRO, no en
// esa registry.
const VARIANTES: Record<string, typeof BrandStoryColumnas> = {
  columnas: BrandStoryColumnas,
  centrada: BrandStoryCentrada,
};

export default function BrandStory({ style }: { style?: React.CSSProperties } = {}) {
  const { brandStory } = useSiteContent();
  if (!seccionEsVisible(REGISTRY.brandStory, brandStory)) return null;

  // `?? BrandStoryColumnas` es la red: una `variante` inesperada (no debería ocurrir — el resolver
  // ya la clampa al set cerrado, § `resolverVariante`) cae a la canónica en vez de no renderizar nada.
  const Layout = VARIANTES[brandStory.variante] ?? BrandStoryColumnas;
  return <Layout style={style} />;
}
