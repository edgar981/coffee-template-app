import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Café Nayoli",
    short_name: "Nayoli",
    description:
      "Café de especialidad de la Finca Nayoli — Supatá, Cundinamarca.",
    start_url: "/",
    display: "standalone",
    background_color: "#F9F6F4",
    theme_color: "#1E150E",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
