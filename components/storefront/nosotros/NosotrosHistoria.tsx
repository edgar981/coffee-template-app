"use client";

import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import NosotrosHistoriaRelato from "@/components/storefront/nosotros/NosotrosHistoriaRelato";
import NosotrosHistoriaSinopsis from "@/components/storefront/nosotros/NosotrosHistoriaSinopsis";
import NosotrosHistoriaPartida from "@/components/storefront/nosotros/NosotrosHistoriaPartida";

// "La historia larga" de /nosotros — DISPATCHER de VARIANTES DE COMPOSICIÓN (§ ONIX-NOSOTROS-
// APERTURA-SINOPSIS-1, sobre REGISTRY.nosotrosHistoria.variantes). Hasta este slice este componente
// ERA el layout entero («Relato», hoy extraído VERBATIM a `NosotrosHistoriaRelato.tsx`); ahora que
// la sección gana una segunda composición («Sinopsis partida»), sigue el MISMO patrón que
// `BrandStory.tsx`/`TiendaInterludio.tsx`: elige el esqueleto — el contenido y la lógica de cada
// composición viven en su propio componente.
//
// SIN gate de visibilidad acá: `nosotrosHistoria.ocultable:false` (el ocultar es a nivel de PÁGINA,
// no de esta sección) — a diferencia de `BrandStory`, que SÍ hace el gate antes de despachar.
const VARIANTES: Record<string, typeof NosotrosHistoriaRelato> = {
  relato: NosotrosHistoriaRelato,
  sinopsis: NosotrosHistoriaSinopsis,
  // «partida» (§ CHAMISAS-NOSOTROS-ALBUM-1): frase grande + dos párrafos, filete punteado.
  partida: NosotrosHistoriaPartida,
};

export default function NosotrosHistoria() {
  const { nosotrosHistoria } = useSiteContent();
  // `?? NosotrosHistoriaRelato` es la red: una `variante` inesperada (no debería ocurrir — el
  // resolver ya la clampa al set cerrado, § `resolverVariante`) cae a la canónica en vez de no
  // renderizar nada.
  const Layout = VARIANTES[nosotrosHistoria.variante] ?? NosotrosHistoriaRelato;
  return <Layout />;
}
