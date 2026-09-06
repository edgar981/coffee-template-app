"use client";

import Link from "next/link";
import Image from "next/image";

import { ArrowRight } from "lucide-react";

import { motion } from "framer-motion";

import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { HERO_HREFS } from "@/lib/config/site-content-defaults";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },

  visible: { opacity: 1, y: 0 },
};

// El hero se renderiza desde SiteContent (loader SOFT): los campos ya vienen resueltos
// —requeridos con su default, opcionales vacíos como ""—, así que acá sólo hay que OMITIR
// los opcionales vacíos (eyebrow, el énfasis del titular, el 2º CTA). Hero es `ocultable:false`
// → siempre se renderiza. Los destinos de los CTA son ESTRUCTURA (`HERO_HREFS`), no editables.
export default function HeroSection() {
  const { hero, paginas } = useSiteContent();
  const preview = useIsPreview();
  // El 2º CTA del hero apunta a /suscripciones (`HERO_HREFS.secundario`, estructura). Si la capacidad
  // de suscripciones está apagada (§ paginas.suscripciones, Backlog #49), se OCULTA —igual que el link
  // del nav/footer y el bloque de la home—: un CTA "Suscripción Mensual" a una página que redirige
  // sería un enlace muerto. Es la QUINTA superficie que enlaza a /suscripciones. En preview (editor)
  // `paginas` viene de DEFAULTS (siempre true), así que el 2º CTA sigue editable.
  const mostrarCtaSuscripcion = HERO_HREFS.secundario !== '/suscripciones' || paginas.suscripciones.visible;

  return (
    <section className="relative flex min-h-[92vh] items-center overflow-hidden bg-[var(--sf-tinta)]">
      <div className="absolute inset-0">
        <Image
          src={hero.imagen}
          alt=""
          fill
          priority
          sizes="100vw"
          quality={85}
          className="object-cover opacity-40"
        />

        <div className="absolute inset-0 bg-linear-to-b from-[var(--sf-tinta)]/60 via-transparent to-[var(--sf-tinta)]/80" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          // En la VISTA PREVIA del panel (`preview`), `initial={false}` renderiza en el estado
          // "visible" SIN animación de entrada: el contenido se ve asentado desde el primer render.
          // Sin esto, `initial="hidden"` con la entrada por `animate` haría parpadear el preview en
          // cada re-render del form; y una sección futura con `whileInView` quedaría INVISIBLE
          // esperando una intersección que dentro del contenedor escalado no llega.
          initial={preview ? false : 'hidden'}
          animate="visible"
          variants={{
            visible: {
              transition: {
                staggerChildren: 0.15,
              },
            },
          }}
          className="max-w-2xl"
        >
          {hero.eyebrow && (
            <motion.p
              variants={fadeUp}
              className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-[var(--sf-tostado)]"
            >
              {hero.eyebrow}
            </motion.p>
          )}

          <motion.h1
            variants={fadeUp}
            className="mb-6 font-playfair text-5xl leading-[1.08] text-white sm:text-6xl lg:text-7xl"
          >
            {hero.titulo}
            {hero.tituloEnfasis && (
              <>
                <br />
                <em className="italic text-[var(--sf-tostado)]">{hero.tituloEnfasis}</em>
              </>
            )}
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mb-10 max-w-md text-lg leading-relaxed text-white/70"
          >
            {hero.subtitulo}
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="flex flex-wrap gap-4"
          >
            <Link
              href={HERO_HREFS.primario}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--sf-tostado)] px-8 py-4 text-sm font-semibold text-[var(--sf-tinta)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--sf-tostado-4)]"
            >
              {hero.ctaPrimarioLabel}

              <ArrowRight className="h-4 w-4" />
            </Link>

            {hero.ctaSecundarioLabel && mostrarCtaSuscripcion && (
              <Link
                href={HERO_HREFS.secundario}
                className="inline-flex items-center gap-2 rounded-full border border-white/30 px-8 py-4 text-sm font-medium text-white transition-all duration-200 hover:border-white/60 hover:bg-white/10"
              >
                {hero.ctaSecundarioLabel}
              </Link>
            )}
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll indicator — se OMITE en preview: una flecha en bucle que invita a
          scrollear no significa nada dentro de un marco de vista previa (§ ?preview). */}
      {!preview && (
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-white/40"
        >
          <span className="text-xs tracking-widest uppercase">Scroll</span>
          <div className="w-px h-12 bg-linear-to-b from-white/40 to-transparent" />
        </motion.div>
      )}
    </section>
  );
}
