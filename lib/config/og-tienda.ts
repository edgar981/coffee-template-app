import type { Metadata } from "next";

// LA VISTA PREVIA AL COMPARTIR (WhatsApp, redes) — § OG-IMAGEN-TIENDA-1 (2026-10-01). Sin `og:image`, un
// enlace a la tienda compartido por WhatsApp sale sólo con texto. Se emite sólo bajo CORTE (las tiendas
// cliente de hoy); fuera de CORTE devuelve `{}` y el `<head>` queda byte-idéntico (Nayoli). La imagen es
// la del hero (el póster del video, o la imagen de fondo si el hero es imagen), que ya es absoluta (Blob).
export function openGraphDeTienda(entrada: {
  esCorte: boolean;
  nombre: string;
  descripcion: string;
  imagenPoster: string;
  imagen: string;
}): Pick<Metadata, "openGraph"> {
  if (!entrada.esCorte) return {};
  const imagen = (entrada.imagenPoster || entrada.imagen || "").trim();
  if (!/^https?:\/\//.test(imagen)) return {};
  return {
    openGraph: {
      type: "website",
      locale: "es_CO",
      siteName: entrada.nombre,
      title: entrada.nombre,
      description: entrada.descripcion,
      images: [{ url: imagen, alt: entrada.nombre }],
    },
  };
}
