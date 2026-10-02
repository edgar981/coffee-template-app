import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readSiteContent } from "@/lib/config/site-content-read";
import {
  decidirIconoRuta,
  cacheControlIconoTienda,
  ENCABEZADO_VARIANTE_ICONO,
  ICONOS_ESTATICOS_POR_RUTA,
  type VarianteIconoRuta,
} from "@/lib/config/metadata-tienda";

// LA DECISIÓN del probe CIEGO (§ FAVICON-RUTA-POR-TIENDA-1, cierra el open-followup
// `METADATA-FAVICON-PROBE-CIEGO-1` de METADATA-ICONOS-Y-LANG-POR-TIENDA-1): un navegador o iOS
// piden estas rutas literales SIN leer el `<link rel="icon">` del `<head>` —
// `/favicon.ico`, `/apple-touch-icon.png`, `/apple-touch-icon-precomposed.png` —, y hasta ese
// slice esas tres seguían sirviendo el archivo ESTÁTICO de Nayoli aunque la tienda hubiera subido
// su propio ícono (`content.logo.icono`, § MARCA-LOGO-IMAGEN-1). `proxy.ts` las REESCRIBE
// (rewrite, no redirect — el navegador no ve el cambio de URL) hacia acá, con la variante en el
// HEADER `ENCABEZADO_VARIANTE_ICONO` (NO en el query string — medido: un `?variante=` en la URL
// del rewrite no le llegaba a `request.nextUrl.searchParams` acá, § el comentario de `proxy.ts`).
//
// ESTA RUTA YA NO REDIRIGE (§ FAVICON-MISMO-ORIGEN-1): Safari descartaba el ícono subido porque
// vivía en OTRO dominio (el blob de Vercel) y lo alcanzaba por 307 — "ya lo conocía" el de Nayoli
// y se quedaba con ése, aun tras borrar los datos del sitio. Con ícono subido, esta ruta OBTIENE
// sus bytes del blob del lado del servidor (`fetch`, el store es PÚBLICO — § Storage, CLAUDE.md) y
// los sirve ella misma, por el MISMO origen que la tienda; si el blob no responde (red caída, 404),
// cae al estático de HOY para la variante pedida — NUNCA un 500. Sin ícono, los MISMOS bytes de
// siempre (Nayoli byte-idéntica). Nunca de vuelta a la ruta literal (sería el loop que `proxy.ts`
// ya documenta evitar).
//
// RAW (`readSiteContent`), NO el cacheado `getSiteContent` (§ CLAUDE.md, "Los DOS loaders — y por
// qué son dos"): esto es un route handler, no un render, y RAW es lo que el test de integración
// puede importar sin que `server-only` reviente la resolución del módulo fuera de Next (ese
// paquete no resuelve en tsx — medido: no existe en `node_modules`).
export const dynamic = "force-dynamic";

function varianteDelHeader(request: NextRequest): VarianteIconoRuta {
  return request.headers.get(ENCABEZADO_VARIANTE_ICONO) === "apple" ? "apple" : "favicon";
}

// El archivo ESTÁTICO de hoy, byte a byte (Nayoli byte-idéntica). Se LEE en runtime —no se
// importa— porque `public/` no se puede tocar en este slice (no hay permiso para borrar/mover
// sus archivos) y un `import` de un binario no es un patrón de este repo. `process.cwd()` + el
// nombre LITERAL (sólo dos valores fijos, § `ICONOS_ESTATICOS_POR_RUTA`) es lo que Next/Vercel
// traza para incluir el archivo en el bundle de la función — el mismo mecanismo que usan las
// rutas que generan imágenes con `next/og` leyendo fuentes de `public/`. Dos llamadores: el caso
// SIN ícono (abajo) y el FALLBACK cuando el blob del ícono subido no responde.
async function respuestaEstatica(archivo: string, contentType: string): Promise<NextResponse> {
  const bytes = await readFile(path.join(process.cwd(), "public", archivo));
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}

export async function GET(request: NextRequest) {
  const variante = varianteDelHeader(request);
  const content = await readSiteContent();
  const decision = decidirIconoRuta(content.logo.icono, variante);

  if (decision.tipo === "subido") {
    // VERSIONADO = la URL trae `?v=` (el hit directo desde el `<link>`/manifest,
    // § `urlIconoVersionada`): cache LARGO, porque un ícono nuevo es una URL nueva. SIN `?v=` =
    // el probe ciego vía `proxy.ts` (/favicon.ico y las dos apple-touch-icon*, nombre FIJO): cache
    // CORTO, porque esa URL no puede versionarse (§ `cacheControlIconoTienda`).
    const versionado = request.nextUrl.searchParams.has("v");
    try {
      const respuestaBlob = await fetch(decision.url);
      if (!respuestaBlob.ok) {
        throw new Error(`icono-tienda: el blob respondió ${respuestaBlob.status}`);
      }
      const bytes = Buffer.from(await respuestaBlob.arrayBuffer());
      return new NextResponse(bytes, {
        headers: {
          "Content-Type": decision.contentType,
          "Cache-Control": cacheControlIconoTienda(versionado),
        },
      });
    } catch {
      // El blob no respondió (red caída, 404, lo que sea): cae al estático de HOY para esta
      // variante — nunca un 500 por un ícono que no se pudo traer.
      const estatico = ICONOS_ESTATICOS_POR_RUTA[variante];
      return respuestaEstatica(estatico.archivo, estatico.contentType);
    }
  }

  return respuestaEstatica(decision.archivo, decision.contentType);
}
