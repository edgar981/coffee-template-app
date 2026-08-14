import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { destinoDesdeOrdenes } from "@/lib/redirect-ordenes";

export function proxy(request: NextRequest) {
  const session = getSessionCookie(request);

  // LA SESIÓN VA PRIMERO, sin cambios: sin cookie, cualquier `/admin/*` sigue
  // yendo a `/login`. Poner el redirect de la ruta retirada antes sólo cambiaría
  // a qué URL llega alguien que de todos modos va a rebotar al login.
  if (!session && request.nextUrl.pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // ── LA PANTALLA RETIRADA ───────────────────────────────────────────────────
  //
  // `/admin/ordenes` murió y `/admin/pedidos` habla otro vocabulario de URL. La
  // TRADUCCIÓN vive en `lib/redirect-ordenes` —pura y con sus tests de capa 1—
  // y acá sólo se la llama: el mapeo es la decisión, esto es plomería.
  //
  // Va en el middleware y no en `next.config.ts` porque los `redirects()` de la
  // config pueden arrastrar el query pero NO renombrar sus claves, y renombrar es
  // justo lo que hay que hacer (`order`→`pedido`, `cobrar`→`f`).
  //
  // 307 y no 308: un permanente se cachea en el navegador sin forma cómoda de
  // deshacerlo, y en un panel el costo de un 308 mal cacheado es un operador que
  // no llega a una ruta hasta limpiar la caché. No hay SEO que ganar — el sitio
  // entero va `noindex`.
  const destino = destinoDesdeOrdenes(request.nextUrl.pathname, request.nextUrl.searchParams);
  if (destino) return NextResponse.redirect(new URL(destino, request.url), 307);

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin(.*)"],
};
