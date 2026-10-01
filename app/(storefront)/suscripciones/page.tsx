import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSiteContent } from "@/lib/config/site-content";
import { modoEditorActivo } from "@/lib/config/modo-editor-gate";
import SuscripcionesContenido from "./Contenido";

// El layout del storefront aplica `%s · {nombre}` desde SiteSetting → "Suscripciones · {nombre}".
export const metadata: Metadata = { title: "Suscripciones" };

// La página /suscripciones. Es una CAPACIDAD apagable (`paginas.suscripciones.visible`, § Backlog #49
// opción 2): apagada, REDIRIGE a la home en vez de dar 404 —la página EXISTE, sólo está apagada—.
// Redirect 307 (temporal, puede reencenderse), el MISMO patrón que /nosotros. El flag lo lee el
// layout server (cache por request), así que esta segunda lectura no cuesta una query extra.
//
// EL RELLENO SUPERIOR YA NO SE ENVUELVE ACÁ (§ CIERRE-NOCHE-RIEL-1, cierra
// SUSCRIPCIONES-OFFSET-CONTENIDO-FUERA-DE-TOUCHES-1): `Contenido.tsx` entró al `touches:` de esta
// tanda, así que migró su `pt-16` directo a `navOffsetClase(navTratamiento.posicion)` — la forma
// UNIFORME que las otras seis páginas internas ya tienen. El wrapper con `navOffsetDeltaClase` (la
// DIFERENCIA que faltaba mientras `Contenido.tsx` estaba fuera de alcance) se retiró con él.
// EL MARCADOR `data-editor-seccion="suscripciones"` (§ EDITOR-TIENDA-IFRAME-VISTA-1) es ÚNICO para
// TODA la página, no uno por sección: sus tres secciones editables (`suscripcionPlanes`/
// `suscripcionPasos`/`suscripcionFaq`) viven dentro de `./Contenido.tsx`, fuera de `touches:` de
// este slice, así que no hay forma de marcarlas por separado sin tocarlo. "Ir a la sección" para
// esas tres sólo lleva al TOPE de /suscripciones (§ `lib/admin/editor-iframe.ts`,
// `marcadorDeSeccion`) — limitación conocida, documentada en `DECISIONS.md`.
export default async function SuscripcionesPage() {
  const content = await getSiteContent();
  if (!content.paginas.suscripciones.visible) redirect("/");
  const enModoEditor = await modoEditorActivo();
  if (!enModoEditor) return <SuscripcionesContenido />;
  return <div data-editor-seccion="suscripciones"><SuscripcionesContenido /></div>;
}
