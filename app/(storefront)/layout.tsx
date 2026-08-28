import type { Metadata } from "next";
import type { ReactNode } from "react";

import StoreNav from "@/components/storefront/layout/StoreNav";
import StoreFooter from "@/components/storefront/StoreFooter";
import CartDrawer from "@/components/storefront/CartDrawer";
import { CartProvider } from "@/lib/cartStore";
import { StorefrontThemeProvider } from "@/components/theme/StorefrontThemeProvider";
import { SiteSettingsProvider } from "@/components/storefront/SiteSettingsProvider";
import { getSiteSettings } from "@/lib/config/site-settings";
import { SiteContentProvider } from "@/components/storefront/SiteContentProvider";
import { getSiteContent } from "@/lib/config/site-content";
import { cssPaleta } from "@/lib/config/palette-style";

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
// Los ICONOS son assets por archivo PER-CLIENTE (favicon, PWA, apple): hoy los de Nayoli,
// un segundo cliente los REEMPLAZA por-despliegue. Su cache-safety la da una regla
// `headers()` en `next.config.ts` (Cache-Control corto sobre /favicon.ico y hermanos) — la
// MISMA URL que usa el probe ciego, así que no hay puerta de atrás; no una ruta /api/favicon.
// El color del tema y el mark del `Logo` (wordmark-first) salen de SiteSetting en el commit 4.
export async function generateMetadata(): Promise<Metadata> {
  const { nombre, descripcionFooter } = await getSiteSettings();
  return {
    // `absolute` (NO `default`) + `template`: un `title.default` de segmento hijo SIGUE
    // pasando por el `template` de la RAÍZ (`%s · Café Nayoli`) → la home salía duplicada
    // "Café Nayoli · Café Nayoli". `absolute` ignora el template heredado, igual que hizo el
    // admin con "Panel Duna" (§ Identidad — la trampa ya estaba documentada). Así: la home →
    // "{nombre}"; una hija con `title: "X"` (p.ej. /nosotros) → "X · {nombre}".
    title: { absolute: nombre, template: `%s · ${nombre}` },
    description: descripcionFooter,
    icons: {
      icon: [
        { url: "/icon.svg", type: "image/svg+xml" },
        { url: "/favicon.ico", sizes: "any" },
      ],
      apple: { url: "/apple-icon.png", type: "image/png", sizes: "180x180" },
      shortcut: "/favicon.ico",
    },
  };
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
  // globals.css por orden de fuente). Nayoli tiene las raíces en null → `null` → sin <style>
  // → defaults de código → byte-idéntico. (§ palette-style.)
  const paletaCss = cssPaleta(settings.paletaFondo, settings.paletaTinta, settings.paletaAcento);
  return (
    <StorefrontThemeProvider>
      {paletaCss && <style dangerouslySetInnerHTML={{ __html: paletaCss }} />}
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
            </div>
          </CartProvider>
        </SiteContentProvider>
      </SiteSettingsProvider>
    </StorefrontThemeProvider>
  );
}