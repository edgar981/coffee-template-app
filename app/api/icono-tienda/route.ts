import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readSiteContent } from "@/lib/config/site-content-read";
import { decidirIconoRuta, ENCABEZADO_VARIANTE_ICONO, type VarianteIconoRuta } from "@/lib/config/metadata-tienda";

// LA DECISIÓN del probe CIEGO (§ FAVICON-RUTA-POR-TIENDA-1, cierra el open-followup
// `METADATA-FAVICON-PROBE-CIEGO-1` de METADATA-ICONOS-Y-LANG-POR-TIENDA-1): un navegador o iOS
// piden estas rutas literales SIN leer el `<link rel="icon">` del `<head>` —
// `/favicon.ico`, `/apple-touch-icon.png`, `/apple-touch-icon-precomposed.png` —, y hasta este
// slice esas tres seguían sirviendo el archivo ESTÁTICO de Nayoli aunque la tienda hubiera subido
// su propio ícono (`content.logo.icono`, § MARCA-LOGO-IMAGEN-1). `proxy.ts` las REESCRIBE
// (rewrite, no redirect — el navegador no ve el cambio de URL) hacia acá, con la variante en el
// HEADER `ENCABEZADO_VARIANTE_ICONO` (NO en el query string — medido: un `?variante=` en la URL
// del rewrite no le llegaba a `request.nextUrl.searchParams` acá, § el comentario de `proxy.ts`);
// esta ruta decide: con ícono subido, un 307 al ícono real; sin él, los MISMOS bytes de hoy —
// nunca de vuelta a la ruta literal (sería el loop que `proxy.ts` ya documenta evitar).
//
// RAW (`readSiteContent`), NO el cacheado `getSiteContent` (§ CLAUDE.md, "Los DOS loaders — y por
// qué son dos"): esto es un route handler, no un render, y RAW es lo que el test de integración
// puede importar sin que `server-only` reviente la resolución del módulo fuera de Next (ese
// paquete no resuelve en tsx — medido: no existe en `node_modules`).
export const dynamic = "force-dynamic";

function varianteDelHeader(request: NextRequest): VarianteIconoRuta {
  return request.headers.get(ENCABEZADO_VARIANTE_ICONO) === "apple" ? "apple" : "favicon";
}

export async function GET(request: NextRequest) {
  const variante = varianteDelHeader(request);
  const content = await readSiteContent();
  const decision = decidirIconoRuta(content.logo.icono, variante);

  if (decision.tipo === "subido") {
    // Cache CORTO (5 min, contra el 3600 del estático de abajo): si el dueño cambia el ícono
    // desde el panel, el siguiente probe ciego lo recoge pronto — acá el valor puede cambiar sin
    // que medie un deploy, a diferencia del asset por-despliegue.
    return NextResponse.redirect(new URL(decision.url, request.url), {
      status: 307,
      headers: { "Cache-Control": "public, max-age=300" },
    });
  }

  // El archivo ESTÁTICO de hoy, byte a byte (Nayoli byte-idéntica). Se LEE en runtime —no se
  // importa— porque `public/` no se puede tocar en este slice (no hay permiso para borrar/mover
  // sus archivos) y un `import` de un binario no es un patrón de este repo. `process.cwd()` +
  // el nombre LITERAL (vía `decision.archivo`, que sólo toma dos valores fijos del registry de
  // arriba) es lo que Next/Vercel traza para incluir el archivo en el bundle de la función —el
  // mismo mecanismo que usan las rutas que generan imágenes con `next/og` leyendo fuentes de
  // `public/`.
  const bytes = await readFile(path.join(process.cwd(), "public", decision.archivo));
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": decision.contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
