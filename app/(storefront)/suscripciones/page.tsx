import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSiteContent } from "@/lib/config/site-content";
import { navOffsetDeltaClase } from "@/lib/config/themes";
import SuscripcionesContenido from "./Contenido";

// El layout del storefront aplica `%s · {nombre}` desde SiteSetting → "Suscripciones · {nombre}".
export const metadata: Metadata = { title: "Suscripciones" };

// La página /suscripciones. Es una CAPACIDAD apagable (`paginas.suscripciones.visible`, § Backlog #49
// opción 2): apagada, REDIRIGE a la home en vez de dar 404 —la página EXISTE, sólo está apagada—.
// Redirect 307 (temporal, puede reencenderse), el MISMO patrón que /nosotros. El flag lo lee el
// layout server (cache por request), así que esta segunda lectura no cuesta una query extra.
export default async function SuscripcionesPage() {
  const content = await getSiteContent();
  if (!content.paginas.suscripciones.visible) redirect("/");
  // EL RELLENO SUPERIOR (§ NAV-INTERNAS-CLARO-Y-OFFSET-1) — `SuscripcionesContenido` (`Contenido.tsx`)
  // reserva su propio `pt-16`, pero ESE ARCHIVO NO ESTÁ en el `touches:` de este slice —sólo esta
  // ruta server lo está—, así que en vez de reemplazar su `pt-16` (lo que haría cada otra página
  // tocada) esta envoltura agrega SOLAMENTE la DIFERENCIA que falta para llegar al alto real del
  // header de CORTE. Ver el docstring de `navOffsetDeltaClase` (`lib/config/themes.ts`) para el
  // porqué completo, y `DECISIONS.md` § SUSCRIPCIONES-OFFSET-CONTENIDO-FUERA-DE-TOUCHES-1 para el
  // seguimiento (un slice con `Contenido.tsx` en su alcance debería migrarla a `navOffsetClase`
  // directo y retirar esta envoltura). `false` (todo tenant salvo CORTE) = sin clase → sin
  // envoltura visible, byte a byte lo que esta página ya rendía. `false` NO envuelve en absoluto
  // (en vez de envolver con `className=""`): un `<div>` vacío SIGUE siendo un nodo nuevo en el DOM
  // —React lo emite igual aunque no tenga clase—, y la vara de bytes (`npm run verificar:nayoli`,
  // no sólo la de píxeles) compara el HTML servido, no sólo lo que se ve.
  const deltaClase = navOffsetDeltaClase(content.navTratamiento.posicion);
  if (!deltaClase) return <SuscripcionesContenido />;
  return (
    <div className={deltaClase}>
      <SuscripcionesContenido />
    </div>
  );
}
