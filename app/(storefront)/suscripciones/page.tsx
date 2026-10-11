import { Fragment } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSiteContent } from "@/lib/config/site-content";
import { getSiteSettings } from "@/lib/config/site-settings";
import { modoEditorActivo } from "@/lib/config/modo-editor-gate";
import { navOffsetClase } from "@/lib/config/themes";
import SuscripcionApertura from "@/components/storefront/suscripciones/SuscripcionApertura";
import SuscripcionPlanes from "@/components/storefront/suscripciones/SuscripcionPlanes";
import SuscripcionPasos from "@/components/storefront/suscripciones/SuscripcionPasos";
import PreguntasFrecuentes from "@/components/storefront/PreguntasFrecuentes";

// El layout del storefront aplica `%s · {nombre}` desde SiteSetting → "Suscripciones · {nombre}".
export const metadata: Metadata = { title: "Suscripciones" };

// La página /suscripciones. Es una CAPACIDAD apagable (`paginas.suscripciones.visible`, § Backlog #49
// opción 2): apagada, REDIRIGE a la home en vez de dar 404 —la página EXISTE, sólo está apagada—.
// Redirect 307 (temporal, puede reencenderse), el MISMO patrón que /nosotros. El flag lo lee el
// layout server (cache por request), así que esta segunda lectura no cuesta una query extra.
//
// § ONIX-SUSCRIPCION-TAQUILLA-1 — REESCRITA ENTERA, sobre la MISMA forma que /nosotros/page.tsx
// (BANDAS + marcador DECLARATIVO por sección), cerrando la limitación que el `page.tsx` + `Contenido.
// tsx` de antes documentaban (§ el censo de este slice): las tres secciones se marcaban por POSICIÓN
// en el DOM (`:scope > section`), un mecanismo que su propio comentario admitía que "FALLA CALLADO" si
// alguna cambia de número de raíces — y la sección NUEVA de este slice (`suscripcionApertura`) sí
// cambia esa cuenta. `Contenido.tsx` SE RETIRÓ: ya no hace falta la mitad cliente que leía
// `useSiteSettings()`/`useSiteContent()` sólo para resolver `whatsapp`/`navTratamiento.posicion` —este
// archivo, server, los lee directo (como /nosotros con `settings.nombre`) y los pasa por PROP/clase.
//
// `whatsapp` LLEGA POR PROP a `SuscripcionPlanes` (y de ahí a `SuscripcionTaquilla`) — la MISMA
// fuente, sólo que ahora resuelta server-side en vez de vía `useSiteSettings()` client-side; el
// contrato del componente (whatsapp opcional) no cambió.
//
// EL MARCADOR `data-editor-seccion` (§ EDITOR-TIENDA-IFRAME-VISTA-1) es ahora UNO POR SECCIÓN —
// `suscripcionApertura`/`suscripcionPlanes`/`suscripcionPasos`/`suscripcionFaq`—, el MISMO nombre que
// `marcadorDeSeccion` (lib/admin/editor-iframe.ts) ya esperaba para estas `SeccionVista` (identidad,
// sin el caso especial de `spotlight`/`featured`): "Ir a la sección" deja de aterrizar sólo al TOPE de
// la página y apunta al nodo real. Sólo se emite con sesión OWNER/MANAGER verificada
// (`modoEditorActivo()`); tráfico público no gana ni un atributo de más.
type SuscripcionesBandaId = 'suscripcionApertura' | 'suscripcionPlanes' | 'suscripcionPasos' | 'suscripcionFaq';

const ORDEN: readonly SuscripcionesBandaId[] = ['suscripcionApertura', 'suscripcionPlanes', 'suscripcionPasos', 'suscripcionFaq'];

export default async function SuscripcionesPage() {
  const content = await getSiteContent();
  if (!content.paginas.suscripciones.visible) redirect("/");

  const [settings, enModoEditor] = await Promise.all([getSiteSettings(), modoEditorActivo()]);

  const BANDAS: Record<SuscripcionesBandaId, () => React.ReactNode> = {
    suscripcionApertura: () => <SuscripcionApertura />,
    suscripcionPlanes: () => <SuscripcionPlanes whatsapp={settings.whatsapp} />,
    suscripcionPasos: () => <SuscripcionPasos />,
    // EL `<main>` SOBREVIVE de `Contenido.tsx` (byte-idéntico): envolvía la FAQ, no una convención
    // de esta página — se conserva con la banda que lo necesita, no se pierde en la reescritura.
    suscripcionFaq: () => <main className="bg-[var(--sf-fondo)]"><PreguntasFrecuentes /></main>,
  };

  const bandaNodo = (id: SuscripcionesBandaId) => {
    const render = BANDAS[id]();
    return enModoEditor ? <div data-editor-seccion={id}>{render}</div> : render;
  };

  const bandas = ORDEN.map((id) => <Fragment key={id}>{bandaNodo(id)}</Fragment>);

  // EL RELLENO SUPERIOR — `navOffsetClase(navTratamiento.posicion)` SIEMPRE envuelve (a diferencia
  // de /nosotros, que lo salta con `posicion:false`: sus bandas ya traen su propio padding
  // superior, § NOSOTROS-OFFSET-NAV-1 — /suscripciones no, así que esta página conserva el wrapper
  // incondicional que `Contenido.tsx` ya aplicaba). `false` (todo tenant salvo CORTE) → `'pt-16'`,
  // byte a byte lo que esta página ya reservaba (§ NAV-INTERNAS-CLARO-Y-OFFSET-1).
  return <div className={navOffsetClase(content.navTratamiento.posicion)}>{bandas}</div>;
}
