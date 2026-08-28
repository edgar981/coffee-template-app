"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { fadeUp } from "@/lib/animation";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { REGISTRY, seccionEsVisible } from "@/lib/config/site-content-defaults";

// "Lo que dicen nuestros clientes" — la 1ª sección REPEATER: encabezado (eyebrow/titulo) + una LISTA
// de testimonios leída de SiteContent. Cada ítem: name/text (requeridos, vienen resueltos), city y
// product (opcionales → se OMITEN vacíos), y `stars`. OCULTABLE + hide-on-empty: con `items` vacío,
// self-gate → null (la home la rinde como hermano plano, sin hueco ni separador).
//
// Los tres testimonios que vivían acá eran FABRICADOS (citaban productos que Nayoli no vende); se
// retiraron del CÓDIGO (§ SiteContent — el repeater). La sección sigue existiendo — vuelve con testimonios REALES cuando
// el owner los cargue como dato por el editor.
export default function TestimonialSection() {
  const { testimonials } = useSiteContent();
  const preview = useIsPreview();
  if (!seccionEsVisible(REGISTRY.testimonials, testimonials)) return null;

  const { eyebrow, titulo, items } = testimonials;

  return (
    <section className="py-20 bg-[var(--sf-fondo)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={preview ? false : "hidden"}
            animate={preview ? "visible" : undefined}
            whileInView={preview ? undefined : "visible"}
            viewport={preview ? undefined : { once: true }}
            variants={fadeUp}
            className="text-center mb-12"
          >
            {eyebrow && <p className="text-[var(--sf-acento-texto)] text-xs font-medium tracking-[0.2em] uppercase mb-2">{eyebrow}</p>}
            <h2 className="text-3xl font-playfair text-[var(--sf-tinta)]">{titulo}</h2>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {items.map((t, i) => {
              // CINCO estrellas (llenas/vacías), no sólo las llenas: un 3 se lee "3 de 5", no tres sueltas.
              const estrellas = Math.max(0, Math.min(5, Math.round(Number(t.stars) || 0)));
              const atribucion = [t.city, t.product].filter(Boolean).join(" · ");
              return (
                <motion.div
                  key={i}
                  initial={preview ? false : "hidden"}
                  animate={preview ? "visible" : undefined}
                  whileInView={preview ? undefined : "visible"}
                  viewport={preview ? undefined : { once: true }}
                  variants={fadeUp}
                  transition={preview ? undefined : { delay: i * 0.1 }}
                  className="bg-white rounded-2xl p-6 shadow-sm border border-[var(--sf-linea)]"
                >
                  <div className="flex gap-1 mb-4">
                    {[1, 2, 3, 4, 5].map(n => (
                      <Star key={n} className="w-4 h-4" style={{ fill: n <= estrellas ? "var(--sf-tostado)" : "transparent", color: n <= estrellas ? "var(--sf-tostado)" : "var(--sf-tostado-7)" }} />
                    ))}
                  </div>
                  <p className="text-[var(--sf-acento-2)] text-sm leading-relaxed mb-4">&quot;{t.text}&quot;</p>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[var(--sf-linea)] flex items-center justify-center">
                      <span className="text-xs font-semibold text-[var(--sf-acento-texto)]">{(t.name || "?")[0]}</span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[var(--sf-tinta)]">{t.name}</p>
                      {atribucion && <p className="text-xs text-[var(--sf-acento-texto)]">{atribucion}</p>}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>
  )
}
