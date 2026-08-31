import type { NextConfig } from "next";

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
  async headers() {
    const ocultarDeBuscadores =
      process.env.VERCEL_ENV !== "production" || process.env.NOINDEX === "1";
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
