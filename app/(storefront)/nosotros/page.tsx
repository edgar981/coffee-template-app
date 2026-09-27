import { Fragment } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSiteContent } from "@/lib/config/site-content";
import { getSiteSettings } from "@/lib/config/site-settings";
import NosotrosHistoria from "@/components/storefront/nosotros/NosotrosHistoria";
import NosotrosGaleria from "@/components/storefront/nosotros/NosotrosGaleria";
import { resolverOrdenNosotros, type BandaNosotrosId } from "@/lib/config/site-content-defaults";

// Sólo "Nosotros": el layout del storefront aplica el template `%s · {nombre}` desde
// SiteSetting (app/(storefront)/layout.tsx), así que el título resuelve a "Nosotros · {nombre}".
export const metadata: Metadata = { title: "Nosotros" };

// La página /nosotros. Es una CAPACIDAD que se puede apagar (`paginas.nosotros.visible`): apagada,
// REDIRIGE a la home en vez de dar 404 —la página EXISTE, sólo está apagada; un 404 diría que no
// existe—. Redirect TEMPORAL (puede volver a encenderse): el `redirect()` de Next emite 307, que
// para navegar a una página GET es equivalente al 302 pedido (el destino se pide igual con GET); un
// 302 literal exigiría middleware, sin ganancia funcional. El flag lo lee el layout server (cache
// por request), así que esta segunda lectura no cuesta una query extra.
//
// EL ORDEN (§ NOSOTROS-SISTEMA-DE-BANDAS-1) ya no es un JSX fijo: `resolverOrdenNosotros()` (gemela
// de `resolverOrden` de la home, § site-content-defaults.ts) decide la SECUENCIA y `BANDAS` (acá, no
// en `lib/` — mismo sitio que la home) es el REGISTRO bandaId→render, exhaustivo por TIPO
// (`Record<BandaNosotrosId, …>`: agregar un id a `BANDA_NOSOTROS_IDS` sin registrarlo acá rompe el
// typecheck). `nosotrosGaleria` es la ÚNICA banda con un prop extra (`negocio`), igual que
// `presentaciones` en la home. REFACTOR PURO: compone exactamente las mismas dos bandas, en el mismo
// orden — la salida es byte-idéntica para TODO tenant (afirmado en `lib/config/nosotros-bandas.test.ts`).
export default async function NosotrosPage() {
  const content = await getSiteContent();
  if (!content.paginas.nosotros.visible) redirect("/");

  // El nombre del negocio alimenta el fallback del alt de la galería (§ NosotrosGaleria): va por PROP
  // desde el server, no por `useSiteSettings()`, para que la vista en vivo del editor no lo exija.
  const settings = await getSiteSettings();

  const BANDAS: Record<BandaNosotrosId, () => React.ReactNode> = {
    nosotrosHistoria: () => <NosotrosHistoria />,
    nosotrosGaleria: () => <NosotrosGaleria negocio={settings.nombre} />,
  };

  // El provider de SiteContent lo monta el layout del storefront → las secciones leen el contenido.
  return (
    <>
      {resolverOrdenNosotros().map((id) => (
        <Fragment key={id}>{BANDAS[id]()}</Fragment>
      ))}
    </>
  );
}
