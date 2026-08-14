import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { destinoDesdeOrdenes } from "@/lib/redirect-ordenes";
import { destinoDesdeClientes } from "@/lib/redirect-clientes";

export function proxy(request: NextRequest) {
  const session = getSessionCookie(request);

  // LA SESIÓN VA PRIMERO, sin cambios: sin cookie, cualquier `/admin/*` sigue
  // yendo a `/login`. Poner el redirect de la ruta retirada antes sólo cambiaría
  // a qué URL llega alguien que de todos modos va a rebotar al login.
  if (!session && request.nextUrl.pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // ── LAS PANTALLAS RETIRADAS ────────────────────────────────────────────────
  //
  // `/admin/ordenes` murió y `/admin/pedidos` habla otro vocabulario de URL; lo
  // mismo pasó con la Clientes vieja, cuya ruta heredó la del rediseño. La
  // TRADUCCIÓN vive en `lib/redirect-ordenes` y `lib/redirect-clientes` —puras y
  // con sus tests de capa 1— y acá sólo se las llama: el mapeo es la decisión,
  // esto es plomería. Son módulos SEPARADOS porque no comparten nada salvo esta
  // mecánica; fusionarlos daría un helper que tiene que conocer los dos
  // vocabularios para decidir cuál aplica.
  //
  // Va en el middleware y no en `next.config.ts` porque los `redirects()` de la
  // config pueden arrastrar el query pero NO renombrar sus claves, y renombrar es
  // justo lo que hay que hacer (`order`→`pedido`, `cobrar`→`f`,
  // `/clientes/<id>`→`?cliente=<id>`, `recurrentes`→`f`).
  //
  // 307 y no 308: un permanente se cachea en el navegador sin forma cómoda de
  // deshacerlo, y en un panel el costo de un 308 mal cacheado es un operador que
  // no llega a una ruta hasta limpiar la caché. No hay SEO que ganar — el sitio
  // entero va `noindex`.
  //
  // SON DOS y se llaman uno tras otro. El orden da igual y eso está AFIRMADO, no
  // supuesto: `redirect-clientes.test.ts` recorre nueve rutas comprobando que
  // ninguna caiga en los dos. Sin ese test, el día que un mapeo se ensanche el
  // síntoma sería un redirect que gana por estar escrito antes.
  const destino =
    destinoDesdeOrdenes(request.nextUrl.pathname, request.nextUrl.searchParams) ??
    destinoDesdeClientes(request.nextUrl.pathname, request.nextUrl.searchParams);
  if (destino) return NextResponse.redirect(new URL(destino, request.url), 307);

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin(.*)"],
};
