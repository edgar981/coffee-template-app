import type { Metadata } from "next";
import type { ReactNode } from "react";

import { requerirSesionAdmin } from "@/lib/admin/acceso-admin";
import { getSiteSettings } from "@/lib/config/site-settings";
import { SiteSettingsProvider } from "@/components/admin/SiteSettingsProvider";

// EL EDITOR DE PANTALLA COMPLETA (§ EDITOR-TIENDA-DISPOSITIVOS-1) — su propia rama de rutas,
// hermana de `app/(admin)/admin/`, DENTRO del mismo grupo `(admin)` (hereda tema Duna, fuentes y
// `.admin-shell` de `app/(admin)/layout.tsx`, sin tocar ese archivo). A diferencia de `/admin/*`, NO
// monta `AdminChrome`: el pedido del owner fue explícito — "el editor abre en una nueva vista, no
// sale nada del panel de navegación" (referencia: el editor de temas de Shopify). Sin sidebar, sin
// topbar: cada ruta de acá es dueña de su propio chrome (hoy, la barra superior fina que monta
// `EditorTiendaPantallaCompleta`).
//
// EL ACCESO ES EL MISMO QUE EL DEL PANEL, literal — ver `lib/admin/acceso-admin.ts`. No se repite el
// chequeo acá: `requerirSesionAdmin()` es la ÚNICA definición, compartida con
// `app/(admin)/admin/layout.tsx`.
//
// EDITOR-TIENDA-TEMA-PROVEEDOR-1 — la pestaña «Tema» se caía con "This page couldn't load":
// `PaletaSeccion` llama `useSiteSettings()` (sólo para el `nombre` del wordmark del preview), y ese
// hook lanza fuera de `<SiteSettingsProvider>`. Sólo `app/(admin)/admin/layout.tsx` montaba ese
// provider; este layout verificaba la sesión y devolvía `children` sin él. Se agrega acá, con la
// MISMA función que usa el layout de `/admin` (`getSiteSettings()`, cacheada por request) — no una
// segunda lectura de la config. Ningún otro provider de `/admin/layout.tsx` hace falta: `AdminChrome`
// no se monta acá (es justo lo que este layout evita), y el resto del árbol de «Tema»
// (`SiteContentProvider`, `CartProvider`) ya los monta `PaletaSeccion`/`FragmentoTienda` LOCALMENTE
// (§ CLAUDE.md, "montar el provider que falta, LOCAL").
export const metadata: Metadata = { title: "Editor de la tienda" };

export default async function EditorLayout({ children }: { children: ReactNode }) {
  const [, settings] = await Promise.all([
    requerirSesionAdmin(),
    getSiteSettings(),
  ]);
  return <SiteSettingsProvider value={settings}>{children}</SiteSettingsProvider>;
}
