import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/config/site-settings";
import { getSiteContent } from "@/lib/config/site-content";
import { coloresPWA } from "@/lib/config/pwa-colores";
import { iconosManifestDeTienda } from "@/lib/config/metadata-tienda";

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
    // Los ÍCONOS: desde § METADATA-ICONOS-Y-LANG-POR-TIENDA-1, el ícono SUBIDO (`content.logo.icono`)
    // si existe, o los tres PNG estáticos de Nayoli si no (`iconosManifestDeTienda`, § `lib/config/
    // metadata-tienda.ts` — la MISMA fuente que `icons` de `(storefront)/layout.tsx`, para que el
    // favicon y el ícono de pantalla de inicio nunca diverjan). Antes de este slice eran SIEMPRE los
    // tres estáticos (§ EL PUNTO DE SWAP); derivar un ícono de VARIAS resoluciones a partir de un
    // único archivo subido (en vez de servir el mismo a `sizes:'any'`) es el motor #54, fuera de este
    // slice.
    icons: iconosManifestDeTienda(content.logo.icono),
  };
  // content-type de manifest (no application/json), como emitía la convención.
  return new NextResponse(JSON.stringify(manifest), {
    headers: { "content-type": "application/manifest+json" },
  });
}
