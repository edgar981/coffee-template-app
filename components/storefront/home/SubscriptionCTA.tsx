"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { REGISTRY, seccionEsVisible } from "@/lib/config/site-content-defaults";
import { planesDeSuscripcion, planesDelTeaser, gridColsTeaser } from "@/lib/storefront/planes-suscripcion";

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } };

// "Plan Suscripción" — lee el CONTENIDO de SiteContent (loader SOFT): eyebrow se OMITE si viene
// vacío; titulo/subtitulo/ctaLabel vienen resueltos. Los BENEFICIOS son `bullet1..4` y se juntan con
// un `.filter` que SALTA los vacíos → la lista se cierra sin hueco (hasta 4, no 4 slots). Sección
// OCULTABLE: si `visible=false`, self-gate → null (la home la rinde como hermano plano, sin hueco).
//
// Las tarjetas de plan son DATO: leen la MISMA sección `suscripcionPlanes` que /suscripciones (§ Backlog
// #49, opción 1) → las dos superficies no divergen. El teaser LIMITA los planes (`planesDelTeaser`, § d):
// es un anzuelo que enlaza a /suscripciones, no el grid completo. El destaque sale del dato
// (`plan.destacado`, el `destacadoSlot` de la sección), no del `i===1` hardcodeado de antes. El href del
// CTA es estructura (`/suscripciones`), sólo el label es editable.
export default function SubscriptionCTA() {
  const { subscriptionCTA, suscripcionPlanes, paginas } = useSiteContent();
  const preview = useIsPreview();
  const planesTeaser = planesDelTeaser(planesDeSuscripcion(suscripcionPlanes));
  // EL FLAG DE PÁGINA MANDA sobre el toggle de sección: si la capacidad de suscripciones está apagada
  // (§ paginas.suscripciones, Backlog #49), este CTA se oculta AUNQUE la sección esté visible — enlaza
  // a /suscripciones, que redirige, así que un teaser encendido sería un anzuelo muerto. Con la
  // capacidad ENCENDIDA, el toggle de sección decide (mostrar el teaser o no). El orden es coherente:
  // la capacidad gobierna la EXISTENCIA; el toggle de sección, la PRESENTACIÓN dentro de una capacidad
  // que existe. En preview (editor) NO se apaga por el flag: `paginas` viene de DEFAULTS (siempre true),
  // así que el editor de la sección sigue viéndose para editarla aunque el cliente la haya apagado.
  if (!paginas.suscripciones.visible) return null;
  if (!seccionEsVisible(REGISTRY.subscriptionCTA, subscriptionCTA)) return null;

  const beneficios = [
    subscriptionCTA.bullet1,
    subscriptionCTA.bullet2,
    subscriptionCTA.bullet3,
    subscriptionCTA.bullet4,
  ].filter(b => b.trim() !== ""); // vacíos omitidos → la lista se cierra sin hueco

  return (
    <section className="py-20 bg-[var(--sf-tinta-2)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* En preview, `whileInView`→`animate` con `initial={false}`: la vista escalada no dispara
                la intersección (como HeroSection/BrandStory). Fuera de preview, idéntico a hoy. */}
            <motion.div
              initial={preview ? false : "hidden"}
              animate={preview ? "visible" : undefined}
              whileInView={preview ? undefined : "visible"}
              viewport={preview ? undefined : { once: true }}
              variants={fadeUp}
            >
              {subscriptionCTA.eyebrow && (
                <p className="text-[var(--sf-tostado)] text-xs tracking-[0.2em] uppercase mb-3">{subscriptionCTA.eyebrow}</p>
              )}
              <h2 className="text-4xl font-playfair text-white mb-4">{subscriptionCTA.titulo}</h2>
              <p className="text-white/60 mb-8 leading-relaxed">{subscriptionCTA.subtitulo}</p>
              <div className="space-y-3 mb-8">
                {beneficios.map((b, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-white/70">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--sf-tostado)]" />
                    {b}
                  </div>
                ))}
              </div>
              <Link href="/suscripciones" className="inline-flex items-center gap-2 bg-[var(--sf-tostado)] hover:bg-[var(--sf-tostado-4)] text-[var(--sf-tinta)] font-semibold px-8 py-4 rounded-full text-sm transition-all hover:-translate-y-0.5">
                {subscriptionCTA.ctaLabel} <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
            <motion.div
              initial={preview ? false : { opacity: 0, x: 30 }}
              animate={preview ? { opacity: 1, x: 0 } : undefined}
              whileInView={preview ? undefined : { opacity: 1, x: 0 }}
              viewport={preview ? undefined : { once: true }}
              transition={preview ? undefined : { duration: 0.6 }}
              className={`grid grid-cols-1 ${gridColsTeaser(planesTeaser.length)} gap-4`}
            >
              {planesTeaser.map(p => (
                /* El color de texto va POR RAMA: sobre el acento (el plan DESTACADO, que el cliente
                   puede elegir claro) usa `acento-txt` (auto-flip); sobre acento-2 (derivado OSCURO)
                   el blanco es correcto para cualquier acento. La descripción hereda el color de la
                   tarjeta con `opacity-70` (antes `text-white/70`, que fijaba blanco). */
                <div key={p.slot} className={`rounded-2xl p-5 ${p.destacado ? 'bg-[var(--sf-acento)] text-[var(--sf-acento-txt)]' : 'bg-[var(--sf-acento-2)] text-white'}`}>
                  <p className="text-[var(--sf-tostado)] text-xs font-medium mb-2">{p.nombre}</p>
                  <p className="opacity-70 text-xs leading-snug">{p.descripcion}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>
  )
}
