import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import StoreNav from "@/components/storefront/layout/StoreNav";
import StoreFooter from "@/components/storefront/StoreFooter";
import CartDrawer from "@/components/storefront/CartDrawer";
import BackToTop from "@/components/storefront/BackToTop";
import RielSocial from "@/components/storefront/RielSocial";
import ScrollInercia from "@/components/storefront/ScrollInercia";
import ToasterTienda from "@/components/storefront/ToasterTienda";
import { CartProvider } from "@/lib/cartStore";
import { StorefrontThemeProvider } from "@/components/theme/StorefrontThemeProvider";
import { SiteSettingsProvider } from "@/components/storefront/SiteSettingsProvider";
import { getSiteSettings } from "@/lib/config/site-settings";
import { SiteContentProvider } from "@/components/storefront/SiteContentProvider";
import { getSiteContent } from "@/lib/config/site-content";
import { cssPaleta } from "@/lib/config/palette-style";
import { cssFuentes } from "@/lib/config/fuentes-style";
import { linkFuentePar } from "@/lib/config/fuentes";
import { cssForma } from "@/lib/config/forma-style";
import { coloresPWA } from "@/lib/config/pwa-colores";
import { ReducedMotionProvider } from "@/lib/animation";
import { modoEditorActivo, metadataRobotsSegunModo } from "@/lib/config/modo-editor-gate";
import { openGraphDeTienda } from "@/lib/config/og-tienda";
import { corteAplicado } from "@/lib/config/themes";
import { tituloYDescripcionDeTienda, iconosDeTienda } from "@/lib/config/metadata-tienda";

// El storefront se renderiza DINÁMICO (por request), no estático. Su layout lee la
// identidad del negocio (SiteSetting) y el contenido de la home (SiteContent) de la BASE, y
// esos datos son EDITABLES desde el panel. Prerenderizado estático, Next hornea los valores
// del BUILD y editar el nombre del negocio o el hero NO se vería hasta un rebuild —medido:
// `/` salía `○` y servía el default aunque la fila cambiara—. `force-dynamic` hace que cada
// request re-lea (dos queries de una fila, baratas). El detalle de producto ya era dinámico.
//
// La ALTERNATIVA (ISR: mantener estático + `revalidatePath` en cada escritura de settings/
// content) se descartó para v1: más superficie que equivocar por un ahorro que una tienda de
// este tamaño no necesita. Si el tráfico crece, ése es el momento de volver a estático + ISR.
export const dynamic = 'force-dynamic';

// ─── La identidad del STOREFRONT, dinámica desde SiteSetting ──────────────────
//
// El TÍTULO y la DESCRIPCIÓN de la pestaña salen de SiteSetting (editables desde el
// panel). El storefront es `force-dynamic`, así que `generateMetadata` re-corre por
// request: cambiar el nombre del negocio se ve en el siguiente load, sin rebuild ni
// caché rancio (el `<title>` viaja en el HTML, no es un binario cacheado como el favicon).
// Esto SOBREESCRIBE el `title.default`/`template` de la raíz (que es de Nayoli) para todo
// el subárbol del storefront; la raíz queda como fallback muerto (siempre se sobreescribe).
//
// Los ICONOS eran SÓLO assets por archivo PER-CLIENTE (favicon, PWA, apple) hasta § METADATA-ICONOS-
// Y-LANG-POR-TIENDA-1: hoy, SI la tienda subió su propio ícono de pestaña (`content.logo.icono`), ÉSE
// gana; si no, caen a los estáticos de Nayoli (§ `lib/config/metadata-tienda.ts`,
// `iconosDeTienda`/`ICONOS_ESTATICOS_POR_DEFECTO`) — los mismos de siempre, por-despliegue. La
// cache-safety de los estáticos la sigue dando la regla `headers()` en `next.config.ts` (Cache-
// Control corto sobre /favicon.ico y hermanos); un ícono SUBIDO es una URL de Blob
// content-hasheada (§ Storage, CLAUDE.md — "el nombre lo hace único el proveedor"), así que no
// necesita esa regla: reemplazarlo cambia la URL, no el contenido de una ya cacheada.
//
// LÍMITE CONOCIDO, no resuelto en este slice: un navegador que haga el PROBE CIEGO a la URL literal
// `/favicon.ico` (ignorando el `<link rel="icon">`, § el comentario de `next.config.ts`) seguiría
// viendo el estático de Nayoli aunque la tienda haya subido su propio ícono — el `<link>` SÍ apunta
// al ícono subido, pero `/favicon.ico` en sí no se reescribe. Cerrarlo del todo exige la indirección
// que `next.config.ts` ya anticipaba ("la ruta se gana su lugar sólo cuando el favicon se vuelva
// SUBIBLE") — una ruta propia + rewrite, fuera de `touches:` de este slice.
// El color del tema y el mark del `Logo` (wordmark-first) salen de SiteSetting en el commit 4.
export async function generateMetadata(): Promise<Metadata> {
  const [{ nombre, descripcionFooter }, enModoEditor, content] = await Promise.all([
    getSiteSettings(),
    modoEditorActivo(),
    getSiteContent(),
  ]);
  return {
    // `tituloYDescripcionDeTienda` (§ `lib/config/metadata-tienda.ts`) es `absolute`+`template`: un
    // `title.default` de segmento hijo SIGUE pasando por el `template` de la RAÍZ (`%s · Café
    // Nayoli`) → la home salía duplicada "Café Nayoli · Café Nayoli". `absolute` ignora el template
    // heredado, igual que hizo el admin con "Panel Duna" (§ Identidad — la trampa ya estaba
    // documentada). Así: la home → "{nombre}"; una hija con `title: "X"` (p.ej. /nosotros) → "X ·
    // {nombre}". `app/not-found.tsx` (§ METADATA-ICONOS-Y-LANG-POR-TIENDA-1) usa la MISMA función.
    ...tituloYDescripcionDeTienda(nombre, descripcionFooter),
    // EL `noindex` POR REQUEST del modo editor (§ EDITOR-TIENDA-IFRAME-GATE-1), vía la función
    // pura `metadataRobotsSegunModo` (afirmada en capa 1, `lib/config/modo-editor-gate.test.ts`).
    // Ver el docstring de esa función para el porqué del `no-store` (ya cubierto, nada que agregar
    // acá) y § 9.2 de `docs/editor-tienda/DISENO.md`.
    ...metadataRobotsSegunModo(enModoEditor),
    // La vista previa al compartir (§ OG-IMAGEN-TIENDA-1, `lib/config/og-tienda.ts`): sólo bajo CORTE.
    ...openGraphDeTienda({
      esCorte: corteAplicado(content.tema.origenAccion),
      nombre,
      descripcion: descripcionFooter,
      imagenPoster: content.hero.imagenPoster,
      imagen: content.hero.imagen,
    }),
    // El manifest PWA del cliente. Se declara acá (por grupo) desde que se retiró la convención
    // `app/manifest.ts` —que auto-inyectaba su link en TODA la app y ganaba sobre `metadata.manifest`,
    // así que el panel no podía tener el suyo (§ el route handler /api/manifest, § Identidad)—.
    manifest: "/api/manifest",
    // LOS ÍCONOS: `iconosDeTienda` (§ arriba) resuelve el subido o los estáticos de Nayoli —el punto
    // de swap de siempre (§ #1) sigue siendo la salida sin ícono propio—. El COLOR de chrome/PWA sí
    // se deriva de la paleta (§ generateViewport abajo + /api/manifest).
    icons: iconosDeTienda(content.logo.icono),
  };
}

// El `theme-color` del navegador (la barra de direcciones) DERIVA de la paleta del cliente (§ #1):
// `content.tema.fondo`, o el literal de Nayoli cuando es fábrica (byte-idéntico, § coloresPWA). Sobre­
// escribe el `themeColor` de la RAÍZ (Nayoli) para el subárbol del storefront —igual que el admin
// sobreescribe el suyo (§ Identidad)—; la raíz queda como fallback para lo que no está en un grupo.
// `getSiteContent` está cacheado por request (React.cache), así que no agrega una query sobre el layout.
export async function generateViewport(): Promise<Viewport> {
  const content = await getSiteContent();
  const { chrome } = coloresPWA(content.tema.fondo, content.tema.tinta);
  return { themeColor: chrome };
}

interface StorefrontLayoutProps {
  children: ReactNode;
}

export default async function StorefrontLayout({
  children,
}: StorefrontLayoutProps) {
  // Identidad del negocio (settings) y CONTENIDO de la home (content), leídos UNA vez en el
  // layout server (React.cache dedupe por request) e inyectados a sus providers. Son
  // INDEPENDIENTES entre sí, así que van en un Promise.all — no en cadena.
  const [settings, content] = await Promise.all([getSiteSettings(), getSiteContent()]);
  // La PALETA del cliente, derivada de sus 3 raíces e inyectada como `:root{--sf-*}` en un
  // <style> SERVER-RENDERED (sin flash — va en el primer paint; gana a los defaults de
  // globals.css por orden de fuente). Las raíces salen de `content.tema` (lo PUBLICADO), no de
  // SiteSetting: la paleta se mudó a SiteContent para ganar el flujo borrador/publicar (§ doctrina:
  // la frontera borrador/no-borrador es de PANTALLA). Sin fila / raíces en null → `null` → sin
  // <style> → defaults de código → byte-idéntico. (§ palette-style, resolverTema.)
  //
  // origenTexto/origenAccion (§ CROMO-EJES-PALETA-AL-RENDER-1): el MISMO mapeo null→undefined que
  // ya usan `theme-mirador.ts` (`cssMiradorTema`) y `page.tsx` (`ejesTema`) para el `:root` del
  // mirador y las bandas con esquema asignado — hasta este slice, el `:root` PERSISTIDO (este, el
  // que sirve a todo visitante sin `?tema=`) los ignoraba: nacía siempre con `--sf-accion` del
  // tostado y los tres roles de texto de lectura del acento, sin importar lo que el preset hubiera
  // declarado. `null` (todo tenant real, y los presets que no declaran estos ejes) se convierte en
  // `undefined` → byte-idéntico a la llamada de 3 argumentos de siempre.
  const paletaCss = cssPaleta(content.tema.fondo, content.tema.tinta, content.tema.acento, {
    origenTexto: content.tema.origenTexto ?? undefined,
    origenAccion: content.tema.origenAccion ?? undefined,
  });
  // El PAR TIPOGRÁFICO del cliente (§ Tanda C2 · #3, gemelo de la paleta): cssFuentes es el `:root{
  // --sf-fuente-*}` (null para Editorial → las clases caen a Inter/Playfair del `@import`), y el
  // `<link>` descarga las 2 familias del par CUSTOM (Editorial no lleva link: lo cubre el `@import`).
  // Así, por despliegue se descargan 2 familias. Sin flash: ambos van en el HTML del server (dynamic).
  const fuentesCss = cssFuentes(content.tema.fuentePar);
  const fuentesLink = linkFuentePar(content.tema.fuentePar);
  // La PERSONALIDAD DE FORMA del cliente (§ eje 4, gemelo de la paleta y las fuentes): cssForma es el
  // `:root{--radius-3xl/2xl/xl: … + tokens propios}` que overridea los radios de las tarjetas (y emite
  // los tokens de la segunda mitad, inertes hoy). Suave/null → `null` → sin <style> → los radios de hoy
  // (Tailwind v4) → byte-idéntico. Sin flash: va en el HTML del server (dynamic). Sólo el storefront lo
  // recibe (documento aparte del admin), así que el `:root` no alcanza al panel (§ forma-style).
  const formaCss = cssForma(content.tema.forma);
  return (
    // ReducedMotionProvider (STOREFRONT-REDUCED-MOTION-1) envuelve TODO el árbol:
    // hace que cualquier animación de framer-motion del storefront —hoy y la que se
    // agregue después— respete `prefers-reduced-motion` sin que su componente tenga
    // que declarar un guard propio. Ver `lib/animation.ts` para el mecanismo y sus límites.
    <ReducedMotionProvider>
      <StorefrontThemeProvider>
        {fuentesLink && <link rel="stylesheet" href={fuentesLink} />}
        {paletaCss && <style dangerouslySetInnerHTML={{ __html: paletaCss }} />}
        {fuentesCss && <style dangerouslySetInnerHTML={{ __html: fuentesCss }} />}
        {formaCss && <style dangerouslySetInnerHTML={{ __html: formaCss }} />}
        <SiteSettingsProvider value={settings}>
          <SiteContentProvider value={content}>
            <CartProvider>
              {/* El wrapper del storefront: fondo y fuente de la tienda. Antes lo ponía el wrapper
                  del iframe (que además leía `?preview`, ya retirado); queda el div plano con las
                  MISMAS clases (`bg-[var(--sf-fondo)] font-inter`) para no cambiar el aspecto de la tienda. */}
              <div className="min-h-screen bg-[var(--sf-fondo)] font-inter">
                <StoreNav />
                <main>{children}</main>
                <StoreFooter />
                <CartDrawer />
                {/* BackToTop (§ CROMO-VOLVER-ARRIBA-1): montado SIEMPRE, como sus hermanos de arriba
                    — decide su propio silencio adentro por `content.volverArriba.visible`
                    (AUSENTE/false → `null`, byte-idéntico). */}
                <BackToTop />
                {/* RielSocial (§ CROMO-RIEL-SOCIAL-1): MISMO mecanismo que BackToTop, montado SIEMPRE
                    — decide su propio silencio adentro por `content.rielSocial.visible` (AUSENTE/false
                    → `null`, byte-idéntico) y por si `SiteSetting.instagram`/`.whatsapp` están vacíos. */}
                <RielSocial />
                {/* ScrollInercia (§ SCROLL-INERCIA-CORTE-1): MISMO mecanismo que BackToTop/RielSocial,
                    montado SIEMPRE — decide su propio silencio adentro por
                    `corteAplicado(tema.origenAccion)` (AUSENTE/null → no-op, byte-idéntico). Sin
                    render propio (`return null` siempre): sólo adjunta/retira listeners de `window`. */}
                <ScrollInercia />
                {/* ToasterTienda (§ TOAST-COMO-PROTOTIPO-1): MISMO mecanismo que BackToTop/RielSocial/
                    ScrollInercia, montado SIEMPRE — decide su propio estilo adentro por
                    `corteAplicado(content.tema.origenAccion)`. Es el ÚNICO Toaster de la tienda: el
                    genérico de `app/layout.tsx` se apaga fuera de admin/pre-auth para dejarle el paso. */}
                <ToasterTienda />
              </div>
            </CartProvider>
          </SiteContentProvider>
        </SiteSettingsProvider>
      </StorefrontThemeProvider>
    </ReducedMotionProvider>
  );
}
