import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: { default: "Café Nayoli", template: "%s · Café Nayoli" },
  description:
    "Café de especialidad 100% colombiano, de la Finca Nayoli en Supatá.",
};

// La política de tema NO vive aquí: cada grupo de rutas monta su propio
// ThemeProvider (storefront light-only, admin con dark). Ver CLAUDE.md.
// Este `themeColor` es un FALLBACK: el admin lo sobreescribe (§ Identidad) y el storefront lo
// DERIVA de su paleta (§ (storefront)/layout `generateViewport`, #1) — para páginas fuera de un
// grupo (login) queda este literal de Nayoli.
export const viewport: Viewport = {
  themeColor: "#F9F6F4",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // `lang="es"` (§ METADATA-ICONOS-Y-LANG-POR-TIENDA-1, 2026-10-01): era "en" — el ÚNICO `<html>`
    // del repo (ni `(storefront)` ni `(admin)` declaran uno propio), así que gobierna TODAS las
    // rutas, admin incluido. Corrección aprobada por el owner como cambio de bytes de Nayoli; no
    // mueve un solo píxel (es un atributo, no contenido renderizado).
    <html lang="es" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        {children}
        {/* TOAST-COMO-PROTOTIPO-1: este Toaster ahora decide su propio alcance (admin/pre-auth) —
            fuera de esas rutas se apaga solo, para dejarle el paso a `ToasterTienda`
            (`app/(storefront)/layout.tsx`). Ver `components/ui/sonner.tsx`. */}
        <Toaster />
      </body>
    </html>
  );
}