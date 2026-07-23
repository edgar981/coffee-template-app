import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: false,
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
