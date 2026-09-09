"use client";

import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { REGISTRY, seccionEsVisible } from "@/lib/config/site-content-defaults";
import GrindChooserMosaico from "@/components/storefront/home/GrindChooserMosaico";
import GrindChooserIndice from "@/components/storefront/home/GrindChooserIndice";

// "¿Cómo tomas tu café?" — DISPATCHER de VARIANTES DE COMPOSICIÓN (§ eje 5e). La variante NO es
// color (eso es `content.tema`/`esquemas`) ni contenido (eso son los `campos`): es una propiedad de
// la SECCIÓN — el mismo contenido, otro esqueleto. Este componente hace el gate de visibilidad UNA
// vez y elige el esqueleto; el contenido y la lógica de qué tarjetas se muestran viven en cada
// variante (vía `tarjetasDePresentaciones`, compartida).
//
// La registry del home (`app/(storefront)/page.tsx`) sigue montando ESTE componente sin cambios —
// `presentaciones: (style) => <GrindChooser negocio={nombre} style={style} />`—; el dispatch de
// variante vive DENTRO, no en esa registry.
const VARIANTES: Record<string, typeof GrindChooserMosaico> = {
  mosaico: GrindChooserMosaico,
  indice: GrindChooserIndice,
};

export default function GrindChooser({ negocio, style }: { negocio?: string; style?: React.CSSProperties }) {
  const { presentaciones } = useSiteContent();
  if (!seccionEsVisible(REGISTRY.presentaciones, presentaciones)) return null;

  // `?? GrindChooserMosaico` es la red: una `variante` inesperada (no debería ocurrir — el resolver
  // ya la clampa al set cerrado, § `resolverVariante`) cae a la canónica en vez de no renderizar nada.
  const Layout = VARIANTES[presentaciones.variante] ?? GrindChooserMosaico;
  return <Layout negocio={negocio} style={style} />;
}
