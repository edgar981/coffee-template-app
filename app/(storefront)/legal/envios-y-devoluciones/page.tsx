import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSiteContent } from "@/lib/config/site-content";
import { getSiteSettings } from "@/lib/config/site-settings";
import { navOffsetClase } from "@/lib/config/themes";
import { vendedorEstaCompleto, enviosYDevoluciones } from "@/lib/legal/plantillas";
import PaginaLegal from "@/components/storefront/legal/PaginaLegal";

export const metadata: Metadata = { title: "Envíos y devoluciones" };

// ENVÍOS, CAMBIOS Y DEVOLUCIONES, CON DERECHO DE RETRACTO (§ TIENDA-LEGAL-1) — mismo gate que las
// otras tres páginas legales: sin la identidad del vendedor completa, redirige a la home.
export default async function EnviosYDevolucionesPage() {
  const [content, settings] = await Promise.all([getSiteContent(), getSiteSettings()]);
  if (!vendedorEstaCompleto(content.vendedor)) redirect("/");

  const secciones = enviosYDevoluciones(content.vendedor, {
    suscripciones: content.paginas.suscripciones.visible,
    contraentrega: settings.metodosPago.some((m) => m.tipo === "efectivo"),
  });
  const offsetClase = navOffsetClase(content.navTratamiento.posicion);
  return (
    <main className={`bg-[var(--sf-fondo)] ${offsetClase} min-h-screen`}>
      <PaginaLegal titulo="Envíos, cambios y devoluciones" secciones={secciones} />
    </main>
  );
}
