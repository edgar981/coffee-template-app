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

// ─── La identidad del STOREFRONT, declarada acá ──────────────────────────────
//
// Antes vivía en las convenciones de archivo de la raíz (`app/favicon.ico`,
// `app/icon.svg`, `app/apple-icon.png`), y ése era el bug: Next las aplica a TODA
// la app, así que el panel de Duna servía el favicon de Café Nayoli. Los archivos
// se movieron a `public/` —mismas URLs, mismos bytes— y el grupo los declara.
//
// NOTA PARA EL TEMPLATE: esto es **contenido de tenant**, no chrome del producto.
// El nombre, la descripción, el favicon y los íconos del manifest son de la
// tienda, no de Duna; van al inventario de la fase 1 (SiteSetting) el día del
// multitenant, junto con `app/manifest.ts` y el `title`/`description` de la raíz,
// que siguen siendo de Nayoli a propósito.
export const metadata: Metadata = {
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: { url: "/apple-icon.png", type: "image/png", sizes: "180x180" },
    shortcut: "/favicon.ico",
  },
};

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
  return (
    <StorefrontThemeProvider>
      <SiteSettingsProvider value={settings}>
        <SiteContentProvider value={content}>
          <CartProvider>
            {/* El wrapper del storefront: fondo y fuente de la tienda. Antes lo ponía el wrapper
                del iframe (que además leía `?preview`, ya retirado); queda el div plano con las
                MISMAS clases (`bg-[#faf7f4] font-inter`) para no cambiar el aspecto de la tienda. */}
            <div className="min-h-screen bg-[#faf7f4] font-inter">
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