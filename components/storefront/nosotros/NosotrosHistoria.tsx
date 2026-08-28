"use client";

import { motion } from "framer-motion";
import { fadeUp } from "@/lib/animation";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";

// La HISTORIA LARGA de /nosotros. Sólo texto —la galería variable es su propia sección (tanda 2)—.
// `eyebrow` y `parrafo2/3` son opcionales → se omiten vacíos; `titulo` y `parrafo1` vienen resueltos.
// Preview ESTÁTICO (`whileInView`→`animate` con `initial={false}`), como las secciones de la home,
// para que la vista en vivo del editor (tanda 1, commit 3) no lo deje invisible.
export default function NosotrosHistoria() {
  const { nosotrosHistoria } = useSiteContent();
  const preview = useIsPreview();
  const { eyebrow, titulo, parrafo1, parrafo2, parrafo3 } = nosotrosHistoria;
  const parrafos = [parrafo1, parrafo2, parrafo3].filter(p => p.trim() !== "");

  return (
    <section className="py-24 bg-[var(--sf-fondo)]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={preview ? false : "hidden"}
          animate={preview ? "visible" : undefined}
          whileInView={preview ? undefined : "visible"}
          viewport={preview ? undefined : { once: true }}
          variants={fadeUp}
        >
          {eyebrow && <p className="text-[var(--sf-acento-texto)] text-xs font-medium tracking-[0.2em] uppercase mb-3">{eyebrow}</p>}
          {/* h1: es el encabezado principal de la PÁGINA (la home usa h2 por sección). */}
          <h1 className="text-4xl sm:text-5xl font-playfair text-[var(--sf-tinta)] leading-tight mb-8">{titulo}</h1>
          <div className="space-y-6">
            {parrafos.map((p, i) => (
              <p key={i} className="text-[var(--sf-acento-2)]/80 leading-relaxed text-lg">{p}</p>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
