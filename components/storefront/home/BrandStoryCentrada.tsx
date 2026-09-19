"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { fadeUp } from "@/lib/animation";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";

// LA VARIANTE "CENTRADA" (§ CORTE-BRANDSTORY-COLLAGE-1, MEDIDA contra la sección `.historia` de
// `docs/prototipos/cafeone/index.html:250-273` + `css/app.css:561-578`). El BrandStory de siempre
// (`BrandStoryColumnas`) es a dos columnas — texto de un lado, collage del otro—; ésta es CENTRADA y
// en CAPAS: eyebrow + título grandes al medio, el collage de figuras A LO ANCHO debajo, y el párrafo
// cerrando abajo. Mismos siete campos de contenido (eyebrow/titulo/parrafo1/parrafo2/imagen1..4),
// mismo gate de visibilidad en el DISPATCHER (`BrandStory.tsx`) — lo que cambia es de qué esqueleto
// está hecha la banda.
//
// LA CARDINALIDAD DIFIERE DEL PROTOTIPO, A PROPÓSITO: el `.collage` del prototipo dibuja TRES
// figuras; nuestro modelo (`BrandStoryContent`) sólo tiene CUATRO imágenes (`imagen1..4`), las
// mismas que ya usa `BrandStoryColumnas` — no se inventa un quinto campo ni se descarta una de las
// cuatro para calzar el número del prototipo. Las CUATRO se muestran en fila, alternando el offset
// vertical (mismos valores que ya usa `BrandStoryColumnas` para su 2×2 — no se inventa una escala
// nueva) para reproducir el escalonado del prototipo con la cardinalidad que el modelo sí tiene.
//
// LO QUE EL PROTOTIPO TIENE Y ESTA VARIANTE NO PUEDE EXPRESAR (medido, no improvisado con texto fijo):
//   1. El CTA "Nuestra historia" → #origen (`index.html:270`). `BrandStoryContent` no declara ningún
//      campo de link/label para esta sección —ni la canónica `BrandStoryColumnas` lo tiene: la home
//      lleva el ANZUELO, sin CTA propio (§ site-content-defaults.ts, "LA PÁGINA /nosotros")—. Agregar
//      uno sería escritura de esquema, fuera de este slice. Se construye SIN el botón.
//   2. El PARALLAX de scroll del prototipo (`js/home.js:284-301`, `FSA.scrub`): cada figura rota y se
//      desplaza en función del progreso de scroll de la sección, vía un motor de scroll-scrub propio
//      que este repo no tiene. Se aproxima con una entrada en CAPAS por `whileInView` (framer-motion,
//      ya en uso en el resto del storefront) — asienta con una leve rotación que se endereza al
//      entrar en vista, sin el motor de scrub continuo del prototipo.
const IMAGENES = [
  { campo: "imagen1", alt: "Una taza de café servida sobre una mesa de madera, con granos alrededor", offset: "", rotar: -4 },
  { campo: "imagen2", alt: "Cerezas de café secándose extendidas sobre una malla", offset: "sm:mt-8", rotar: 3 },
  { campo: "imagen3", alt: "Las manos de un recolector mostrando cerezas rojas sobre su canasto", offset: "sm:-mt-4", rotar: -3 },
  { campo: "imagen4", alt: "Una rama de cafeto con los granos todavía verdes", offset: "sm:mt-4", rotar: 4 },
] as const;

export default function BrandStoryCentrada({ style }: { style?: React.CSSProperties } = {}) {
  const { brandStory } = useSiteContent();
  const preview = useIsPreview();

  // Mismo switch que `BrandStoryColumnas` (§ ahí, el razonamiento completo): en la vista previa
  // escalada del panel, `whileInView` no dispara —la intersección con el viewport no llega dentro
  // del contenedor con `transform: scale`—, así que se cambia a `animate` con `initial={false}`:
  // el elemento descansa en su estado visible desde el primer render.
  return (
    <section id="nuestra-historia" className="overflow-hidden bg-[var(--sf-banda,var(--sf-tinta))] py-24" style={style}>
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <motion.div
          initial={preview ? false : "hidden"}
          animate={preview ? "visible" : undefined}
          whileInView={preview ? undefined : "visible"}
          viewport={preview ? undefined : { once: true }}
          variants={fadeUp}
        >
          {/* Mismos tokens que `BrandStoryColumnas` (§ ahí, el razonamiento completo de contraste):
              `--sf-sobre-banda`/`--sf-sobre-banda-suave` con los mismos fallbacks, sólo que acá
              centrados en vez de alineados a la izquierda. */}
          {brandStory.eyebrow && (
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-[var(--sf-sobre-banda,var(--sf-tostado))]">
              {brandStory.eyebrow}
            </p>
          )}
          <h2 className="font-playfair text-4xl leading-tight text-[var(--sf-sobre-banda,white)] sm:text-5xl">
            {brandStory.titulo}
          </h2>
        </motion.div>

        {/* El collage A LO ANCHO — cuatro figuras en fila, con offset vertical alternado y una leve
            rotación que se endereza al entrar en vista (§ el hallazgo del parallax, arriba). */}
        <div className="mt-16 mb-16 flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          {IMAGENES.map(({ campo, alt, offset, rotar }, i) => (
            <motion.div
              key={campo}
              initial={preview ? false : { opacity: 0, rotate: rotar, y: 16 }}
              animate={preview ? { opacity: 1, rotate: 0, y: 0 } : undefined}
              whileInView={preview ? undefined : { opacity: 1, rotate: 0, y: 0 }}
              viewport={preview ? undefined : { once: true }}
              transition={preview ? undefined : { duration: 0.6, delay: i * 0.08 }}
              className={`relative aspect-[3/4] w-[42%] overflow-hidden rounded-2xl shadow-xl sm:w-40 lg:w-52 ${offset}`}
            >
              <Image
                src={brandStory[campo]}
                alt={alt}
                fill
                sizes="(max-width: 640px) 42vw, (max-width: 1024px) 160px, 208px"
                className="object-cover"
              />
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={preview ? false : "hidden"}
          animate={preview ? "visible" : undefined}
          whileInView={preview ? undefined : "visible"}
          viewport={preview ? undefined : { once: true }}
          variants={fadeUp}
          className="mx-auto max-w-2xl"
        >
          <p className="text-base leading-relaxed text-[var(--sf-sobre-banda-suave,color-mix(in_oklab,white_60%,transparent))]">
            {brandStory.parrafo1}
          </p>
          {brandStory.parrafo2 && (
            <p className="mt-6 text-base leading-relaxed text-[var(--sf-sobre-banda-suave,color-mix(in_oklab,white_60%,transparent))]">
              {brandStory.parrafo2}
            </p>
          )}
        </motion.div>
      </div>
    </section>
  );
}
