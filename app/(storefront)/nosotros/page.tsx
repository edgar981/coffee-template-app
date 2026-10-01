import { Fragment } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSiteContent } from "@/lib/config/site-content";
import { getSiteSettings } from "@/lib/config/site-settings";
import NosotrosHistoria from "@/components/storefront/nosotros/NosotrosHistoria";
import NosotrosGaleria from "@/components/storefront/nosotros/NosotrosGaleria";
import NosotrosCierre from "@/components/storefront/nosotros/NosotrosCierre";
import { resolverOrdenNosotros, type BandaNosotrosId } from "@/lib/config/site-content-defaults";
import { navOffsetClase } from "@/lib/config/themes";
import { modoEditorActivo } from "@/lib/config/modo-editor-gate";

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
// `presentaciones` en la home. `nosotrosCierre` (§ NOSOTROS-COMPOSICION-1) cierra la página, al final
// —justo antes del pie global del layout—: es hide-on-empty (§ NosotrosCierre.tsx), así que un tenant
// que no la llene no ve nada nuevo — la salida sigue byte-idéntica para todo tenant que no edite
// nada (afirmado en `lib/config/nosotros-bandas.test.ts`).
export default async function NosotrosPage() {
  const content = await getSiteContent();
  if (!content.paginas.nosotros.visible) redirect("/");

  // El nombre del negocio alimenta el fallback del alt de la galería (§ NosotrosGaleria): va por PROP
  // desde el server, no por `useSiteSettings()`, para que la vista en vivo del editor no lo exija.
  const [settings, enModoEditor] = await Promise.all([getSiteSettings(), modoEditorActivo()]);

  const BANDAS: Record<BandaNosotrosId, () => React.ReactNode> = {
    nosotrosHistoria: () => <NosotrosHistoria />,
    nosotrosGaleria: () => <NosotrosGaleria negocio={settings.nombre} />,
    nosotrosCierre: () => <NosotrosCierre />,
  };

  // EL MARCADOR `data-editor-seccion` (§ EDITOR-TIENDA-IFRAME-VISTA-1) — mismo mecanismo que la home:
  // sólo en modo editor, y sin bytes de más para el resto del tráfico.
  const bandaNodo = (id: BandaNosotrosId) => {
    const render = BANDAS[id]();
    return enModoEditor ? <div data-editor-seccion={id}>{render}</div> : render;
  };

  // El provider de SiteContent lo monta el layout del storefront → las secciones leen el contenido.
  const bandas = resolverOrdenNosotros().map((id) => (
    <Fragment key={id}>{bandaNodo(id)}</Fragment>
  ));
  // EL ALTO DEL HEADER FIJO — § NOSOTROS-OFFSET-NAV-1: con el nav de CORTE (88px) la primera banda
  // (`py-24`) quedaba a 8px del filete. Bajo `navTratamiento.posicion` se reserva el alto del header,
  // como las demás páginas internas (`navOffsetClase`). Sin él (Nayoli) no hay envoltorio: byte-idéntico.
  if (!content.navTratamiento.posicion) return <>{bandas}</>;
  return <div className={navOffsetClase(true)}>{bandas}</div>;
}
