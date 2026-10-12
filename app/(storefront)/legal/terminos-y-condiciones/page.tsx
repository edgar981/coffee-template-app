import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSiteContent } from "@/lib/config/site-content";
import { getSiteSettings } from "@/lib/config/site-settings";
import { navOffsetClase } from "@/lib/config/themes";
import { vendedorEstaCompleto, terminosYCondiciones } from "@/lib/legal/plantillas";
import PaginaLegal from "@/components/storefront/legal/PaginaLegal";

export const metadata: Metadata = { title: "Términos y condiciones" };

// LOS TÉRMINOS Y CONDICIONES DE VENTA (§ TIENDA-LEGAL-1) — plantilla fija sustituida con la
// identidad del vendedor (`content.vendedor`). SIN los cinco datos que `vendedorEstaCompleto`
// exige, la página REDIRIGE a la home (307), el MISMO patrón que /nosotros y /preguntas-frecuentes:
// la ruta EXISTE, sólo no tiene con qué publicarse — nunca un hueco ni un dato inventado a la
// vista del comprador (§ el spec, "los clientes nunca ven un hueco"). El panel (`VendedorSeccion.
// tsx`) es donde se ve CUÁNTO FALTA mientras tanto.
export default async function TerminosYCondicionesPage() {
  const [content, settings] = await Promise.all([getSiteContent(), getSiteSettings()]);
  if (!vendedorEstaCompleto(content.vendedor)) redirect("/");

  const secciones = terminosYCondiciones(content.vendedor, {
    suscripciones: content.paginas.suscripciones.visible,
    contraentrega: settings.metodosPago.some((m) => m.tipo === "efectivo"),
  });
  const offsetClase = navOffsetClase(content.navTratamiento.posicion);
  return (
    <main className={`bg-[var(--sf-fondo)] ${offsetClase} min-h-screen`}>
      <PaginaLegal titulo="Términos y condiciones de venta" secciones={secciones} />
    </main>
  );
}
