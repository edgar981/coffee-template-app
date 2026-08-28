import type { MetadataRoute } from "next";
import { getSiteSettings } from "@/lib/config/site-settings";

// DINÁMICO obligatorio: sin esto Next PRERENDERIZA el manifest y hornea el nombre del BUILD
// —el mismo defecto de propagación del storefront (§ dev/build engaña sobre el modo de render)—,
// así que editar el nombre no se vería hasta un rebuild. `force-dynamic` lo re-lee por request.
export const dynamic = 'force-dynamic';

// El manifest (PWA) toma el nombre y la descripción del negocio de SiteSetting —editables
// desde el panel—. La query lo vuelve DINÁMICO (se re-lee por request); el manifest se pide
// rara vez, así que el costo es marginal. `theme_color`/`background_color` siguen siendo los
// de Nayoli hasta el commit 4 (color desde SiteSetting).
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { nombre, descripcionFooter } = await getSiteSettings();
  return {
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
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
