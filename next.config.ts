import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // @duna/core envía TS fuente (schema/cliente Prisma + data-access). Next debe
  // transpilarlo; sin esto el build de producción no compila el paquete de
  // workspace. OBLIGATORIO (ver CLAUDE.md § Fase A / monorepo). Deuda condicional
  // Fase B: si con dos apps el build se vuelve lento, darle a core un build step.
  transpilePackages: ['@duna/core'],
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
  // DEMO: mantener todo el sitio fuera de los buscadores. Un header cubre TODA
  // respuesta (HTML, API, assets, redirects), a diferencia de un <meta> que solo
  // aplica a documentos HTML. Quitar cuando se promueva a producción real.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
  async redirects() {
    // Slugs antiguos "1 lb" → "500 g" (renombrados en catálogo).
    return [
      { source: "/tienda/cafe-nayoli-grano-1lb",  destination: "/tienda/cafe-nayoli-grano-500g",  permanent: true },
      { source: "/tienda/cafe-nayoli-molido-1lb", destination: "/tienda/cafe-nayoli-molido-500g", permanent: true },
    ];
  },
};

export default nextConfig;
