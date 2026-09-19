"use client";

import { useEffect, useRef } from "react";
import { preload } from "react-dom";
import Link from "next/link";
import Image from "next/image";

import { ArrowRight } from "lucide-react";

import { motion, useReducedMotion } from "framer-motion";

import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { HERO_HREFS } from "@/lib/config/site-content-defaults";
import { fadeUp } from "@/lib/animation";

// LA VARIANTE "MEDIA" (§ eje 5, EJE-5-VARIANTES-HERO, TEMAS-HERO-MEDIA-1): la TERCERA composición —
// donde curtina y ficha tratan la foto/video como ACOMPAÑAMIENTO (la curtina la atenúa al 40% detrás
// de un velo oscuro; la ficha la confina a la mitad de la pantalla), acá la media ES la superficie
// dominante: llena la sección A OPACIDAD PLENA, sin atenuar, y el texto vive en una TARJETA que flota
// sobre ella — "se apoya sobre ella", literal — en vez de repartirse suelto sobre el fondo.
//
// MISMOS SIETE CAMPOS DE CONTENIDO que curtina/ficha (eyebrow, titulo, tituloEnfasis, subtitulo, los
// dos CTA, imagen/imagenTipo/imagenPoster) — no se agrega dato nuevo. Mismos destinos de CTA
// (`HERO_HREFS`, estructura).
//
// POR QUÉ UNA TARJETA Y NO EL VELO DE LA CURTINA: el velo de la curtina funciona porque, atenuada al
// 40%, la foto se mezcla con el fondo de la sección (`--sf-tinta`) hasta acercarse a un plano casi
// sólido — sólo ASÍ los tokens `--sf-sobre-banda`/`-suave` (pensados para leer contra un fondo de
// banda aproximadamente PLANO, § esquema-style.ts) garantizan su piso de contraste. Subir la opacidad
// de la media para que domine rompe esa aproximación: el texto quedaría leyendo contra una foto
// arbitraria del cliente, que el sistema de temas no puede prometer legible. La salida NO es inventar
// un tratamiento de contraste nuevo (la guarda de esta sección: § el comentario de abajo) — es la que
// YA existe para exactamente este problema: poner el texto sobre `--sf-tarjeta`, con su par
// `--sf-sobre-tarjeta`/`-suave` GARANTIZADO por `derivarEsquema`/`pisoContraste` (§ palette-derive.ts,
// § esquema-style.ts) contra la tarjeta, no contra la foto. Mismo patrón que ya usan las tarjetas de
// TestimonialSection/Newsletter — sólo que acá la tarjeta flota sobre el hero en vez de vivir en una
// grilla.
//
// EL DEGRADADO SUPERIOR es la ÚNICA atenuación que esta variante aplica, y es angosto A PROPÓSITO:
// existe sólo para que el NAV transparente-flotante (que no tiene tarjeta debajo) siga leyéndose —
// mismo tono y misma intensidad que el tramo superior del velo de la curtina (`--sf-tinta`/60, ver
// HeroCurtina.tsx), así que la sección sigue clasificando OSCURA por el mismo contrato que la curtina
// (`bandaOscuraCanonica`, § site-content-defaults.ts: cualquier variante que no sea 'ficha' es
// oscura) sin tocar esa función. El resto de la media —el 80%+ inferior de la sección, donde vive la
// tarjeta— queda SIN atenuar: ahí es donde "la media domina".
//
// SIN INDICADOR DE SCROLL: la ficha (una de las dos variantes que ya existen) tampoco lo lleva —no es
// una capacidad nueva que esta variante retira, es un elemento que YA es opcional entre las
// variantes—. Con la media a opacidad plena y sin velo en la mitad inferior, un texto suelto ahí
// (fuera de la tarjeta) tendría el mismo problema de contraste que el degradado angosto existe para
// evitar en el nav; no se inventa un segundo mecanismo para un elemento decorativo.
//
// VIDEO COMO DATO (§ HERO-VIDEO-COMO-DATO-1) y REDUCED MOTION: MISMA mecánica que HeroCurtina.tsx/
// HeroFicha.tsx (misma sección `hero`, distinto layout) — `imagenTipo` ya clampado por el resolver,
// reproducción disparada IMPERATIVAMENTE porque `useReducedMotion()` resuelve DESPUÉS del primer
// render, `muted` también por REF (iOS bloquea el autoplay sin él), el póster pre-cargado con
// prioridad alta (§ HERO-VIDEO-POSTER-PRIORIDAD-1). Ver el razonamiento completo en HeroCurtina.tsx —
// no se repite acá una tercera vez.
export default function HeroMedia({ style }: { style?: React.CSSProperties } = {}) {
  const { hero, paginas } = useSiteContent();
  const preview = useIsPreview();
  // Idéntico a curtina/ficha: el 2º CTA se oculta si suscripciones está apagada.
  const mostrarCtaSuscripcion = HERO_HREFS.secundario !== '/suscripciones' || paginas.suscripciones.visible;

  const esVideo = hero.imagenTipo === 'video';
  const reduce = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const reproducir = esVideo && !preview && !reduce;

  if (esVideo && hero.imagenPoster) {
    preload(hero.imagenPoster, { as: "image", fetchPriority: "high" });
  }

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    if (reproducir) v.play().catch(() => {});
    else v.pause();
  }, [reproducir]);

  return (
    <section className="relative flex min-h-[92vh] items-end overflow-hidden bg-[var(--sf-banda,var(--sf-tinta))]" style={style}>
      <div className="absolute inset-0">
        {esVideo ? (
          <video
            ref={videoRef}
            src={hero.imagen}
            poster={hero.imagenPoster || undefined}
            muted
            loop
            playsInline
            preload={reproducir ? 'auto' : 'none'}
            controls={!!reduce && !preview}
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <Image
            src={hero.imagen}
            alt=""
            fill
            priority
            sizes="100vw"
            quality={85}
            className="object-cover"
          />
        )}

        {/* El ÚNICO velo de esta variante: angosto, arriba, sólo para el nav — ver el comentario de
            cabecera. Mismo tono que el tramo superior de la curtina (`--sf-tinta`/60). */}
        <div className="absolute inset-x-0 top-0 h-1/3 bg-linear-to-b from-[var(--sf-tinta)]/60 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16 lg:px-8 lg:pb-20">
        <motion.div
          // Mismo switch que curtina/ficha: en preview, asentado desde el primer render, sin
          // animación de entrada.
          initial={preview ? false : 'hidden'}
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.15 } } }}
          // LA TARJETA — donde "el texto se apoya sobre la media" (§ comentario de cabecera). Mismo
          // vocabulario que TestimonialSection.tsx (`bg-[var(--sf-tarjeta)]`, `sf-borde
          // border-[var(--sf-linea)]`, `rounded-2xl`→3xl por ser el bloque principal del hero,
          // `shadow-2xl` porque flota sobre media a opacidad plena, no sobre un fondo plano).
          className="max-w-xl rounded-3xl bg-[var(--sf-tarjeta)] p-8 shadow-2xl sf-borde border-[var(--sf-linea)] sm:p-10"
        >
          {hero.eyebrow && (
            <motion.p
              variants={fadeUp}
              className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-[var(--sf-sobre-tarjeta-suave,var(--sf-acento-texto))]"
            >
              {hero.eyebrow}
            </motion.p>
          )}

          <motion.h1
            variants={fadeUp}
            className="mb-6 font-playfair text-4xl leading-[1.1] text-[var(--sf-sobre-tarjeta,var(--sf-tinta))] sm:text-5xl lg:text-6xl"
          >
            {hero.titulo}
            {hero.tituloEnfasis && (
              <>
                <br />
                <em className="italic text-[var(--sf-sobre-tarjeta-suave,var(--sf-acento-texto))]">{hero.tituloEnfasis}</em>
              </>
            )}
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mb-8 max-w-md text-lg leading-relaxed text-[var(--sf-sobre-tarjeta-suave,var(--sf-texto))]"
          >
            {hero.subtitulo}
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="flex flex-wrap gap-4"
          >
            <Link
              href={HERO_HREFS.primario}
              className="inline-flex items-center gap-2 sf-pildora bg-[var(--sf-accion,var(--sf-tostado))] px-8 py-4 text-sm font-semibold text-[var(--sf-tinta)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--sf-tostado-4)]"
            >
              {hero.ctaPrimarioLabel}

              <ArrowRight className="h-4 w-4" />
            </Link>

            {hero.ctaSecundarioLabel && mostrarCtaSuscripcion && (
              <Link
                href={HERO_HREFS.secundario}
                className="inline-flex items-center gap-2 sf-pildora border border-[var(--sf-linea)] px-8 py-4 text-sm font-medium text-[var(--sf-sobre-tarjeta,var(--sf-tinta))] transition-all duration-200 hover:bg-[var(--sf-linea)]/40"
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
