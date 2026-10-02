import type { Metadata } from "next";
import type { ReactNode } from "react";

import { requerirSesionAdmin } from "@/lib/admin/acceso-admin";

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
export const metadata: Metadata = { title: "Editor de la tienda" };

export default async function EditorLayout({ children }: { children: ReactNode }) {
  await requerirSesionAdmin();
  return children;
}
