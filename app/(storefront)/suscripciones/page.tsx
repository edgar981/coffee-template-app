import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSiteContent } from "@/lib/config/site-content";
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
export default async function SuscripcionesPage() {
  const content = await getSiteContent();
  if (!content.paginas.suscripciones.visible) redirect("/");
  return <SuscripcionesContenido />;
}
