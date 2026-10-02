import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { destinoDesdeOrdenes } from "@/lib/redirect-ordenes";
import { destinoDesdeClientes } from "@/lib/redirect-clientes";
import { destinoDesdeProductos } from "@/lib/redirect-productos";
import { destinoDesdeInventario } from "@/lib/redirect-inventario";
import { destinoDesdeEntregas } from "@/lib/redirect-entregas";
import { destinoDesdeConfig } from "@/lib/redirect-config";
import { PARAM_MODO_EDITOR, VALOR_MODO_EDITOR, ENCABEZADO_MODO_EDITOR } from "@/lib/admin/editor-iframe";
import { ENCABEZADO_VARIANTE_ICONO, type VarianteIconoRuta } from "@/lib/config/metadata-tienda";

// ── EL ÍCONO DE LA PESTAÑA POR RUTA LITERAL (§ FAVICON-RUTA-POR-TIENDA-1) ──────────────────────
//
// Cierra el open-followup `METADATA-FAVICON-PROBE-CIEGO-1` (METADATA-ICONOS-Y-LANG-POR-TIENDA-1):
// un navegador (o iOS, pidiendo el ícono para "Agregar a pantalla de inicio") solicita estas TRES
// rutas LITERALES sin leer el `<link rel="icon">`/`apple-touch-icon` del `<head>` — así que una
// tienda con su propio ícono (`content.logo.icono`) seguía mostrando el estático de Nayoli en la
// pestaña real, aunque el `<link>` ya apuntara al suyo (§ `(storefront)/layout.tsx`, el LÍMITE
// CONOCIDO que ese slice dejó anotado).
//
// Se REESCRIBEN (rewrite — el navegador NO ve cambiar la URL, a diferencia de un redirect) hacia
// `/api/icono-tienda`, que decide con una consulta a `SiteContent` (§ ese route handler). No hay
// riesgo de loop: el destino (`/api/icono-tienda`) nunca es una clave de este mapa, así que el
// rewrite no puede volver a entrar acá. No se puede borrar ni mover `public/favicon.ico` ni
// `public/apple-icon.png` (fuera de alcance de este slice) y un archivo de `public/` con el mismo
// path que una ruta de `app/` choca en Next — por eso la decisión vive en OTRO path, nunca en
// estos tres.
//
// La variante viaja por HEADER de request (`ENCABEZADO_VARIANTE_ICONO`), NUNCA por query param en
// la URL del rewrite — medido contra el dev server real: un `?variante=` ahí no le llegaba al route
// handler (`request.nextUrl.searchParams` resolvía siempre a la primera variante usada, sin importar
// cuál). Mismo mecanismo que ya usa este archivo para el modo editor (abajo,
// `NextResponse.next({ request: { headers } })`), aplicado acá vía `NextResponse.rewrite(destino, {
// request: { headers } })`.
const RUTA_A_VARIANTE_ICONO: Record<string, VarianteIconoRuta> = {
  "/favicon.ico": "favicon",
  "/apple-touch-icon.png": "apple",
  "/apple-touch-icon-precomposed.png": "apple",
};

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const varianteIcono = RUTA_A_VARIANTE_ICONO[pathname];
  if (varianteIcono) {
    const headersIcono = new Headers(request.headers);
    headersIcono.set(ENCABEZADO_VARIANTE_ICONO, varianteIcono);
    return NextResponse.rewrite(new URL("/api/icono-tienda", request.url), {
      request: { headers: headersIcono },
    });
  }

  if (pathname.startsWith("/admin") || pathname.startsWith("/editor")) {
    const session = getSessionCookie(request);

    // LA SESIÓN VA PRIMERO, sin cambios: sin cookie, cualquier `/admin/*` o
    // `/editor/*` (§ EDITOR-TIENDA-DISPOSITIVOS-1 — el editor de pantalla completa
    // exige EXACTAMENTE el mismo acceso que el panel, § `lib/admin/acceso-admin.ts`)
    // sigue yendo a `/login`. Es sólo el pre-chequeo BARATO (lee la cookie, no
    // consulta la base); el gate AUTORITATIVO sigue siendo el layout del servidor.
    // Poner el redirect de la ruta retirada antes sólo cambiaría a qué URL llega
    // alguien que de todos modos va a rebotar al login.
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // ── LAS PANTALLAS RETIRADAS ────────────────────────────────────────────────
    //
    // `/admin/ordenes` murió y `/admin/pedidos` habla otro vocabulario de URL; lo
    // mismo pasó con la Clientes vieja y con la Productos vieja, cuyas rutas heredó
    // el rediseño, con Entregas (que se fundió en Pedidos), y con la subruta
    // `/configuracion/usuarios` (la pantalla de equipo subió a `/admin/configuracion`).
    // La TRADUCCIÓN vive en `lib/redirect-{ordenes,clientes,productos,inventario,entregas,config}`
    // —puras y con sus tests de capa 1— y acá sólo se las llama: el mapeo es la
    // decisión, esto es plomería. Son módulos SEPARADOS porque no comparten nada
    // salvo esta mecánica; fusionarlos daría un helper que tiene que conocer los
    // vocabularios de todos para decidir cuál aplica.
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
    // SON SEIS y se llaman uno tras otro. El orden da igual y eso está AFIRMADO, no
    // supuesto: los tests de los redirects recorren las rutas de los retiros
    // comprobando que ninguna caiga en más de uno (`redirect-config.test.ts` incluye
    // a los seis). Sin ese test, el día que un mapeo se ensanche el síntoma sería un
    // redirect que gana por estar escrito antes.
    //
    // INVENTARIO tiene un matiz único: su `?stock=bajo-minimo` sale de la sección
    // hacia `/admin/productos?f=reponer` (la cola de reposición se mudó allá). Ese
    // destino es de OTRO retiro, así que la cadena podría, en principio, re-capturarlo
    // — no lo hace (es la ruta pelada de Productos, pasa en `null`). El mismo test
    // afirma el destino FINAL, no sólo la disjunción: la cadena converge en dos
    // pasadas, sin loop.
    const destino =
      destinoDesdeOrdenes(pathname, request.nextUrl.searchParams) ??
      destinoDesdeClientes(pathname, request.nextUrl.searchParams) ??
      destinoDesdeProductos(pathname, request.nextUrl.searchParams) ??
      destinoDesdeInventario(pathname, request.nextUrl.searchParams) ??
      destinoDesdeEntregas(pathname, request.nextUrl.searchParams) ??
      destinoDesdeConfig(pathname, request.nextUrl.searchParams);
    if (destino) return NextResponse.redirect(new URL(destino, request.url), 307);

    return NextResponse.next();
  }

  // ── EL MODO EDITOR DEL STOREFRONT (§ MODO-EDITOR-SOLO-EN-EL-IFRAME-1) ──────────
  //
  // El iframe de `/admin/tienda` carga la página real con `?editor=1`
  // (`urlDePaginaEnEditor`, `lib/admin/editor-iframe.ts`). En Next 16 un LAYOUT no
  // recibe `searchParams` (sólo `page.tsx` los recibe, y el gate real vive en
  // `app/(storefront)/layout.tsx` — tiene que cubrir TODA la página, no sólo su
  // `page.tsx`), así que el parámetro por sí solo no le llega al gate. Acá se
  // TRADUCE a un header de REQUEST (`x-editor-modo`), que SÍ atraviesa `headers()`
  // en cualquier Server Component de la misma request — layout incluido
  // (§ `modo-editor-gate.ts`, `modoEditorActivo`).
  //
  // El parámetro NUNCA es la credencial — sólo el flag. `modoEditorActivo()`
  // revalida la sesión (OWNER/MANAGER activo) EN CADA request antes de servir el
  // borrador; sin esa sesión, el header no sirve de nada. Lo único que este bloque
  // decide es si la marca VIAJA, nunca si se CONCEDE algo.
  //
  // COSTO MÍNIMO para el caso común (sin el parámetro, que es el 100% del tráfico
  // público): dos chequeos baratos (`has`/`get`) y, si ninguno aplica, el MISMO
  // `NextResponse.next()` de siempre — sin clonar headers. Sólo se clona cuando hay
  // algo que cambiar: el parámetro viene puesto, O el cliente ya traía el header
  // (caso raro, pero hay que neutralizarlo — ver abajo).
  const marcaDelCliente = request.headers.has(ENCABEZADO_MODO_EDITOR);
  const pideModoEditor = request.nextUrl.searchParams.get(PARAM_MODO_EDITOR) === VALOR_MODO_EDITOR;
  if (!marcaDelCliente && !pideModoEditor) {
    return NextResponse.next();
  }

  // El header SE RECONSTRUYE siempre que se toca esta rama: si el CLIENTE ya lo
  // traía (alguien mandando `x-editor-modo` a mano, sin pasar por el iframe), se
  // BORRA antes de decidir — la única fuente válida es el parámetro de ESTA
  // request, nunca lo que el request entrante ya diga. Después se vuelve a poner
  // SÓLO si el parámetro vino.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(ENCABEZADO_MODO_EDITOR);
  if (pideModoEditor) {
    requestHeaders.set(ENCABEZADO_MODO_EDITOR, VALOR_MODO_EDITOR);
  }
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // `/editor(.*)` (§ EDITOR-TIENDA-DISPOSITIVOS-1): el editor de pantalla completa vive fuera de
  // `/admin/*` (su propio layout, sin `AdminChrome`), pero exige el MISMO pre-chequeo de sesión que
  // el panel — sin esto, un visitante sin cookie llegaría hasta el layout del servidor antes de
  // rebotar, en vez del bounce barato que `/admin(.*)` ya da.
  //
  // Las tres rutas del storefront son las que el iframe de `/editor/tienda` puede cargar
  // (`urlDePagina`, `lib/admin/editor-iframe.ts`: home/nosotros/suscripciones — antes las cargaba
  // `/admin/tienda`, que se mudó). No hace falta un patrón más ancho: el modo editor sólo se activa
  // donde el iframe navega a propósito, y cualquier desvío dentro del iframe vuelve ahí solo
  // (`VistaTiendaIframe.tsx`, el vigía de ruta) — nunca por un `?editor=1` colado en otra ruta.
  //
  // Las TRES últimas son `RUTA_A_VARIANTE_ICONO` (§ FAVICON-RUTA-POR-TIENDA-1, arriba):
  // literales exactos, no un patrón — un matcher no puede matchear "por archivo público", y
  // ampliarlo más de lo que ese mapa nombra dejaría pasar requests que no van a ese bloque.
  matcher: [
    "/admin(.*)",
    "/editor(.*)",
    "/",
    "/nosotros",
    "/suscripciones",
    "/favicon.ico",
    "/apple-touch-icon.png",
    "/apple-touch-icon-precomposed.png",
  ],
};
