import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSiteContent } from "@/lib/config/site-content";
import { getSiteSettings } from "@/lib/config/site-settings";
import NosotrosHistoria from "@/components/storefront/nosotros/NosotrosHistoria";
import NosotrosGaleria from "@/components/storefront/nosotros/NosotrosGaleria";

// Sólo "Nosotros": el layout del storefront aplica el template `%s · {nombre}` desde
// SiteSetting (app/(storefront)/layout.tsx), así que el título resuelve a "Nosotros · {nombre}".
export const metadata: Metadata = { title: "Nosotros" };

// La página /nosotros. Es una CAPACIDAD que se puede apagar (`paginas.nosotros.visible`): apagada,
// REDIRIGE a la home en vez de dar 404 —la página EXISTE, sólo está apagada; un 404 diría que no
// existe—. Redirect TEMPORAL (puede volver a encenderse): el `redirect()` de Next emite 307, que
// para navegar a una página GET es equivalente al 302 pedido (el destino se pide igual con GET); un
// 302 literal exigiría middleware, sin ganancia funcional. El flag lo lee el layout server (cache
// por request), así que esta segunda lectura no cuesta una query extra.
export default async function NosotrosPage() {
  const content = await getSiteContent();
  if (!content.paginas.nosotros.visible) redirect("/");

  // El nombre del negocio alimenta el fallback del alt de la galería (§ NosotrosGaleria): va por PROP
  // desde el server, no por `useSiteSettings()`, para que la vista en vivo del editor no lo exija.
  const settings = await getSiteSettings();

  // El provider de SiteContent lo monta el layout del storefront → las secciones leen el contenido.
  return (
    <>
      <NosotrosHistoria />
      <NosotrosGaleria negocio={settings.nombre} />
    </>
  );
}
