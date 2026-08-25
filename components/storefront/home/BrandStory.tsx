"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { fadeUp } from "@/lib/animation";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { REGISTRY, seccionEsVisible } from "@/lib/config/site-content-defaults";

// "Nuestra Historia" — lee el CONTENIDO de SiteContent (loader SOFT): titulo, parrafo1 y las
// cuatro imágenes son requeridos (vienen resueltos, con default si estaban vacíos); eyebrow y
// parrafo2 son OPCIONALES → se OMITEN si vienen vacíos (no caen al default). El h2 es UN campo:
// el salto de línea de antes era estético (`<br/>`), ahora el título envuelve solo.
//
// PRIMERA sección OCULTABLE: si `visible=false`, no se renderiza (self-gate). La home la rinde
// como hermano plano (sin envoltorio ni separador), así que devolver null no deja hueco.
const IMAGENES = [
  { campo: "imagen1", alt: "Café",    offset: "" },
  { campo: "imagen2", alt: "Tostado", offset: "mt-8" },
  { campo: "imagen3", alt: "Finca",   offset: "-mt-4" },
  { campo: "imagen4", alt: "Barista", offset: "mt-4" },
] as const;

export default function BrandStory() {
  const { brandStory } = useSiteContent();
  if (!seccionEsVisible(REGISTRY.brandStory, brandStory)) return null;

  return (
    <section id="nuestra-historia" className="py-24 bg-[#1a0f08]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
          >
            {brandStory.eyebrow && (
              <p className="text-[#d4a97a] text-xs font-medium tracking-[0.2em] uppercase mb-4">
                {brandStory.eyebrow}
              </p>
            )}
            <h2 className="text-4xl sm:text-5xl font-playfair text-white leading-tight mb-6">
              {brandStory.titulo}
            </h2>
            <p className="text-white/60 leading-relaxed mb-6 text-base">
              {brandStory.parrafo1}
            </p>
            {brandStory.parrafo2 && (
              <p className="text-white/60 leading-relaxed mb-8 text-base">
                {brandStory.parrafo2}
              </p>
            )}
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="grid grid-cols-2 gap-4"
          >
            {IMAGENES.map(({ campo, alt, offset }) => (
              <div key={campo} className={`relative h-48 overflow-hidden rounded-2xl ${offset}`}>
                <Image
                  src={brandStory[campo]}
                  alt={alt}
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className="object-cover"
                />
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
