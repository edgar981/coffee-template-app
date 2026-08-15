import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { AdminThemeProvider } from "@/components/theme/AdminThemeProvider";
import { AdminScope } from "@/components/theme/AdminScope";
import { spaceGrotesk, hankenGrotesk, splineSansMono } from "./fonts";
// Tokens + primitivas de @duna/design-system, y el puente de familias
// tipográficas. Acá y no en el layout raíz: el storefront no lo consume.
import "./duna.css";
import { SUFIJO_PANEL } from "@/lib/admin-titulo";

// Layout del grupo admin (dashboard, login, aceptar-invitación). Monta el
// ThemeProvider del admin aquí para que TODO el producto interno — no solo
// /admin/* — soporte dark mode. El chrome del dashboard (Sidebar/TopBar con el
// toggle) sigue en app/(admin)/admin/layout.tsx.
//
// Tematización Duna (Duna Solutions): el paladar Duna está scopeado a `html.admin`
// en globals.css. `AdminScope` marca <html> al montar (y lo limpia al salir);
// el <script> inline lo aplica antes del primer paint en cargas completas para
// evitar un flash del paladar coffee del storefront, Y monta ahí las clases de
// fuente para que lo portaleado a <body> herede la tipografía (§ duna.css).
// ─── La identidad del PANEL, declarada acá ───────────────────────────────────
//
// El grupo admin es un producto distinto del storefront y por eso declara sus
// propios metadatos. Sin esto, TODO —favicon, título, theme-color— cae en
// cascada desde `app/layout.tsx`, que es de Café Nayoli: el panel de Duna
// mostraba el favicon del cliente en la pestaña.
//
// `icons` acá SOBREESCRIBE las convenciones de archivo de la raíz
// (`app/icon.svg`, `app/favicon.ico`, `app/apple-icon.png`), que Next aplica a
// toda la app y no sólo al storefront. Los del storefront no se tocan.
//
// Los títulos de sección los declara cada `layout.tsx` de ruta y salen de
// `ADMIN_NAV` (§ lib/admin-titulo): la pestaña dice lo que dice el menú.
export const metadata: Metadata = {
  // `absolute` y no `default`: un `default` de segmento hijo SIGUE pasando por
  // el `template` del padre, así que la pestaña del panel salía
  // "Panel Duna · Café Nayoli" — verificado en el <head> real. `absolute` es la
  // forma que Next define para ignorar el template heredado, y el `template` de
  // esta misma línea es el que aplican las secciones de abajo.
  title: { absolute: SUFIJO_PANEL, template: `%s · ${SUFIJO_PANEL}` },
  description: "Panel de operación Duna.",
  icons: {
    icon: [
      { url: "/brand/icon-duna.svg", type: "image/svg+xml" },
      { url: "/brand/favicon-duna.ico", sizes: "any" },
    ],
    shortcut: "/brand/favicon-duna.ico",
  },
};

// Los dos fondos reales de `html.admin` (--background en globals.css): #F9F6F0
// claro, #171717 oscuro.
//
// CASO BORDE CONOCIDO, no un bug: `prefers-color-scheme` sigue la preferencia
// del SISTEMA, no el toggle de tres estados del panel. Un usuario con el sistema
// en claro y el panel forzado a oscuro verá la barra del navegador clara. Es
// límite de un `themeColor` estático en metadata, y NO vale sincronizarlo por JS:
// la mejora es marginal y el costo —un meta tag mutando en el cliente— no.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F9F6F0" },
    { media: "(prefers-color-scheme: dark)",  color: "#171717" },
  ],
};

// Las clases que `next/font` genera para exponer cada `--font-*`. Van a DOS
// sitios: al <div> por SSR (el contenido del panel nunca parpadea) y a <html> por
// el script de abajo (los PORTALES, que viven en <body> y no heredan del div).
// `.variable` puede traer más de una clase — se parte por si acaso.
const FONT_CLASES = [spaceGrotesk, hankenGrotesk, splineSansMono]
  .flatMap(f => f.variable.split(/\s+/))
  .filter(Boolean);

export default function AdminGroupLayout({ children }: { children: ReactNode }) {
  return (
    <AdminThemeProvider>
      {/* EL SCRIPT PONE `admin` **Y LAS FUENTES** EN <html>, antes del primer
          paint. Lo de `admin` evita el flash del paladar coffee; lo de las fuentes
          es la mitad tipográfica de "el chrome es del sistema": los diálogos y
          dropdowns del panel se portalean a <body>, FUERA de `.admin-shell`, así
          que no veían el puente de familias (§ duna.css, el límite que H6 topó).
          Con las clases en <html>, <body> —y todo lo portaleado— hereda `--font-*`,
          y el puente `--duna-font-*` vive ahora en `html.admin` para que lo herede
          también. Va por el script y NO por el layout raíz porque ahí cargaría las
          cinco familias en el storefront, que no las usa (promesa de fonts.ts). */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.classList.add('admin', ${FONT_CLASES.map(c => JSON.stringify(c)).join(', ')})`,
        }}
      />
      <AdminScope />
      <div
        className={`${spaceGrotesk.variable} ${hankenGrotesk.variable} ${splineSansMono.variable} admin-shell`}
      >
        {children}
      </div>
    </AdminThemeProvider>
  );
}
