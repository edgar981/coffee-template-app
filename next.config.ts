import type { NextConfig } from "next";

// Ver el comentario grande sobre `headers()` más abajo para el porqué completo de esta
// condición. Se extrae como función NOMBRADA (y no se deja inline en `headers()`) para que
// `instrumentation.ts` la reuse sin reinventar una segunda noción de "es demo" — dos
// definiciones del mismo hecho es cómo terminan divergiendo (§ CLAUDE.md, Backlog #39).
export function esDespliegueDemo(): boolean {
  return process.env.VERCEL_ENV !== "production" || process.env.NOINDEX === "1";
}

const nextConfig: NextConfig = {
  /* config options here */
  // Los dos paquetes del workspace envían TS/TSX FUENTE, no build: @duna/core
  // (schema/cliente Prisma + data-access) y @duna/design-system (primitivas
  // React + `status.ts`). Next debe transpilarlos; sin esto el build de
  // producción no compila el paquete. OBLIGATORIO (ver CLAUDE.md § Fase A /
  // monorepo).
  //
  // Ojo con el modo de falla del design-system: `dev` puede compilar igual y el
  // que se cae es el BUILD, o sea el preview de Vercel, no la verificación
  // local. Deuda condicional Fase B: si con dos apps el build se vuelve lento,
  // darles un build step propio.
  transpilePackages: ['@duna/core', '@duna/design-system'],
  devIndicators: false,
  images: {
    // Imágenes de producto subidas desde el admin. Viven en el store de Vercel
    // Blob, cuyo host es `<storeId>.public.blob.vercel-storage.com` — el store
    // es PÚBLICO por decisión (ver "Storage de imágenes de producto" en
    // CLAUDE.md), así que el optimizador puede leerlas sin credenciales.
    // El wildcard cubre el store actual y cualquiera futuro de la misma cuenta;
    // si el proveedor cambia (R2), esto se cambia junto con lib/storage.ts.
    remotePatterns: [
      { protocol: 'https', hostname: '**.public.blob.vercel-storage.com' },
    ],
  },
  // El noindex se emite fuera de PRODUCCIÓN (previews) y en cualquier deploy que lo
  // PIDA con `NOINDEX=1` — la DEMO de Nayoli es env `production` pero NO debe indexarse,
  // así que setea esa var. La PRODUCCIÓN de un cliente real NO lo emite (deja `NOINDEX`
  // sin poner): debe ser indexable, y ése era el defecto que se corrige —un cliente
  // nacía INVISIBLE porque el header cubría también producción—. El default seguro es
  // "indexable en producción" para que un cliente que no configure nada no quede oculto;
  // ocultar es el opt-in (demos). Un header cubre TODA respuesta (HTML, API, assets,
  // redirects), a diferencia de un <meta> que solo aplica a documentos HTML.
  //
  // AHORA GOBIERNA DOS COSAS (owner, 2026-09-15, `PASARELA-LLAVES-COHERENTES-1`): además
  // de decidir si se emite el header noindex, `esDespliegueDemo()` decide en
  // `instrumentation.ts` si el servidor puede arrancar con la llave pública PRODUCTIVA de
  // la pasarela de pagos (`WOMPI_PUBLIC_KEY`) — ver CLAUDE.md § Pagos en línea (Wompi).
  // CONSECUENCIA: quien retire `NOINDEX` de acá por una razón de SEO está desarmando
  // TAMBIÉN ese chequeo. Leé `instrumentation.ts` antes de tocar esta función.
  async headers() {
    const ocultarDeBuscadores = esDespliegueDemo();
    return [
      ...(ocultarDeBuscadores
        ? [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }]
        : []),
      // (Se retiró la regla propia de `?preview`: existía para el iframe de /admin/tienda,
      //  ya retirado. La vista previa ahora renderiza componentes en el panel, sin URL pública.)

      // ── ICONOS DE MARCA DEL STOREFRONT · Cache-Control corto ──────────────────
      // Son los iconos PER-CLIENTE (favicon, PWA, apple-touch). Hoy son los de Nayoli;
      // un segundo cliente los REEMPLAZA como asset por-despliegue. Sin esta regla, un
      // reemplazo quedaría cacheado eterno.
      //
      // La regla va sobre la URL del ARCHIVO, no sobre una ruta aparte, y eso es
      // deliberado: cubre a la vez el `<link rel=icon>` Y el probe CIEGO a /favicon.ico
      // —crawlers y algunos navegadores lo piden sin mirar el `<link>`—. Los dos comparten
      // esta misma URL, así que la "puerta de atrás" del caché eterno queda cerrada por
      // construcción. Una ruta /api/favicon separada dejaría el probe sobre el estático
      // (puerta abierta) salvo rewrite + borrar el estático — más piezas para el mismo fin.
      //
      // max-age=3600 (1h): un favicon cambia rarísimo (rebranding, onboarding), así que 1h
      // de propagación alcanza, y 1h de caché toca el archivo ≤1 vez/hora/visitante, no en
      // cada carga. MATIZ del navegador: muchos cachean el favicon por SESIÓN ignorando el
      // header —límite del navegador, no del server—; 3600 es la señal correcta para CDN,
      // crawlers y los que sí lo respetan, y el resto lo refresca al reabrir.
      //
      // POR QUÉ NO UNA RUTA /api/favicon: con assets ESTÁTICOS por-despliegue no hay URL de
      // blob, así que el motivo de la ruta —no fijar una URL de blob que se cachea sola—
      // no aplica. La ruta se gana su lugar SÓLO cuando el favicon se vuelva SUBIBLE desde
      // el panel (décimo cliente): ahí el `<link>` no puede apuntar a un blob sin
      // reintroducir el caché eterno, y la ruta (URL estable + caché corto) es la
      // indirección necesaria. Hasta entonces, headers() sobre el estático es más simple.
      //
      // Los iconos del ADMIN (/brand/*-duna.*) NO van acá: son de Duna, constantes entre
      // despliegues, así que su caché normal está bien.
      {
        source: "/:icon(favicon\\.ico|icon\\.svg|apple-icon\\.png|icon-192\\.png|icon-512\\.png|icon-512-maskable\\.png)",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600" }],
      },

      // ── CSP REPORT-ONLY DE /checkout — mide la línea base, no bloquea nada ──────
      // `Content-Security-Policy-Report-Only` REPORTA violaciones a la consola del navegador
      // y NUNCA impide una carga — a diferencia de `Content-Security-Policy` a secas, que sí
      // bloquearía. Por eso puede entrar HOY, sin auditar cada script del checkout uno por
      // uno: si la política está mal escrita, el peor caso es una consola ruidosa, no una
      // venta rota.
      //
      // ENTRA ANTES DEL WIDGET DE PAGO, A PROPÓSITO. Una política se estrena rompiendo
      // cosas; estrenarla el mismo día que se integra el widget mezclaría dos fuentes de
      // fallo en un solo deploy, y ninguna de las dos se podría señalar sola. Report-Only
      // mide la línea base REAL del checkout —lo que YA carga hoy, sin Wompi— antes de que
      // exista un widget que la enturbie. `CLAUDE.md` § Pagos en línea (Wompi) documenta el
      // resto del camino a la pasarela; esto es sólo el piso de observación.
      //
      // ALCANCE: sólo `/checkout` (un solo `page.tsx`, sin subrutas — verificado). NO es
      // global: una política global rompería el admin (Radix, next-themes con su propio
      // scope, el editor de bloques) y agregaría superficie que nadie está midiendo acá.
      //
      // ══════ EL HALLAZGO QUE CAMBIA LA NATURALEZA DE LA DECISIÓN WIDGET-VS-REDIRECCIÓN ══════
      // ADOPTAR EL WIDGET DE WOMPI NO ES ADOPTAR UN SCRIPT DE TERCEROS: SON HASTA TRES, Y DOS
      // NO ESTÁN DOCUMENTADOS EN NINGÚN LADO DE SU DOC PÚBLICA. El `widget.js` de Wompi
      // inyecta en runtime `cdn.siftscience.com` y `device.clearsale.com.br` — antifraude y
      // *device fingerprinting* — y el dashboard del comercio NO ofrece forma de verlos ni de
      // apagarlos: son infraestructura del PROVEEDOR, decidida por su backend. No podemos
      // saber si están activos hoy, y si Wompi los enciende mañana, una política que no los
      // contemple ROMPERÍA EL CHECKOUT sin que nadie sepa por qué. Por eso entran en
      // `script-src` DESDE AHORA, aunque hoy nada los cargue: incluirlos cuesta dos líneas;
      // excluirlos apuesta a un comportamiento de un proveedor que ya contradijo su propia
      // doc cinco veces (ver `DECISIONS.md`, `WOMPI-REGLAS-IMPLEMENTACION-1`).
      // ═══════════════════════════════════════════════════════════════════════════════════
      {
        source: "/checkout",
        headers: [
          {
            key: "Content-Security-Policy-Report-Only",
            value: [
              // 'self' + Web Checkout de Wompi (aún no cargado) + los dos terceros de
              // antifraude que Wompi inyecta sin avisar (ver el hallazgo arriba).
              // 'unsafe-inline' es por `next-themes`: inyecta su script anti-flash de tema
              // inline (`StorefrontThemeProvider`, sin nonce) en TODO el storefront, con o
              // sin Wompi de por medio — una política que se declara estricta y lo lleva
              // igual es peor que una que admite lo que hace.
              "script-src 'self' https://checkout.wompi.co https://cdn.siftscience.com https://device.clearsale.com.br 'unsafe-inline'",
              // 'self' + Google Fonts (el `@import` de `app/globals.css`). 'unsafe-inline'
              // por los TRES `<style dangerouslySetInnerHTML>` del layout del storefront
              // (paleta, fuentes, forma — `app/(storefront)/layout.tsx`), sin nonce.
              "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'",
              // Los archivos de fuente que sirve Google Fonts tras el @import de arriba.
              "font-src 'self' https://fonts.gstatic.com",
              // Imágenes de producto: el store de Vercel Blob (§ Storage de imágenes,
              // CLAUDE.md) es el único origen externo medido; no hay `data:` en uso hoy.
              "img-src 'self' https://*.public.blob.vercel-storage.com",
              // El dominio del Web Checkout de Wompi está medido; su PATH no — Wompi lo arma
              // en runtime — así que no se acota más que al origen.
              "frame-src https://checkout.wompi.co",
              // Nada del checkout de hoy llama a un origen externo (createOrder es un fetch
              // same-origin a /api/checkout): sin el widget integrado, lo medido es 'self'.
              "connect-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              // 'self' + Web Checkout de Wompi. El Web Checkout es un `<form
              // action="https://checkout.wompi.co/p/" method="GET">` que NAVEGA fuera del
              // sitio — ese `<form>` no existe todavía, así que hoy esto no cambia nada
              // observable. Pero la política ya está escrita, y `form-action 'self'` a secas
              // BLOQUEARÍA ese submit el día que la CSP deje de ser Report-Only. Escribirla
              // ahora, antes de que el `<form>` exista, es la única forma de que la política
              // enforced no rompa el checkout sin que nadie recuerde por qué.
              "form-action 'self' https://checkout.wompi.co",
            ].join("; "),
          },
        ],
      },
    ];
  },
  async redirects() {
    // Sin redirects hardcodeados: los dos de "1 lb → 500 g" eran de la DEMO de Nayoli
    // (slugs viejos que ningún deploy indexado tuvo —el noindex estuvo siempre puesto—),
    // así que un cliente nuevo no debe heredarlos. Un redirect por-cliente, si algún día
    // hiciera falta, sería data-driven, no un literal en el código compartido.
    return [];
  },
};

export default nextConfig;
