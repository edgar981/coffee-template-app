import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/config/site-settings";

// El manifest PWA del STOREFRONT (del CLIENTE): nombre, descripción e íconos del negocio, editables
// desde el panel (SiteSetting). Vive como ROUTE HANDLER —NO como la convención `app/manifest.ts`— a
// propósito: la convención de archivo AUTO-INYECTA su `<link rel="manifest">` en TODA la app
// (storefront Y admin) y GANA sobre cualquier `metadata.manifest` de un grupo (doc de Next: "File-based
// metadata has the higher priority and will override the `metadata` object"). Así el PANEL no podía
// tener su propio manifest y se instalaba como el negocio del cliente. Es la MISMA trampa que obligó a
// mover los íconos de `app/` a `public/` (§ Identidad). Retirada la convención, cada grupo declara su
// manifest con `metadata.manifest`: el storefront apunta acá; el admin a `/duna.webmanifest`.
//
// DINÁMICO: lee SiteSetting por request, así que editar el nombre del negocio se ve sin rebuild (el
// mismo motivo que el `force-dynamic` que tenía la convención). El manifest se pide rara vez.

export const dynamic = "force-dynamic";

export async function GET() {
  const { nombre, descripcionFooter } = await getSiteSettings();
  const manifest = {
    name: nombre,
    short_name: nombre,
    description: descripcionFooter,
    start_url: "/",
    display: "standalone",
    background_color: "#F9F6F4",
    theme_color: "#1E150E",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  // content-type de manifest (no application/json), como emitía la convención.
  return new NextResponse(JSON.stringify(manifest), {
    headers: { "content-type": "application/manifest+json" },
  });
}
