import { Fragment } from "react";
import HeroSection from "@/components/storefront/home/HeroSection";
import TrustBadges from "@/components/storefront/home/TrustBadges";
import FeaturedProducts from "@/components/storefront/home/FeaturedProducts";
import BrandStory from "@/components/storefront/home/BrandStory";
import GrindChooser from "@/components/storefront/home/GrindChooser";
import SubscriptionCTA from "@/components/storefront/home/SubscriptionCTA";
import TestimonialSection from "@/components/storefront/home/TestimonialSection";
import { getSiteSettings } from "@/lib/config/site-settings";
import { getSiteContent } from "@/lib/config/site-content";
import { esquemaStyle } from "@/lib/config/esquema-style";
import { resolverOrden, type BandaId } from "@/lib/config/site-content-defaults";
import { contenidoConPresetDeVista } from "@/lib/config/theme-mirador";
import { SiteContentProvider } from "@/components/storefront/SiteContentProvider";
import { esDespliegueDemo } from "@/next.config";
// v1: Newsletter hidden — restore import when the newsletter feature ships
// import Newsletter from "@/components/storefront/home/Newsletter";

// La home lee el contenido PUBLICADO por el SiteContentProvider del layout. El borrador ya no se
// sirve acá: la vista previa del panel renderiza los componentes reales alimentados por el form
// (§ /admin/tienda), así que se retiró el gate de sesión / `?borrador` que existía para el iframe.
//
// `negocio` sale de SiteSetting (identidad) y se PASA a GrindChooser para el alt de sus imágenes —no
// lo lee el componente por hook, porque también se monta en la vista previa del panel (§ GrindChooser).
// `getSiteSettings` es React.cache, así que dedupe con la lectura del layout.
//
// EL ESQUEMA POR BANDA (§ eje 5b, mitad B) se resuelve UNA vez acá —`content.esquemas`, el mapa
// bandaId→esquema— y se pasa como `style` a la <section> raíz de cada componente (§ doctrina, el
// wrapper vive en el elemento raíz de la banda, sin <div> nuevo). Banda AUSENTE del mapa →
// `esquemaStyle` devuelve `{}` → la clase de la banda cae a su fallback `var(--sf-banda,<token de
// hoy>)` → byte-idéntico. `getSiteContent` es React.cache, así que dedupe con la lectura del layout.
//
// EL ORDEN (§ eje 5, parte c) se resuelve en `content.orden` y decide en qué SECUENCIA se montan las
// 7 bandas — antes JSX fijo, ahora un `.map` sobre `resolverOrden(orden)` (SIEMPRE las 7, completo por
// construcción). `BANDAS` es el registro bandaId→render: GrindChooser (id 'presentaciones') es la
// ÚNICA banda con un prop extra (`negocio`); las demás sólo toman `style`. Sin fila, `orden` resuelve
// al orden de HOY → mismo árbol que el JSX fijo de ayer → byte-idéntico. Newsletter queda FUERA del
// registro y de `BANDA_IDS`: sigue oculta/comentada en v1, así que nunca aparece en `orden`.
//
// EL MIRADOR DE `?tema=CLAVE` (§ TEMAS-MIRADOR-PRESET-1). `aplicarPreset` (`site-content-write.ts`)
// PERSISTE un preset y no tiene llamador — no hay forma de MIRAR una variante nueva sin mover al
// tenant que corre en la misma base que el despliegue de desarrollo comparte. Esta rama NUNCA
// ESCRIBE: `contenidoConPresetDeVista` superpone el preset EN MEMORIA, sólo para esta respuesta, y
// se ignora sin rastro si la clave no existe o el preset está incompleto (`validarPreset` decide, no
// un criterio propio acá). Sólo corre fuera de producción real (`esDespliegueDemo()`, la MISMA
// fuente que ya gobierna el noindex y las llaves de Wompi en `next.config.ts`) — en producción el
// parámetro se ignora por completo, ni se lee.
//
// `searchParams` sólo existe en `page.tsx` (un Layout NO lo recibe, por diseño de Next — evita que
// un layout compartido se vuelva dependiente de un query de una ruta hija), así que el mirador vive
// acá y no en `layout.tsx`: el `<style>` de paleta/fuentes/forma que el layout inyecta en `:root`
// sigue leyendo el content PUBLICADO tal cual, sin el override. Lo que SÍ cambia con el mirador son
// las bandas de esta página (via el `SiteContentProvider` anidado de abajo, que sombrea al del
// layout para este subárbol) — es lo que hace falta para VER las tres composiciones nuevas.
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [{ nombre }, contentPublicado] = await Promise.all([getSiteSettings(), getSiteContent()]);
  const { tema: temaPedido } = await searchParams;
  const content = esDespliegueDemo()
    ? contenidoConPresetDeVista(contentPublicado, Array.isArray(temaPedido) ? temaPedido[0] : temaPedido)
    : contentPublicado;
  const { esquemas, tema, orden } = content;
  const bandaStyle = (bandaId: string) =>
    esquemaStyle(esquemas[bandaId], tema.fondo, tema.tinta, tema.acento) as React.CSSProperties;

  const BANDAS: Record<BandaId, (style: React.CSSProperties) => React.ReactNode> = {
    hero: (style) => <HeroSection style={style} />,
    trustBadges: (style) => <TrustBadges style={style} content={content.trustBadges} />,
    featured: (style) => <FeaturedProducts style={style} />,
    brandStory: (style) => <BrandStory style={style} />,
    presentaciones: (style) => <GrindChooser negocio={nombre} style={style} />,
    subscriptionCTA: (style) => <SubscriptionCTA style={style} />,
    testimonials: (style) => <TestimonialSection style={style} />,
  };

  const bandas = (
    <>
      {resolverOrden(orden).map((id) => (
        <Fragment key={id}>{BANDAS[id](bandaStyle(id))}</Fragment>
      ))}
      {/* v1: Newsletter hidden — restore when the newsletter feature ships */}
      {/* <Newsletter style={bandaStyle('newsletter')} /> */}
    </>
  );

  // Sin mirador (el caso de SIEMPRE, incluida toda producción real): ni un Provider de más — el
  // árbol queda BYTE-IDÉNTICO al de antes de este slice. `SiteContentProvider` no emite HTML propio
  // (es un Context.Provider), así que anidarlo sólo cuando hay override es una precaución, no una
  // necesidad de paridad visual — pero es la que deja el camino común sin tocar ni un nodo de más.
  if (content === contentPublicado) return bandas;
  return <SiteContentProvider value={content}>{bandas}</SiteContentProvider>;
}
