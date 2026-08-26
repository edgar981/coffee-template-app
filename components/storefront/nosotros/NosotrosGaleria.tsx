"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { fadeUp } from "@/lib/animation";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { REGISTRY, seccionEsVisible } from "@/lib/config/site-content-defaults";

// Una celda de VÍDEO de la galería. NO usa el atributo `autoplay` —medido: `preload="none"` + autoplay
// se contradicen y Chrome DESCARGA igual, y estar fuera del fold TAMPOCO lo difiere; con el atributo,
// los 3 vídeos de la galería bajarían al cargar la página—. En su lugar: `preload="none"` + un
// IntersectionObserver que hace `.play()` al ENTRAR al viewport (ahí recién dispara la carga) y
// `.pause()` al salir. Así la descarga se difiere a cuando se scrollea al vídeo, y —clave— en móvil el
// masonry es de UNA columna, así que sólo 1–2 vídeos están en el viewport a la vez (no 3): la
// concurrencia queda acotada por la estructura, no por rastrear "el más visible".
//
// - PÓSTER a la proporción del VÍDEO: la celda fija `aspect-ratio` con las dims GUARDADAS (que son las
//   del vídeo, § el modelo), y el `<video>` va `object-cover` → el póster ocupa el MISMO espacio con
//   esa proporción (no la suya), así el masonry NO salta cuando el vídeo carga.
// - `muted` se fija por REF (el prop de React no siempre llega al atributo del DOM, y iOS bloquea el
//   autoplay sin él).
// - PREFERS-REDUCED-MOTION: un vídeo que arranca solo ES movimiento. Con esa preferencia NO se
//   auto-reproduce —se queda en el póster con `controls`, para que el usuario reproduzca si QUIERE
//   (un play iniciado por el usuario es legítimo aun con reduced-motion)—. En el preview del editor,
//   el póster sin controls (vista limpia).
function VideoCelda({ src, poster, alt }: { src: string; poster?: string; alt: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const preview = useIsPreview();
  const reduce = useReducedMotion();
  const reproducirEnVista = !preview && !reduce;

  useEffect(() => {
    const v = ref.current;
    if (!v || !reproducirEnVista) return;
    v.muted = true;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => (e.isIntersecting ? v.play().catch(() => {}) : v.pause())),
      { threshold: 0.2 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [reproducirEnVista]);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="none"
      controls={!!reduce && !preview}
      aria-label={alt}
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}

// La GALERÍA de /nosotros — la 2ª sección REPEATER, y la que estrena el tipo `imagen` por ítem. Un
// encabezado OPCIONAL (eyebrow/titulo → se omiten vacíos) sobre un MASONRY de fotos: aquí la galería
// ES el contenido, no un adorno, así que no hay patrón por rangos —las fotos no compiten—. OCULTABLE
// + hide-on-empty: sin fotos, self-gate → null.
//
// MASONRY (CSS columns), NO grid con recorte al cuadrado: el recorte decidiría por el dueño qué parte
// de su foto importa —una panorámica sin sus lados deja de serlo—. Cada celda toma la proporción
// NATURAL de su foto (`w`/`h`, capturadas en la subida); nada se recorta. Sin dims (foto vieja o no
// medible) cae a 4/3.
//
// ORDEN POR COLUMNA — DECISIÓN, no descuido: CSS `columns` llena la 1ª columna de arriba a abajo,
// luego la 2ª, así que el orden fluye por COLUMNA, no por fila. Es aceptable en una galería (no hay
// secuencia narrativa). Si algún día se espera orden por FILAS, ESTO es lo que hay que cambiar (a un
// grid-masonry por JS o una lib), no un ajuste de estilos. En MÓVIL (una columna, `columns-1`) el
// orden vuelve a ser EXACTAMENTE el del array.
//
// `next/image` con `fill`: LAZY-LOAD de fábrica (las de abajo del fold no descargan hasta acercarse),
// así el peso inicial no crece con N; el tope (12) es de curaduría, no técnico. Preview ESTÁTICO
// (`initial={false}`), como el resto, para que la vista en vivo del editor no lo deje invisible.
//
// EL `negocio` LLEGA POR PROP (la página server lo pasa desde SiteSettings), NO por
// `useSiteSettings()`: la vista en vivo del editor monta este componente en el árbol del ADMIN, que
// no tiene el SiteSettingsProvider del storefront —usarlo ahí lanzaría—. Sin prop (el preview) el
// alt cae a un fallback genérico, que en un preview no importa.
export default function NosotrosGaleria({ negocio }: { negocio?: string }) {
  const { nosotrosGaleria } = useSiteContent();
  const preview = useIsPreview();
  if (!seccionEsVisible(REGISTRY.nosotrosGaleria, nosotrosGaleria)) return null;

  const { eyebrow, titulo, items } = nosotrosGaleria;
  const medios = items.filter((f) => f.url.trim() !== ""); // defensivo: sin url no se renderiza un ítem
  // Fallback del alt: describe el CONTEXTO, no el índice (§ decisión del owner). El alt del ítem, si
  // el owner lo escribió, manda —es mejor para un lector de pantalla que cualquier genérico—.
  const altFallback = negocio ? `Foto de la galería de ${negocio}` : "Foto de la galería";

  return (
    <section className="py-20 bg-[#faf7f4]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {(eyebrow || titulo) && (
          <motion.div
            initial={preview ? false : "hidden"}
            animate={preview ? "visible" : undefined}
            whileInView={preview ? undefined : "visible"}
            viewport={preview ? undefined : { once: true }}
            variants={fadeUp}
            className="text-center mb-12"
          >
            {eyebrow && <p className="text-[#8B4513] text-xs font-medium tracking-[0.2em] uppercase mb-2">{eyebrow}</p>}
            {titulo && <h2 className="text-3xl font-playfair text-[#1a0f08]">{titulo}</h2>}
          </motion.div>
        )}
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
          {medios.map((f, i) => (
            // El break-inside va en un envoltorio ESTÁTICO; la animación (transform) va dentro, para
            // no mezclar el transform con la regla de corte de columna.
            <div key={i} className="mb-4 break-inside-avoid">
              <motion.div
                initial={preview ? false : "hidden"}
                animate={preview ? "visible" : undefined}
                whileInView={preview ? undefined : "visible"}
                viewport={preview ? undefined : { once: true }}
                variants={fadeUp}
                className="relative overflow-hidden rounded-2xl bg-[#e8ddd0]"
                style={{ aspectRatio: f.w && f.h ? `${f.w} / ${f.h}` : "4 / 3" }}
              >
                {f.tipo === "video" ? (
                  <VideoCelda src={f.url} poster={f.poster} alt={f.alt.trim() || altFallback} />
                ) : (
                  <Image
                    src={f.url}
                    alt={f.alt.trim() || altFallback}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover"
                  />
                )}
              </motion.div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
