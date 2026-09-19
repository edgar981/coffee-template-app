"use client";

import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { REGISTRY, seccionEsVisible } from "@/lib/config/site-content-defaults";
import SubscriptionCTABloque from "@/components/storefront/home/SubscriptionCTABloque";
import SubscriptionCTALinea from "@/components/storefront/home/SubscriptionCTALinea";

// "Plan Suscripción" — DISPATCHER de VARIANTES DE COMPOSICIÓN (TEMAS-SUBSCRIPTIONCTA-LINEA-1, § eje
// 5e). Mismo patrón que HeroSection/GrindChooser: este componente hace el gate de visibilidad UNA
// vez y elige el esqueleto; el contenido y la lógica de cada layout viven en cada variante.
//
// La registry del home (`app/(storefront)/page.tsx`) sigue montando ESTE componente sin cambios —
// `subscriptionCTA: (style) => <SubscriptionCTA style={style} />`—; el dispatch de variante vive
// DENTRO, no en esa registry.
//
// EL FLAG DE PÁGINA MANDA sobre el toggle de sección: si la capacidad de suscripciones está apagada
// (§ paginas.suscripciones, Backlog #49), la sección se oculta AUNQUE `visible` esté en true —
// enlaza a /suscripciones, que redirige, así que un teaser encendido sería un anzuelo muerto. Con la
// capacidad ENCENDIDA, el toggle de sección decide (mostrar el teaser o no). El orden es coherente:
// la capacidad gobierna la EXISTENCIA; el toggle de sección, la PRESENTACIÓN dentro de una capacidad
// que existe. En preview (editor) NO se apaga por el flag: `paginas` viene de DEFAULTS (siempre true),
// así que el editor de la sección sigue viéndose para editarla aunque el cliente la haya apagado.
// Este gate vivía DENTRO del único componente antes de que la sección ganara variantes; ahora vive
// acá, UNA vez, para que ninguna variante tenga que repetirlo.
const VARIANTES: Record<string, typeof SubscriptionCTABloque> = {
  bloque: SubscriptionCTABloque,
  linea: SubscriptionCTALinea,
};

export default function SubscriptionCTA({ style }: { style?: React.CSSProperties } = {}) {
  const { subscriptionCTA, paginas } = useSiteContent();
  if (!paginas.suscripciones.visible) return null;
  if (!seccionEsVisible(REGISTRY.subscriptionCTA, subscriptionCTA)) return null;

  // `?? SubscriptionCTABloque` es la red: una `variante` inesperada (no debería ocurrir — el
  // resolver ya la clampa al set cerrado, § `resolverVariante`) cae a la canónica en vez de no
  // renderizar nada.
  const Layout = VARIANTES[subscriptionCTA.variante] ?? SubscriptionCTABloque;
  return <Layout style={style} />;
}
