"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { SUBSCRIPTION_PLANS } from "@/lib/mock/subscriptions";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { REGISTRY, seccionEsVisible } from "@/lib/config/site-content-defaults";

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } };

// "Plan Suscripción" — lee el CONTENIDO de SiteContent (loader SOFT): eyebrow se OMITE si viene
// vacío; titulo/subtitulo/ctaLabel vienen resueltos. Los BENEFICIOS son `bullet1..4` y se juntan con
// un `.filter` que SALTA los vacíos → la lista se cierra sin hueco (hasta 4, no 4 slots). Sección
// OCULTABLE: si `visible=false`, self-gate → null (la home la rinde como hermano plano, sin hueco).
//
// Las TRES tarjetas de plan siguen desde `SUBSCRIPTION_PLANS` (ESTRUCTURA, compartida con
// /suscripciones — § Backlog #49); el href del CTA es estructura (`/suscripciones`), sólo el label
// es editable.
export default function SubscriptionCTA() {
  const { subscriptionCTA } = useSiteContent();
  const preview = useIsPreview();
  if (!seccionEsVisible(REGISTRY.subscriptionCTA, subscriptionCTA)) return null;

  const beneficios = [
    subscriptionCTA.bullet1,
    subscriptionCTA.bullet2,
    subscriptionCTA.bullet3,
    subscriptionCTA.bullet4,
  ].filter(b => b.trim() !== ""); // vacíos omitidos → la lista se cierra sin hueco

  return (
    <section className="py-20 bg-[#2d1a0e]">
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
                <p className="text-[#d4a97a] text-xs tracking-[0.2em] uppercase mb-3">{subscriptionCTA.eyebrow}</p>
              )}
              <h2 className="text-4xl font-playfair text-white mb-4">{subscriptionCTA.titulo}</h2>
              <p className="text-white/60 mb-8 leading-relaxed">{subscriptionCTA.subtitulo}</p>
              <div className="space-y-3 mb-8">
                {beneficios.map((b, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-white/70">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#d4a97a]" />
                    {b}
                  </div>
                ))}
              </div>
              <Link href="/suscripciones" className="inline-flex items-center gap-2 bg-[#d4a97a] hover:bg-[#c49060] text-[#1a0f08] font-semibold px-8 py-4 rounded-full text-sm transition-all hover:-translate-y-0.5">
                {subscriptionCTA.ctaLabel} <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
            <motion.div
              initial={preview ? false : { opacity: 0, x: 30 }}
              animate={preview ? { opacity: 1, x: 0 } : undefined}
              whileInView={preview ? undefined : { opacity: 1, x: 0 }}
              viewport={preview ? undefined : { once: true }}
              transition={preview ? undefined : { duration: 0.6 }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            >
              {SUBSCRIPTION_PLANS.map((p, i) => (
                <div key={p.id} className={`rounded-2xl p-5 text-white ${i === 1 ? 'bg-[#8B4513]' : 'bg-[#3d2314]'}`}>
                  <p className="text-[#d4a97a] text-xs font-medium mb-2">{p.nombre}</p>
                  <p className="text-white/70 text-xs leading-snug">{p.descripcion}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>
  )
}
