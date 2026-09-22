import { Fragment } from "react";
import HeroSection from "@/components/storefront/home/HeroSection";
import Marquesina from "@/components/storefront/home/Marquesina";
import TrustBadges from "@/components/storefront/home/TrustBadges";
import FeaturedProducts from "@/components/storefront/home/FeaturedProducts";
import BrandStory from "@/components/storefront/home/BrandStory";
import Origen from "@/components/storefront/home/Origen";
import GrindChooser from "@/components/storefront/home/GrindChooser";
import SubscriptionCTA from "@/components/storefront/home/SubscriptionCTA";
import TestimonialSection from "@/components/storefront/home/TestimonialSection";
import { getSiteSettings } from "@/lib/config/site-settings";
import { getSiteContent } from "@/lib/config/site-content";
import { esquemaStyle } from "@/lib/config/esquema-style";
import { resolverOrden, type BandaId } from "@/lib/config/site-content-defaults";
import { contenidoConPresetDeVista, cssMiradorTema } from "@/lib/config/theme-mirador";
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
// 9 bandas (7 hasta § ORIGEN-BANDA-1, que sumó `origen`; 9 hasta § MARQUESINA-BANDA-1, que sumó
// `marquesina`, 2ª tras `hero`) — antes JSX fijo, ahora un `.map` sobre `resolverOrden(orden)`
// (SIEMPRE las 9, completo por construcción). `BANDAS` es el registro bandaId→render: GrindChooser
// (id 'presentaciones') es la ÚNICA banda con un prop extra (`negocio`); las demás sólo toman
// `style`. Sin fila, `orden` resuelve al orden de HOY → mismo árbol que el JSX fijo de ayer →
// byte-idéntico. `origen`/`marquesina` NACEN `visible:false` (§ sus docstrings en `OrigenContent`/
// `MarquesinaContent`, site-content-defaults.ts), así que aunque siempre ocupen un slot en `orden`,
// Nayoli (sin fila propia) sigue sin montar un solo nodo suyo — la byte-identidad no depende de
// que la banda esté fuera de la secuencia, depende de su propio gate de visibilidad. Newsletter
// queda FUERA del registro y de `BANDA_IDS`: sigue oculta/comentada en v1, así que nunca aparece en
// `orden`.
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
// acá y no en `layout.tsx`. CONSECUENCIA (§ CORTE-REESCRITURA-PROTOTIPO-1, HALLAZGO MEDIDO): el
// `<style>` de paleta/fuentes/forma que el layout inyecta en `:root` lee SIEMPRE el content
// PUBLICADO — nunca ve el override —, así que con sólo las bandas propagadas el mirador mostraba la
// paleta en apenas 5 de 7 bandas (las que un preset le asigna esquema; el hero y testimonials, sin
// esquema, siguen cayendo al `:root` — § `esquemaStyle`) y NUNCA el par tipográfico ni la forma.
//
// EL EJE COMPLETO (§ CORTE-MIRADOR-EJES-COMPLETOS-1, `cssMiradorTema`): un SEGUNDO `<style>`/`<link>`
// con las MISMAS vars, emitido acá — reusando LOS MISMOS constructores que usa `layout.tsx`
// (`cssPaleta`/`cssFuentes`/`linkFuentePar`/`cssForma`), nunca una segunda composición —, gana por
// ORDEN DE FUENTE: lo que esta página devuelve se renderiza DESPUÉS del `<style>` del layout (es
// hijo de `<main>{children}</main>`), así que a igual especificidad (`:root`) el segundo bloque
// pisa al primero, sin tocar `layout.tsx`. `cssMiradorTema` devuelve `null` cuando
// `content === contentPublicado` (sin `?tema=`, clave inválida, preset incompleto —
// `contenidoConPresetDeVista` ya lo decidió), así que fuera del mirador activo no se emite nada de
// más: la salida sigue siendo `bandas` a secas (línea de abajo, sin tocar).
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
  // origenTexto/origenAccion (§ TEMAS-ESQUEMA-ORIGEN-PENDIENTE-1, cierra el residuo que
  // TEMAS-ROLES-DECLARADOS-POR-EL-PRESET-1 dejó nombrado): el MISMO mapeo null->undefined que ya
  // usa `cssMiradorTema` para el `:root` (§ theme-mirador.ts) -- acá para las bandas CON esquema
  // asignado, que hasta este slice derivaban sus 8 vars locales SIN el origen declarado por el
  // preset. `null` (todo tenant real, y los 5 presets del catálogo que no declaran estos ejes) se
  // convierte en `undefined`, que es lo que `derivarPaleta` entiende como "sin declarar" -> byte-
  // idéntico para quien no lo declara.
  const ejesTema = { origenTexto: tema.origenTexto ?? undefined, origenAccion: tema.origenAccion ?? undefined };
  const bandaStyle = (bandaId: string) =>
    esquemaStyle(esquemas[bandaId], tema.fondo, tema.tinta, tema.acento, ejesTema) as React.CSSProperties;
  // EL EJE COMPLETO (§ CORTE-MIRADOR-EJES-COMPLETOS-1) — ver el comentario de arriba. `null` cuando
  // no hay override (el caso de siempre): no se calcula nada de más.
  const miradorCss = cssMiradorTema(content, contentPublicado);

  const BANDAS: Record<BandaId, (style: React.CSSProperties) => React.ReactNode> = {
    hero: (style) => <HeroSection style={style} />,
    marquesina: (style) => <Marquesina style={style} />,
    trustBadges: (style) => <TrustBadges style={style} />,
    featured: (style) => <FeaturedProducts style={style} />,
    brandStory: (style) => <BrandStory style={style} />,
    origen: (style) => <Origen style={style} />,
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
  return (
    <SiteContentProvider value={content}>
      {/* EL EJE COMPLETO del mirador (§ CORTE-MIRADOR-EJES-COMPLETOS-1): sólo se renderiza cuando
          `miradorCss` no es null, es decir, cuando `content` de verdad cambió — nunca con el
          mirador inactivo. Va DENTRO de `<main>` (hijo de `bandas`' contenedor), así que en el HTML
          servido aparece DESPUÉS del `<style>` del layout y gana por orden de fuente sin subir
          especificidad. Mismo orden que usa el layout: link de fuentes, luego paleta/fuentes/forma. */}
      {miradorCss?.fuentesLink && <link rel="stylesheet" href={miradorCss.fuentesLink} />}
      {miradorCss?.paletaCss && <style dangerouslySetInnerHTML={{ __html: miradorCss.paletaCss }} />}
      {miradorCss?.fuentesCss && <style dangerouslySetInnerHTML={{ __html: miradorCss.fuentesCss }} />}
      {miradorCss?.formaCss && <style dangerouslySetInnerHTML={{ __html: miradorCss.formaCss }} />}
      {bandas}
    </SiteContentProvider>
  );
}
