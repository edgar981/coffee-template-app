import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSiteContent } from "@/lib/config/site-content";
import { navOffsetClase } from "@/lib/config/themes";
import { vendedorEstaCompleto, politicaDeDatosPersonales, avisoDePrivacidadCorto } from "@/lib/legal/plantillas";
import PaginaLegal from "@/components/storefront/legal/PaginaLegal";

export const metadata: Metadata = { title: "Tratamiento de datos personales" };

// LA POLÍTICA DE TRATAMIENTO DE DATOS PERSONALES (§ TIENDA-LEGAL-1, Ley 1581 de 2012) — mismo gate
// que /legal/terminos-y-condiciones: sin la identidad del vendedor completa, redirige a la home.
// El aviso de privacidad CORTO (§ `avisoDePrivacidadCorto`) abre la página — es la MISMA frase que
// el pie y el checkout podrían citar, no una quinta página aparte (el spec declara CUATRO).
export default async function TratamientoDeDatosPage() {
  const content = await getSiteContent();
  if (!vendedorEstaCompleto(content.vendedor)) redirect("/");

  const secciones = politicaDeDatosPersonales(content.vendedor);
  const offsetClase = navOffsetClase(content.navTratamiento.posicion);
  return (
    <main className={`bg-[var(--sf-fondo)] ${offsetClase} min-h-screen`}>
      <article className="max-w-2xl mx-auto px-4 pt-16">
        <p className="text-sm text-[var(--sf-texto)] bg-[var(--sf-superficie)] rounded-xl p-4">
          {avisoDePrivacidadCorto(content.vendedor)}
        </p>
      </article>
      <PaginaLegal titulo="Política de tratamiento de datos personales" secciones={secciones} />
    </main>
  );
}
