"use client";

import Link from "next/link";
import Image from "next/image";

import { ArrowRight } from "lucide-react";

import { motion } from "framer-motion";

import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { HERO_HREFS } from "@/lib/config/site-content-defaults";
import { fadeUp } from "@/lib/animation";

// LA VARIANTE "FICHA" (§ eje 5, EJE-5-VARIANTES-HERO): deja de ser una cortina fotográfica y pasa a
// ser una FICHA PARTIDA — tipografía en TINTA sobre CREMA, foto a sangre a la derecha SIN degradado
// encima, énfasis en la misma línea del titular y una regla corta como separador. Mismos siete
// campos, mismos dos CTA, misma imagen; lo que cambia es de qué está hecha la primera pantalla.
//
// BANDA CLARA (`--sf-fondo`, el FLIP respecto de la curtina que cae a `--sf-tinta`): es el token que
// `bandaOscuraCanonica` ata a esta variante (§ site-content-defaults.ts, BANDAS_OSCURAS) — si se
// cambia el fallback acá, hay que actualizar ese comentario también.
//
// TOKENS on-band CLAROS (como el índice de Presentaciones / Newsletter, NO el blanco fijo de la
// curtina): título → `--sf-sobre-banda` con fallback `--sf-tinta`; eyebrow/énfasis → fallback
// `--sf-acento-texto` (mismo rol de acento que la curtina, con un fallback que se lee sobre claro);
// subtítulo → `--sf-sobre-banda-suave` con fallback `--sf-texto`, SIN el modificador `/NN` de
// Tailwind (el fallback ya trae su propio peso). Auto-flipea con un esquema asignado a `hero`.
//
// DOM: imagen PRIMERO, texto DESPUÉS — en móvil (`flex-col`) apila imagen arriba, texto abajo; en
// desktop (`lg:flex-row-reverse`) el orden visual se invierte (texto a la izquierda, imagen a la
// derecha) sin reordenar el DOM.
export default function HeroFicha({ style }: { style?: React.CSSProperties } = {}) {
  const { hero, paginas } = useSiteContent();
  const preview = useIsPreview();
  // Idéntico a la curtina (§ HeroCurtina.tsx): el 2º CTA se oculta si suscripciones está apagada.
  const mostrarCtaSuscripcion = HERO_HREFS.secundario !== '/suscripciones' || paginas.suscripciones.visible;

  return (
    <section
      className="relative flex min-h-[92vh] flex-col overflow-hidden bg-[var(--sf-banda,var(--sf-fondo))] lg:flex-row-reverse"
      style={style}
    >
      {/* Foto a sangre, SIN degradado encima — banda superior en móvil, mitad derecha en desktop. */}
      <div className="relative h-[42vh] w-full shrink-0 lg:h-auto lg:w-1/2">
        <Image
          src={hero.imagen}
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          quality={85}
          className="object-cover"
        />
      </div>

      {/* Texto, alineado al gutter del sitio. */}
      <div className="relative z-10 flex flex-1 items-center px-4 py-14 sm:px-6 lg:py-0 lg:pl-16 lg:pr-12 xl:pl-24 xl:pr-16">
        <motion.div
          // Mismo switch que la curtina (§ HeroCurtina.tsx): en preview, asentado desde el primer
          // render, sin animación de entrada.
          initial={preview ? false : 'hidden'}
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.15 } } }}
          className="max-w-xl"
        >
          {hero.eyebrow && (
            <motion.p
              variants={fadeUp}
              className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-[var(--sf-sobre-banda,var(--sf-acento-texto))]"
            >
              {hero.eyebrow}
            </motion.p>
          )}

          <motion.h1
            variants={fadeUp}
            className="font-playfair text-4xl leading-[1.1] text-[var(--sf-sobre-banda,var(--sf-tinta))] sm:text-5xl lg:text-6xl"
          >
            {hero.titulo}
            {hero.tituloEnfasis && (
              <>
                {' '}
                <em className="italic text-[var(--sf-sobre-banda,var(--sf-acento-texto))]">{hero.tituloEnfasis}</em>
              </>
            )}
          </motion.h1>

          {/* Regla corta — separador entre el titular y el subtítulo. */}
          <motion.div variants={fadeUp} className="my-6 h-px w-16 bg-[var(--sf-linea)]" />

          <motion.p
            variants={fadeUp}
            className="mb-10 max-w-md text-lg leading-relaxed text-[var(--sf-sobre-banda-suave,var(--sf-texto))]"
          >
            {hero.subtitulo}
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-wrap gap-4">
            <Link
              href={HERO_HREFS.primario}
              className="inline-flex items-center gap-2 sf-pildora bg-[var(--sf-tostado)] px-8 py-4 text-sm font-semibold text-[var(--sf-tinta)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--sf-tostado-4)]"
            >
              {hero.ctaPrimarioLabel}

              <ArrowRight className="h-4 w-4" />
            </Link>

            {hero.ctaSecundarioLabel && mostrarCtaSuscripcion && (
              <Link
                href={HERO_HREFS.secundario}
                className="inline-flex items-center gap-2 sf-pildora border border-[var(--sf-linea)] px-8 py-4 text-sm font-medium text-[var(--sf-sobre-banda,var(--sf-tinta))] transition-all duration-200 hover:bg-[var(--sf-linea)]/40"
              >
                {hero.ctaSecundarioLabel}
              </Link>
            )}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
