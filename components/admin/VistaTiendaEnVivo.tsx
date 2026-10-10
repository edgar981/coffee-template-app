'use client';

import type { ComponentType, CSSProperties } from 'react';
import HeroSection from '@/components/storefront/home/HeroSection';
import Marquesina from '@/components/storefront/home/Marquesina';
import TrustBadges from '@/components/storefront/home/TrustBadges';
import BrandStory from '@/components/storefront/home/BrandStory';
import Origen from '@/components/storefront/home/Origen';
import GrindChooser from '@/components/storefront/home/GrindChooser';
import SubscriptionCTA from '@/components/storefront/home/SubscriptionCTA';
import TestimonialSection from '@/components/storefront/home/TestimonialSection';
import Spotlight from '@/components/storefront/home/Spotlight';
import NosotrosHistoria from '@/components/storefront/nosotros/NosotrosHistoria';
import NosotrosGaleria from '@/components/storefront/nosotros/NosotrosGaleria';
import NosotrosCierre from '@/components/storefront/nosotros/NosotrosCierre';
import SuscripcionPlanes from '@/components/storefront/suscripciones/SuscripcionPlanes';
import SuscripcionPasos from '@/components/storefront/suscripciones/SuscripcionPasos';
import PreguntasFrecuentes from '@/components/storefront/PreguntasFrecuentes';
import TiendaEncabezado from '@/components/storefront/tienda/TiendaEncabezado';
import TiendaCatalogo from '@/components/storefront/tienda/TiendaCatalogo';
import TiendaInterludio from '@/components/storefront/tienda/TiendaInterludio';
import TiendaCierre from '@/components/storefront/tienda/TiendaCierre';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { PreviewProvider } from '@/components/storefront/PreviewMode';
import { CartProvider } from '@/lib/cartStore';
import { EscalaDesktop } from '@/components/admin/EscalaDesktop';
import { DEFAULTS, type SiteContentData, type BandaId, type EsquemasContent, type TemaContent } from '@/lib/config/site-content-defaults';
import { varsDeTienda } from '@/lib/config/esquema-style';
import type { SeccionVista } from '@/components/admin/tienda-secciones';

// VISTA PREVIA EN VIVO — los componentes REALES del storefront renderizados en el panel,
// alimentados por el estado del FORM. Sin iframe: se teclea y la vista cambia en el mismo render.
//
// GENÉRICA por sección: `seccion` elige qué componente del storefront renderizar (hero →
// HeroSection, brandStory → BrandStory) y `valor` es el form de ESA sección. El provider local
// (`SiteContentProvider value={{ ...DEFAULTS, [seccion]: valor }}`) es el ÚNICO en el subárbol del
// admin, así que el componente lee el valor que le pasamos —EL FORM EN VIVO—, no el borrador
// persistido; y como el objeto es nuevo en cada render, el cambio del form re-renderiza la vista.
// `PreviewProvider` (useIsPreview=true) apaga las animaciones de entrada y la flecha: el contenido
// se ve asentado desde el primer render (nada esperando una intersección — la razón por la que
// BrandStory cambia `whileInView`→`animate` en preview).
//
// LA ESCALA (render a 1280 + transform scale) vive en `EscalaDesktop` —extraída acá porque la vista
// previa de paleta es su segundo consumidor (§ EscalaDesktop)—. Este componente ya sólo aporta lo
// ESPECÍFICO de la vista de contenido: el mapa de secciones, los providers (`SiteContentProvider`,
// `PreviewProvider`, `CartProvider` — § el docstring de `VistaTiendaContenido`, abajo, que explica
// por qué `CartProvider` es necesario y por qué cubre a `Comp` incondicionalmente) y el `style` de la
// banda.
//
// TODAS LAS VARS DE LA TIENDA, NO SÓLO LAS 8 DE BANDA (§ PANEL-PREVIEW-COLORES-REALES-1) — el
// defecto que esto cierra: hasta este slice `<Comp />` sólo recibía las 8 vars de
// `esquemaStyleDeBanda` (§ HISTORIA-COMO-MUESTRARIO-1, abajo), y TODO lo demás que un componente lee
// —`--sf-fondo`/`-tinta`/`-acento`, la familia `texto`/`tostado`/`accion`, el par tipográfico, los
// radios de forma— caía SIEMPRE al literal de FÁBRICA de `app/globals.css` (la paleta de Nayoli),
// sea cual sea el tema REAL del tenant: el "casi todos los preview pintan colores que no
// corresponden" que el owner reportó. `varsDeTienda` (§ esquema-style.ts) compone las CUATRO capas
// —paleta completa CON sus ejes, fuente, forma, y (si hay `bandaId`) el esquema de esa banda— en un
// solo objeto, la MISMA fuente que consume `PaletaSeccion.tsx`; se aplica en el WRAPPER (no sólo en
// `<Comp>`) para que el FONDO del propio wrapper (antes `#faf7f4` a fuego, el literal de Nayoli)
// también refleje el tema real. `bandaId`/`esquemas`/`tema` son OPCIONALES —ausentes (o `undefined`,
// el default de cada uno) hacen que `varsDeTienda` derive de `DEFAULTS.tema`/`.esquemas` (fábrica,
// sin `bandaId`) → los MISMOS valores que ya viven en `globals.css` → BYTE-IDÉNTICO a antes para
// Nayoli. Quien los fetchea es `TiendaSeccionEditor` (§ su docstring, el porqué de un promise
// COMPARTIDO en vez de un fetch por instancia); este componente sigue sin tocar red, sólo DERIVA las
// vars de lo que recibe — es lo que lo mantiene testeable por SSR sin jsdom (§
// admin-tienda-preset.test.ts).
//
// EL ESQUEMA DE LA BANDA (§ HISTORIA-COMO-MUESTRARIO-1) — la parte de `varsDeTienda` que ya existía
// antes de este slice, como `esquemaStyleDeBanda` suelto: hasta ese slice `<Comp />` se montaba SIN
// `style`, así que una banda con esquema asignado (p. ej. `brandStory` bajo CORTE, 'neutro') caía
// SIEMPRE a su fallback de clase (`var(--sf-banda,var(--sf-tinta))` → `--sf-tinta`). Sigue siendo la
// MISMA pieza, ahora una de las cuatro que `varsDeTienda` combina.
//
// DOS MODOS (los pasa a EscalaDesktop):
//  · GRANDE (edición): ancho completo, escala `paneW/1280`; el chrome del pane (border, bg,
//    max-height con scroll) lo da `.tienda-vivo-pane`. Un `92vh` (el hero) resuelve contra el
//    viewport REAL del admin (~800px fijo) → sale proporcional.
//  · COMPACTO (la tarjeta de lectura): scale-to-FIT de la sección ENTERA en la caja del thumb
//    (`.tienda-tarjeta__mini`, con su `> * { pointer-events: none }`), centrada (letterbox mínimo).

// `style` opcional en la firma: los OCHO de home (§ app/(storefront)/page.tsx, que ya se lo pasan a
// todos) lo leen; las seis de /nosotros y /suscripciones lo ignoran (todos sus props son igual de
// opcionales, así que un `style` extra que no leen es un no-op en RUNTIME). PERO tipar el Record como
// `ComponentType<{style?}>` a secas NO compila para `NosotrosGaleria`/`SuscripcionPlanes`: TS marca
// como error DOS tipos con propiedades TODAS opcionales y CERO en común (`{style?}` vs `{negocio?}` /
// `{whatsapp?}`) — la detección de "weak type" (probable typo), que NO se dispara con un tipo que
// tiene índice (`Record<string, unknown>` no es "weak"). De ahí el tipo del VALOR: sigue exigiendo
// que cada entrada sea invocable con cualquier prop-bag (todo-opcional en cada componente real, como
// ya documentaba el `ComponentType` bare de antes), sin la falsa alarma de TS sobre las dos que no
// comparten NINGÚN nombre de prop con `style`.
const COMPONENTES: Record<SeccionVista, ComponentType<Record<string, unknown>>> = {
  hero: HeroSection,
  // NECESARIO POR CONSECUENCIA MECÁNICA de PANEL-EDITOR-MARQUESINA-1 (mismo patrón que 'origen'/
  // 'spotlight' abajo, § sus asientos en DECISIONS.md): sumar `'marquesina'` a `SeccionVista`
  // (tienda-secciones.ts) para que la sección "Marquesina" pueda entrar a `SECCIONES_TIENDA` vuelve
  // este `Record<SeccionVista, ComponentType>` NO-exhaustivo sin esta línea — `tsc` lo rechaza, y sin
  // ella en runtime `COMPONENTES['marquesina']` sería `undefined` y `<Comp />` reventaría el editor
  // al abrir "Marquesina". `Marquesina` toma sólo `style` opcional (con default `{}`) → asignable a
  // `ComponentType`, mismo patrón que `Spotlight`/`Origen`. Con `marquesina.visible` en `false` (el
  // default; la banda nace OFF) el componente devuelve `null` — la vista previa queda en blanco, no
  // rota (§ el docstring de `MARQUESINA` en tienda-secciones.ts, mismo caso que `SPOTLIGHT`).
  marquesina: Marquesina,
  // NECESARIO POR CONSECUENCIA MECÁNICA de PANEL-EDITOR-TRUSTBADGES-VISIBLE-1 (mismo patrón que
  // 'marquesina'/'origen'/'spotlight' arriba): sumar `'trustBadges'` a `SeccionVista` (tienda-
  // secciones.ts) para que la sección "Confianza" pueda entrar a `SECCIONES_TIENDA` vuelve este
  // `Record<SeccionVista, ComponentType>` NO-exhaustivo sin esta línea — `tsc` lo rechaza, y sin ella
  // en runtime `COMPONENTES['trustBadges']` sería `undefined` y `<Comp />` reventaría el editor al
  // abrir "Confianza". `TrustBadges` toma sólo `style` opcional (con default `{}`) → asignable a
  // `ComponentType`, mismo patrón que `Spotlight`/`Origen`. Con `trustBadges.visible` en `true` (el
  // default; la banda ya se monta hoy sin condición) la vista previa muestra las cuatro insignias
  // desde el primer render.
  trustBadges: TrustBadges,
  brandStory: BrandStory,
  // NECESARIO POR CONSECUENCIA MECÁNICA de PANEL-EDITOR-ORIGEN-1 (mismo patrón que 'spotlight' arriba,
  // § el asiento de PANEL-EDITOR-SPOTLIGHT-PIN-1): sumar `'origen'` a `SeccionVista` para que ORIGEN
  // pueda entrar a `SECCIONES_TIENDA` vuelve este `Record<SeccionVista, ComponentType>`
  // NO-exhaustivo sin esta línea. Origen toma sólo `style` opcional (con default `{}`, igual que
  // Spotlight) → asignable a `ComponentType`.
  origen: Origen,
  // GrindChooser toma `negocio` opcional para el alt (identidad); en el preview va sin prop (el alt de
  // un preview no se usa). Todo-opcional → asignable a ComponentType, como NosotrosGaleria.
  presentaciones: GrindChooser,
  subscriptionCTA: SubscriptionCTA,
  testimonials: TestimonialSection,
  // NECESARIO POR CONSECUENCIA MECÁNICA de PANEL-EDITOR-SPOTLIGHT-PIN-1 (fuera de su `touches:`
  // declarado, § el asiento de ese slice en DECISIONS.md): agregar `'spotlight'` a `SeccionVista`
  // (tienda-secciones.ts) para que la sección "Destacado" pueda entrar a `SECCIONES_TIENDA` vuelve
  // este `Record<SeccionVista, ComponentType>` NO-exhaustivo sin esta línea — `tsc` lo rechaza, y sin
  // ella en runtime `COMPONENTES['spotlight']` sería `undefined` y `<Comp />` reventaría el editor al
  // abrir "Destacado". Spotlight toma sólo `style` opcional (con default `{}`) → asignable a
  // `ComponentType`, mismo patrón que `NosotrosGaleria`/`SuscripcionPlanes` arriba. Con
  // `spotlight.visible` en `false` (el default; este slice no expone el toggle) el componente
  // devuelve `null` — la vista previa queda en blanco, no rota (§ el docstring de `SPOTLIGHT` en
  // tienda-secciones.ts).
  spotlight: Spotlight,
  // NECESARIO POR CONSECUENCIA MECÁNICA de § TIENDA-PAGINA-REGISTRO-1 (mismo patrón que 'marquesina'/
  // 'origen'/'spotlight' arriba): sumar `'tiendaEncabezado'`/`'tiendaCatalogo'` a `SeccionVista`
  // (tienda-secciones.ts) para que /tienda entre al editor vuelve este
  // `Record<SeccionVista, ComponentType>` NO-exhaustivo sin estas dos líneas — `tsc` lo rechaza, y
  // sin ellas en runtime `COMPONENTES['tiendaEncabezado']`/`['tiendaCatalogo']` serían `undefined` y
  // `<Comp />` reventaría el editor al abrir "Tienda". Los dos componentes son HEADLESS y no toman
  // props (como `NosotrosHistoria`/`SuscripcionPasos`) → asignables a `ComponentType`.
  tiendaEncabezado: TiendaEncabezado,
  tiendaCatalogo: TiendaCatalogo,
  // NECESARIO POR CONSECUENCIA MECÁNICA de § TIENDA-CHAMISAS-ALBUM-1 (mismo patrón que
  // 'tiendaEncabezado'/'tiendaCatalogo' arriba): sumar 'tiendaInterludio'/'tiendaCierre' a
  // `SeccionVista` vuelve este `Record<SeccionVista, ComponentType>` NO-exhaustivo sin estas dos
  // líneas. `TiendaCierre` toma `whatsapp` opcional para su CTA; en el preview va sin prop → el
  // botón se oculta (un `wa.me/` sin número es un botón muerto, mismo criterio que
  // `SuscripcionPlanes`). Todo-opcional en los dos → asignables a `ComponentType`.
  tiendaInterludio: TiendaInterludio,
  tiendaCierre: TiendaCierre,
  nosotrosHistoria: NosotrosHistoria,
  // La galería toma `negocio` opcional para el fallback del alt; en el preview va sin prop (el alt de
  // un preview no se usa). Todo-opcional → asignable a ComponentType.
  nosotrosGaleria: NosotrosGaleria,
  // NECESARIO POR CONSECUENCIA MECÁNICA de § NOSOTROS-COMPOSICION-1 (mismo patrón que 'origen'/
  // 'spotlight' arriba): sumar `'nosotrosCierre'` a `SeccionVista` (tienda-secciones.ts) para que la
  // banda "CTA de cierre" pueda entrar a `SECCIONES_TIENDA` vuelve este
  // `Record<SeccionVista, ComponentType>` NO-exhaustivo sin esta línea — `tsc` lo rechaza. `NosotrosCierre`
  // toma sólo `style` opcional (con default `{}`) → asignable a `ComponentType`, mismo patrón que
  // `Spotlight`/`Origen`. Con `nosotrosCierre.titulo` vacío (el default; nace hide-on-empty) el
  // componente devuelve `null` — la vista previa queda en blanco, no rota.
  nosotrosCierre: NosotrosCierre,
  // SuscripcionPlanes toma `whatsapp` opcional para el CTA; en el preview va sin prop → el CTA se oculta
  // (un `wa.me/` sin número es un botón muerto). Todo-opcional → asignable a ComponentType.
  suscripcionPlanes: SuscripcionPlanes,
  suscripcionPasos: SuscripcionPasos,
  // PreguntasFrecuentes sólo lee `useSiteContent()` (§ SUSCRIPCIONES-FAQ-EDITOR-1, verificado leyendo
  // la cadena entera: sin `useSiteSettings` ni otro hook con provider propio) — cubierto por el
  // `SiteContentProvider` de acá abajo, sin prop adicional.
  suscripcionFaq: PreguntasFrecuentes,
};

export interface VistaTiendaProps {
  seccion: SeccionVista;
  valor: unknown;
  /** La banda del home de esta sección (§ SeccionConfig.bandaId) — para pintar con SU esquema real.
   *  Ausente = sin esquema (el `{}` de siempre). */
  bandaId?: BandaId;
  /** `content.esquemas` REAL del tenant (§ el docstring de arriba). Ausente = `DEFAULTS.esquemas`. */
  esquemas?: EsquemasContent;
  /** `content.tema` REAL del tenant. Ausente = `DEFAULTS.tema` (fábrica) — el comportamiento de
   *  SIEMPRE. Se mezcla también en `contenido` (no sólo en el `style` de la banda): un componente que
   *  lea `useSiteContent().tema` directo (p. ej. `escalaDisplay`, § BrandStoryCentrada) debe ver la
   *  MISMA fuente que decide el esquema, no la fábrica en un lado y lo real en el otro. */
  tema?: TemaContent;
}

/** EL ÁRBOL INTERNO — providers + `<Comp>`, SIN `EscalaDesktop` (§ ADMIN-TIENDA-CARTPROVIDER-
 *  PREVIEW-1). Extraído para que el carril pueda ejercer la composición REAL de providers —incluido
 *  `CartProvider`, abajo— por RENDER DIRECTO, sin reimplementarla: `EscalaDesktop` sólo monta sus
 *  `children` tras medir con un `ResizeObserver` (`paneW > 0`), que en SSR (`renderToStaticMarkup`,
 *  sin un DOM real) nunca dispara — así que un test que renderice `VistaTiendaEnVivo` a secas ve un
 *  `<div>` vacío y NUNCA llega a montar `Comp` ni sus providers (medido: `admin-tienda-preset.
 *  test.ts` lo verifica explícitamente). `VistaTiendaContenido` es la mitad SSR-segura; el
 *  default-export de abajo la envuelve en `EscalaDesktop` para el uso real del panel.
 *
 *  `CartProvider` LOCAL e INERTE (mismo mecanismo que `ProductCard` ya usa en `FragmentoTienda`/
 *  PaletaSeccion.tsx desde el incidente de `/admin/configuracion` de 2026-08-28, § CLAUDE.md
 *  "Montar un componente en OTRO árbol de providers"). Cubre a `Comp` INCONDICIONALMENTE — no sólo a
 *  `spotlight`, la sección de hoy que dispara el crash (`Spotlight.tsx` llama `useCartStore()` sin
 *  condición, al tope del componente, ANTES de cualquier early-return de visibilidad/catálogo) —
 *  porque cualquier `SeccionVista` futura que agregue un control de compra hereda el mismo landmine
 *  sin que nadie tenga que volver a tocar este archivo. Un click en "Agregar al carrito" dentro de
 *  la vista previa sólo muta ESTE estado desechable: no hay un carrito real del dueño en el árbol
 *  del admin. */
export function VistaTiendaContenido({ seccion, valor, bandaId, esquemas, tema }: VistaTiendaProps) {
  const Comp = COMPONENTES[seccion];
  const temaReal = tema ?? DEFAULTS.tema;
  const esquemasReales = esquemas ?? DEFAULTS.esquemas;
  // TODAS las vars de la tienda para ESTE tema —paleta completa con sus ejes, fuente, forma y (si
  // `bandaId`) el esquema de la banda— en el WRAPPER: cascada por CSS a `<Comp>` y todos sus
  // descendientes, como el `:root` del layout real cascada a toda la página. `<Comp>` recibe el MISMO
  // objeto por `style` además (no sólo por herencia): así su propio nodo raíz lleva las vars, igual
  // que `esquemaStyleDeBanda` ya se las ponía antes de este slice (§ el docstring de arriba).
  const vars = varsDeTienda(temaReal, esquemasReales, bandaId) as CSSProperties;
  // Objeto NUEVO por render → la vista sigue al form. El caller garantiza que `valor` calza con
  // `seccion`, así que el cast es honesto (la clave es dinámica y TS no la puede estrechar).
  const contenido = { ...DEFAULTS, tema: temaReal, esquemas: esquemasReales, [seccion]: valor } as SiteContentData;

  return (
    <SiteContentProvider value={contenido}>
      <PreviewProvider>
        <CartProvider>
          <div className="font-inter" style={{ ...vars, background: 'var(--sf-fondo)' }}>
            <Comp style={vars} />
          </div>
        </CartProvider>
      </PreviewProvider>
    </SiteContentProvider>
  );
}

export default function VistaTiendaEnVivo({
  seccion,
  valor,
  compacto = false,
  bandaId,
  esquemas,
  tema,
}: VistaTiendaProps & { compacto?: boolean }) {
  return (
    <EscalaDesktop compacto={compacto} className={compacto ? 'tienda-tarjeta__mini' : 'tienda-vivo-pane'}>
      <VistaTiendaContenido seccion={seccion} valor={valor} bandaId={bandaId} esquemas={esquemas} tema={tema} />
    </EscalaDesktop>
  );
}
