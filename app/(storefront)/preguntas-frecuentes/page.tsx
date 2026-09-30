import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSiteContent } from "@/lib/config/site-content";
import { faqSuscripcionesVisible } from "@/lib/config/site-content-defaults";
import { navOffsetClase } from "@/lib/config/themes";
import PreguntasFrecuentes from '@/components/storefront/PreguntasFrecuentes'

// El layout del storefront aplica `%s · {nombre}` desde SiteSetting → "Preguntas Frecuentes · {nombre}".
export const metadata: Metadata = { title: "Preguntas Frecuentes" };

// La página /preguntas-frecuentes SÓLO contiene la FAQ de suscripciones (§ SUSCRIPCIONES-FAQ-DATO-1):
// sin la capacidad de suscripciones encendida, o sin preguntas cargadas, esta página quedaría en
// BLANCO — peor que las cuatro respuestas falsas que reemplaza. REDIRIGE a la home en vez de dar 404
// (la ruta EXISTE, sólo no tiene contenido que mostrar), el MISMO patrón que /nosotros y
// /suscripciones. `faqSuscripcionesVisible` es la MISMA condición que filtra el enlace del footer
// (§ StoreFooter) — una sola función, dos consumidores.
export default async function PreguntasFrecuentesPage() {
  const content = await getSiteContent();
  if (!faqSuscripcionesVisible(content)) redirect("/");
  // EL RELLENO SUPERIOR (§ NAV-INTERNAS-CLARO-Y-OFFSET-1) — separado del inferior (`py-16` →
  // `${offsetClase} pb-16`): sólo el TOPE necesita reservar el alto del header fijo, ver el
  // docstring de `navOffsetClase` (`lib/config/themes.ts`). `false` (todo tenant salvo CORTE) =
  // `pt-16`, así que el total sigue siendo `pt-16 pb-16` — byte a byte lo que esta página ya tenía.
  const offsetClase = navOffsetClase(content.navTratamiento.posicion);
  return (
    <main className={`bg-[var(--sf-fondo)] ${offsetClase} pb-16 min-h-screen`}>
      <PreguntasFrecuentes />
    </main>
  )
}
