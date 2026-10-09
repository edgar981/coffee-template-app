"use client";

import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import HeroCurtina from "@/components/storefront/home/HeroCurtina";
import HeroFicha from "@/components/storefront/home/HeroFicha";
import HeroMedia from "@/components/storefront/home/HeroMedia";
import HeroMediaMarquesina from "@/components/storefront/home/HeroMediaMarquesina";
import HeroGrano from "@/components/storefront/home/HeroGrano";
import HeroCereza from "@/components/storefront/home/HeroCereza";
import HeroPaisaje from "@/components/storefront/home/HeroPaisaje";
import { paresFuenteReferenciados } from "@/lib/config/estilo-elemento";
import { urlGoogle, parDeFuentePar } from "@/lib/config/fuentes";

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
  // § MOVIMIENTO-NIVEL-FIRMA-1 — las TRES composiciones de FIRMA del catálogo de movimiento
  // (H01/H02/H03, `lib/movimiento/catalogo.ts`): cada una pinea la sección y anima con GSAP
  // (`components/storefront/movimiento/animaciones.ts`), gateado por los mismos tres gates de
  // siempre (editor/preview/reduced-motion, § `useMovimiento.ts`) — ninguna tienda cambia de hero
  // hasta que alguien elija una de estas tres claves.
  grano: HeroGrano,
  cereza: HeroCereza,
  paisaje: HeroPaisaje,
};

export default function HeroSection({ style }: { style?: React.CSSProperties } = {}) {
  const { hero } = useSiteContent();

  // `?? HeroCurtina` es la red: una `variante` inesperada (no debería ocurrir — el resolver ya la
  // clampa al set cerrado, § `resolverVariante`) cae a la canónica en vez de no renderizar nada.
  const Layout = VARIANTES[hero.variante] ?? HeroCurtina;

  // LOS <link> DE FUENTE REFERENCIADA (§ EDITOR-TIENDA-BARRA-FLOTANTE-1): un elemento de texto del
  // hero puede pedir, por su cuenta, un par de la colección curada DISTINTO del par activo del tema
  // (`content.tema.fuentePar`) — y ESE par no viaja en el `<link>` que el layout ya inyecta para el
  // tema (sólo carga las dos familias del par activo). Sin esto, la fuente elegida no tendría
  // archivo que descargar y el navegador caería a su fallback genérico — "la letra elegida se carga
  // en la tienda pública… sin esperar a publicar" (§ REDISENO.md § 5) exige que ESTE componente,
  // montado para TODO visitante (Hero es `ocultable:false`), la pida.
  //
  // Mismo patrón EXACTO que `app/(storefront)/layout.tsx` ya usa para el par activo
  // (`<link rel="stylesheet" href={fuentesLink} />`, renderizado directo en JSX — React/Next lo
  // HOISTEA a `<head>`, en servidor y cliente, sin useEffect): acá se repite por cada par
  // REFERENCIADO, no uno fijo. `paresFuenteReferenciados` ya deduplica; un par que resulte ser el
  // mismo que el activo simplemente repite una URL que el navegador ya dedupe por `href`.
  const paresReferenciados = paresFuenteReferenciados(hero.estilos ?? {});

  return (
    <>
      {paresReferenciados.map((clave) => (
        <link key={clave} rel="stylesheet" href={urlGoogle(parDeFuentePar(clave))} />
      ))}
      <Layout style={style} />
    </>
  );
}
