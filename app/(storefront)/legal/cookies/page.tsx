import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSiteContent } from "@/lib/config/site-content";
import { navOffsetClase } from "@/lib/config/themes";
import { vendedorEstaCompleto, cookies } from "@/lib/legal/plantillas";
import PaginaLegal from "@/components/storefront/legal/PaginaLegal";

export const metadata: Metadata = { title: "Cookies" };

// AVISO DE COOKIES (§ TIENDA-LEGAL-1) — sólo técnicas, mismo gate que las otras tres páginas
// legales: sin la identidad del vendedor completa, redirige a la home.
export default async function CookiesPage() {
  const content = await getSiteContent();
  if (!vendedorEstaCompleto(content.vendedor)) redirect("/");

  const secciones = cookies(content.vendedor);
  const offsetClase = navOffsetClase(content.navTratamiento.posicion);
  return (
    <main className={`bg-[var(--sf-fondo)] ${offsetClase} min-h-screen`}>
      <PaginaLegal titulo="Cookies" secciones={secciones} />
    </main>
  );
}
