import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/config/site-settings";
import { getSiteContent } from "@/lib/config/site-content";
import { coloresPWA } from "@/lib/config/pwa-colores";

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
  // El nombre/descripción de SiteSetting; los COLORES de la PWA de la paleta (`content.tema`, § #1):
  // background_color = fondo del cliente, theme_color = su tinta (null → los literales de Nayoli,
  // byte-idéntico). Los dos son independientes → Promise.all.
  const [{ nombre, descripcionFooter }, content] = await Promise.all([getSiteSettings(), getSiteContent()]);
  const { chrome, pwaTheme } = coloresPWA(content.tema.fondo, content.tema.tinta);
  const manifest = {
    name: nombre,
    short_name: nombre,
    description: descripcionFooter,
    start_url: "/",
    display: "standalone",
    background_color: chrome,
    theme_color: pwaTheme,
    // Los ÍCONOS son assets ESTÁTICOS por-despliegue (§ EL PUNTO DE SWAP): un cliente nuevo REEMPLAZA
    // estos archivos en `public/` (mismos nombres) — cero código. Están inventariados con su regla de
    // caché en `next.config.ts` (§ ICONOS DE MARCA DEL STOREFRONT). Derivarlos de la paleta (un
    // monograma con ImageResponse) es el motor #54, fuera de C2.
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
