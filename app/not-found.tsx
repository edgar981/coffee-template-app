import type { Metadata } from "next";
import Link from "next/link";
import { getSiteSettings } from "@/lib/config/site-settings";
import { getSiteContent } from "@/lib/config/site-content";
import { tituloYDescripcionDeTienda, iconosDeTienda } from "@/lib/config/metadata-tienda";

// EL 404 GLOBAL (§ METADATA-ICONOS-Y-LANG-POR-TIENDA-1) — este archivo NO EXISTÍA: Next.js servía su
// 404 GENÉRICO para toda URL sin ruta (un link roto, un bot, un typo), y ese 404 se renderiza SÓLO
// dentro de `app/layout.tsx` —ninguna ruta coincidió, así que ni `(storefront)` ni `(admin)` entran
// al árbol—, heredando el título/descripción/ícono FIJOS de Nayoli de la raíz. Ése era el defecto
// reportado por el owner sobre la demo de Café Las Chamisas: "el ícono de la pestaña y el título
// fuera de la tienda (p. ej. la página de error) siguen siendo los de Nayoli".
//
// Lee las MISMAS fuentes que `app/(storefront)/layout.tsx` (SiteSetting + `content.logo.icono`), vía
// el módulo compartido `lib/config/metadata-tienda.ts` — para que el 404 y las páginas reales de la
// tienda nunca diverjan sobre título/ícono.
//
// LÍMITE CONOCIDO, no resuelto acá: nadie en el repo llama `notFound()` dentro de una ruta (medido:
// `grep -rln "notFound(" app/` da vacío), así que TODO 404 —incluida una URL de `/admin/*` mal
// escrita— cae por este archivo y muestra la identidad de la TIENDA, no "Panel Duna". Es un caso raro
// (las rutas de admin están gateadas por sesión, § proxy.ts) y un `not-found.tsx` propio por grupo no
// está en `touches:` de este slice.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [{ nombre, descripcionFooter }, content] = await Promise.all([
    getSiteSettings(),
    getSiteContent(),
  ]);
  return {
    ...tituloYDescripcionDeTienda(nombre, descripcionFooter),
    icons: iconosDeTienda(content.logo.icono),
  };
}

export default async function NotFound() {
  const { nombre } = await getSiteSettings();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--sf-fondo)] px-6 text-center font-inter">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--sf-texto-suave)]">{nombre}</p>
      <h1 className="text-3xl font-semibold text-[var(--sf-tinta)]">Página no encontrada</h1>
      <p className="max-w-md text-[var(--sf-texto)]">
        La página que buscas no existe o se movió de lugar.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-full bg-[var(--sf-tinta)] px-6 py-2 text-sm font-medium text-white"
      >
        Volver al inicio
      </Link>
    </main>
  );
}
