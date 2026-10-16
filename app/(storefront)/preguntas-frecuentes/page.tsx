import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSiteContent } from "@/lib/config/site-content";
import { getSiteSettings } from "@/lib/config/site-settings";
import { faqSuscripcionesVisible, preguntasFrecuentesVisible } from "@/lib/config/site-content-defaults";
import { agruparPreguntas } from "@/lib/storefront/preguntas-frecuentes";
import { navOffsetClase } from "@/lib/config/themes";
import PreguntasFrecuentes from '@/components/storefront/PreguntasFrecuentes'
import AyudaPagina from '@/components/storefront/ayuda/AyudaPagina'

// El layout del storefront aplica `%s · {nombre}` desde SiteSetting → "Preguntas Frecuentes · {nombre}".
export const metadata: Metadata = { title: "Preguntas Frecuentes" };

// § PREGUNTAS-FRECUENTES-1 — la página pasa a ser la AYUDA GENERAL de la tienda (grupos, dos
// composiciones elegibles), pero "NINGUNA TIENDA CAMBIA hasta que cargue sus preguntas o elija una"
// (el spec): sin NINGUNA pregunta cargada en `preguntasFrecuentes.items`, esta página sigue
// comportándose EXACTAMENTE como hoy — la FAQ de suscripciones de siempre, o el redirect si tampoco
// existe esa. `preguntasFrecuentesVisible` cubre el toggle+hide-on-empty estructural (array no
// vacío); `agruparPreguntas(...).length > 0` es el gate FINO —al menos una pregunta con sus TRES
// campos completos, no sólo una fila a medias— que decide si de verdad hay algo nuevo que mostrar
// antes de abandonar la rama de siempre.
export default async function PreguntasFrecuentesPage() {
  const content = await getSiteContent();
  const hayAyudaGeneral = preguntasFrecuentesVisible(content) && agruparPreguntas(content.preguntasFrecuentes.items).length > 0;
  const hayFaqSuscripciones = faqSuscripcionesVisible(content);
  if (!hayAyudaGeneral && !hayFaqSuscripciones) redirect("/");

  // EL RELLENO SUPERIOR (§ NAV-INTERNAS-CLARO-Y-OFFSET-1) — separado del inferior (`py-16` →
  // `${offsetClase} pb-16`): sólo el TOPE necesita reservar el alto del header fijo, ver el
  // docstring de `navOffsetClase` (`lib/config/themes.ts`). `false` (todo tenant salvo CORTE) =
  // `pt-16`, así que el total sigue siendo `pt-16 pb-16` — byte a byte lo que esta página ya tenía.
  const offsetClase = navOffsetClase(content.navTratamiento.posicion);

  if (hayAyudaGeneral) {
    // `whatsapp` llega por PROP (§ el docstring de `AyudaPagina.tsx`) — sólo acá, donde SÍ hay
    // `SiteSettingsProvider`, se resuelve el valor real.
    const settings = await getSiteSettings();
    return (
      <main className={`bg-[var(--sf-fondo)] ${offsetClase} pb-16 min-h-screen`}>
        <AyudaPagina whatsapp={settings.whatsapp} />
      </main>
    );
  }

  return (
    <main className={`bg-[var(--sf-fondo)] ${offsetClase} pb-16 min-h-screen`}>
      <PreguntasFrecuentes />
    </main>
  )
}
