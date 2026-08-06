import type { Metadata } from "next";
import type { ReactNode } from "react";

import StoreNav from "@/components/storefront/layout/StoreNav";
import StoreFooter from "@/components/storefront/StoreFooter";
import CartDrawer from "@/components/storefront/CartDrawer";
import { CartProvider } from "@/lib/cartStore";
import { StorefrontThemeProvider } from "@/components/theme/StorefrontThemeProvider";

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

export default function StorefrontLayout({
  children,
}: StorefrontLayoutProps) {
  return (
    <StorefrontThemeProvider>
      <CartProvider>
        <div className="min-h-screen bg-[#faf7f4] font-inter">
          <StoreNav />
          <main>{children}</main>
          <StoreFooter />
          <CartDrawer />
        </div>
      </CartProvider>
    </StorefrontThemeProvider>
  );
}