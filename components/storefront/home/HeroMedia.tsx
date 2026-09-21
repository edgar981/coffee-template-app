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
import { fontSizeDisplay } from "@/lib/config/escala-display";

// LA VARIANTE "MEDIA" (§ eje 5, EJE-5-VARIANTES-HERO, TEMAS-HERO-MEDIA-1; SIN TARJETA desde
// HERO-MEDIA-SIN-TARJETA-1) — la TERCERA composición: donde curtina y ficha tratan la foto/video como
// ACOMPAÑAMIENTO (la curtina la atenúa al 40% detrás de un velo oscuro; la ficha la confina a la
// mitad de la pantalla), acá la media ES la superficie dominante: llena la sección A OPACIDAD PLENA,
// sin atenuar, y el texto vive DIRECTO sobre ella, al pie, alineado a la izquierda — sin tarjeta.
//
// LOS MISMOS SIETE CAMPOS DE CONTENIDO que curtina/ficha (eyebrow, titulo, tituloEnfasis, subtitulo,
// los dos CTA, imagen/imagenTipo/imagenPoster) — mismos destinos de CTA (`HERO_HREFS`, estructura).
// TRES CAMPOS MÁS, EXCLUSIVOS DE ESTA VARIANTE (§ TEMAS-HERO-MEDIA-AGREGADOS-1, más abajo):
// `ctasVisibles`/`fraseAlPie`/`cueDesliza` — curtina y ficha no los leen.
//
// LA TARJETA SE RETIRÓ POR DECISIÓN DEL OWNER (2026-09-19, HERO-MEDIA-SIN-TARJETA-1): «la tarjeta es
// lo que hace que nuestro hero se lea como plantilla y el del prototipo como editorial». El
// prototipo (`docs/prototipos/cafeone/`) nunca puso el texto en una caja — lo pone directo sobre la
// media, con un VELO (`--protect-grad-strong`, `css/tokens.css:218`: `linear-gradient(to bottom,
// rgba(16,36,7,.34) 0%, rgba(16,36,7,.62) 100%)`, aplicado sobre TODA la media vía `.hero-media::after
// {inset:0}`, `css/app.css:373`) que oscurece progresivamente hacia el pie, donde vive el texto
// (`.hero-inner{...justify-content:flex-end}`, `css/app.css:374-378`).
//
// EL VELO NO SE INVENTÓ: se REUSA el que YA construyó `HeroCurtina.tsx` para el MISMO problema —texto
// claro directo sobre media, sin caja— `bg-linear-to-b from-[var(--sf-tinta)]/60 via-transparent
// to-[var(--sf-tinta)]/80`, cubriendo TODA la media (`inset-0`, no sólo el tercio superior de antes).
// Es la MISMA forma que el velo del prototipo (oscurece hacia el pie, donde está el texto) con los
// valores YA calibrados de este sistema (tokens `--sf-tinta`, ya usados en el resto del storefront) en
// vez de los literales RGB del prototipo — mismo mecanismo, valores del propio repo. El tramo superior
// (60%) es el MISMO que ya protegía al NAV transparente-flotante (sin tocar `noUniformes`, la sección
// sigue siendo un solo plano de media); el tramo inferior (80%) es NUEVO — antes lo resolvía la
// tarjeta clara, ahora lo resuelve el velo oscuro sobre la media a plena opacidad. Contraste medido
// (blanco sobre el velo al 80%, contra tres fotos CLARAS de referencia — arena `rgb(232,222,200)`,
// casi-blanco `rgb(245,245,240)`, crema `rgb(238,230,214)`): 9.61:1 / 8.97:1 / 9.38:1 — el subtítulo
// (`--sf-sobre-banda-suave`, blanco al ~70%) sobre el mismo velo: 5.69:1 / 5.38:1 / 5.58:1 — los tres
// casos superan AA (4.5:1) con margen amplio incluso en la foto MÁS clara. El tramo superior (60%,
// SIN cambios respecto de antes) da 4.68:1–5.32:1 sobre las mismas tres fotos — el mismo piso que
// `HeroCurtina.tsx` ya acepta para su propio nav.
//
// LOS TOKENS DE TEXTO PASAN DE `--sf-sobre-tarjeta`* A `--sf-sobre-banda`*, verbatim los de
// `HeroCurtina.tsx` (eyebrow/título/énfasis/CTA-secundario con fallback blanco/tostado; subtítulo con
// el blanco-suave `color-mix`) — la sección sigue clasificando OSCURA
// (`bandaOscuraCanonica('hero','media')` = true, § site-content-defaults.ts, sin tocar), así que el
// mismo par de tokens que ya sirve a la curtina (banda oscura, sin esquema asignado) sirve acá. El CTA
// PRIMARIO NO se tocó: ya leía `--sf-accion` (el color de la ACCIÓN, § TEMAS-ROLES-DECLARADOS-POR-EL-
// PRESET-1), idéntico al de curtina/ficha — la única superficie que cambia de familia de token es el
// CTA SECUNDARIO (outline), que antes leía contra la tarjeta clara (`--sf-linea`/`--sf-sobre-tarjeta`)
// y ahora lee contra la banda oscura (`--sf-linea-sobre`/`--sf-sobre-banda`, igual que curtina) — es
// el mismo texto que cambia de fondo, no un color nuevo que se inventa.
//
// QUIÉN USA ESTA VARIANTE (medido antes de tocar, para no romper un inquilino ajeno al muestrario):
// `grep -rn "'media'" lib/config/themes.ts` da UN solo preset, `CORTE.variantes.hero`. Ningún otro
// preset (PLIEGO/PATIO/VETA/VITRINA/ARRANQUE) usa 'media' para hero, y `hero.variantes.canonica` es
// 'curtina' — un tenant SIN preset aplicado (todo tenant real hoy, incluida Nayoli) nunca ve esta
// variante. `aplicarPreset` (`site-content-write.ts`) es la ÚNICA función que PERSISTIRÍA un preset en
// `SiteContent`, y no tiene un solo llamador (corre desde un runbook manual de onboarding, § el
// comentario de `theme-mirador.ts`) — así que el ÚNICO camino de hoy a esta variante es el mirador
// `?tema=CORTE`, y ESE camino sólo se lee fuera de producción real (`esDespliegueDemo()`, § el
// comentario de `app/(storefront)/page.tsx`). Cambiar este archivo no mueve un solo byte de ningún
// tenant persistido — sólo cambia lo que el mirador de CORTE muestra.
//
// EL DEGRADADO SUPERIOR SE FUSIONÓ CON EL INFERIOR — antes eran dos elementos (un `<div>` angosto
// arriba para el nav, la tarjeta clara abajo para el texto); ahora es UN solo velo full-height sobre
// TODA la media, igual que el `.hero-media::after{inset:0}` del prototipo. El resto de la media —el
// tramo medio, donde el gradiente pasa por transparente— queda SIN atenuar: ahí sigue siendo cierto
// que "la media domina".
//
// INDICADOR DE SCROLL — OPT-IN (§ TEMAS-HERO-MEDIA-AGREGADOS-1): hasta este slice ninguna variante
// lo llevaba acá (la ficha tampoco lo tiene, y sigue sin tenerlo — no es una capacidad que ESA
// variante retira). El de HeroCurtina.tsx ("Scroll", con bote infinito en `y`) es OTRO elemento,
// SIEMPRE encendido, sin dato detrás — no se reusa ni se generaliza: el cue de acá es el
// `.scroll-cue` del PROTOTIPO ("Desliza", una línea con un segmento que la recorre), dato del
// tenant (`hero.cueDesliza`, default `false` = byte-idéntico a HOY), ver el bloque de campos abajo.
//
// LOS TRES AGREGADOS DEL PROTOTIPO QUE HeroMedia GANA ACÁ (§ TEMAS-HERO-MEDIA-AGREGADOS-1,
// `docs/prototipos/cafeone/index.html:122-138`): CTAs ocultables (`hero.ctasVisibles`), la frase al
// pie como dato (`hero.fraseAlPie`, el `.hero-caption` del prototipo) y el cue animado de "Desliza"
// (`hero.cueDesliza`, el `.scroll-cue`). LOS TRES OPT-IN, default = el hero-media de HOY — el modelo
// y sus defaults viven en `site-content-defaults.ts` (§ docstring de `HeroContent`); ver el bloque
// JSX de cada uno más abajo para el mecanismo de render y de reduced-motion.
//
// VIDEO COMO DATO (§ HERO-VIDEO-COMO-DATO-1) y REDUCED MOTION: MISMA mecánica que HeroCurtina.tsx/
// HeroFicha.tsx (misma sección `hero`, distinto layout) — `imagenTipo` ya clampado por el resolver,
// reproducción disparada IMPERATIVAMENTE porque `useReducedMotion()` resuelve DESPUÉS del primer
// render, `muted` también por REF (iOS bloquea el autoplay sin él), el póster pre-cargado con
// prioridad alta (§ HERO-VIDEO-POSTER-PRIORIDAD-1). Ver el razonamiento completo en HeroCurtina.tsx —
// no se repite acá una tercera vez.
export default function HeroMedia({ style }: { style?: React.CSSProperties } = {}) {
  const { hero, paginas, tema } = useSiteContent();
  const preview = useIsPreview();
  // ESCALA DE DISPLAY (§ TEMAS-ESCALA-DISPLAY-1) — MEDIDO EXACTAMENTE ACÁ: la clase de hoy del h1
  // (`text-4xl sm:text-5xl lg:text-6xl` = 2.25rem/3rem/3.75rem) es la que la doctrina de este slice
  // cita como "el hero". CORTE (`hero: 'media'`) es el ÚNICO preset del catálogo que usa esta
  // variante y el ÚNICO que declara `escalaDisplay: 'amplia'`, así que este es el único hero que hoy
  // se ve ENORME en el mirador; los otros dos (Curtina/Ficha) heredan el mismo mecanismo por si algún
  // preset futuro combina otra variante con esta escala. `undefined` sin escala declarada → NO se
  // toca el `style`, byte-idéntico.
  const displayXl = fontSizeDisplay(tema.escalaDisplay, 'xl');
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

        {/* EL VELO — full-height, § comentario de cabecera. Verbatim el de `HeroCurtina.tsx`: oscurece
            el tramo superior (protege al nav) y el tramo inferior (protege al texto, que vive al
            pie), transparente en el medio — ahí "la media domina". */}
        <div className="absolute inset-0 bg-linear-to-b from-[var(--sf-tinta)]/60 via-transparent to-[var(--sf-tinta)]/80" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16 lg:px-8 lg:pb-20">
        <motion.div
          // Mismo switch que curtina/ficha: en preview, asentado desde el primer render, sin
          // animación de entrada.
          initial={preview ? false : 'hidden'}
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.15 } } }}
          // SIN TARJETA (§ comentario de cabecera, HERO-MEDIA-SIN-TARJETA-1): el texto va directo
          // sobre el velo, al pie, alineado a la izquierda — sólo el ancho máximo del bloque.
          className="max-w-xl"
        >
          {hero.eyebrow && (
            <motion.p
              variants={fadeUp}
              className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-[var(--sf-sobre-banda,var(--sf-tostado))]"
            >
              {hero.eyebrow}
            </motion.p>
          )}

          <motion.h1
            variants={fadeUp}
            className="mb-6 font-playfair text-4xl leading-[1.1] text-[var(--sf-sobre-banda,white)] sm:text-5xl lg:text-6xl"
            style={displayXl ? { fontSize: displayXl } : undefined}
          >
            {hero.titulo}
            {hero.tituloEnfasis && (
              <>
                <br />
                <em className="italic text-[var(--sf-sobre-banda,var(--sf-tostado))]">{hero.tituloEnfasis}</em>
              </>
            )}
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mb-8 max-w-md text-lg leading-relaxed text-[var(--sf-sobre-banda-suave,color-mix(in_oklab,white_70%,transparent))]"
          >
            {hero.subtitulo}
          </motion.p>

          {/* CTAs OCULTABLES (§ TEMAS-HERO-MEDIA-AGREGADOS-1, agregado a). Default `true` = los dos
              botones de HOY, byte-idéntico. El prototipo no lleva botones en el hero; acá se apagan
              LOS DOS JUNTOS (no uno sí y otro no) — el mismo bloque, no dos flags. */}
          {hero.ctasVisibles && (
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
                  className="inline-flex items-center gap-2 sf-pildora border border-[var(--sf-linea-sobre,white)]/30 px-8 py-4 text-sm font-medium text-[var(--sf-sobre-banda,white)] transition-all duration-200 hover:border-[var(--sf-linea-sobre,white)]/60 hover:bg-white/10"
                >
                  {hero.ctaSecundarioLabel}
                </Link>
              )}
            </motion.div>
          )}
        </motion.div>

        {/* FRASE AL PIE, como DATO (§ TEMAS-HERO-MEDIA-AGREGADOS-1, agregado b). El `.hero-caption`
            del prototipo (`margin-left:auto;max-width:34ch;text-align:right`, index.html:133-136) —
            vacío por defecto → SE OMITE (byte-idéntico). Sin animación de entrada a propósito: vive
            FUERA del `motion.div` de arriba (no comparte su stagger), como un elemento aparte al pie
            de la sección — igual que el cue, abajo. */}
        {hero.fraseAlPie && (
          <p className="mt-8 ml-auto max-w-[34ch] text-right text-sm leading-relaxed text-balance text-[var(--sf-sobre-banda-suave,color-mix(in_oklab,white_70%,transparent))]">
            {hero.fraseAlPie}
          </p>
        )}
      </div>

      {/* CUE ANIMADO "DESLIZA" (§ TEMAS-HERO-MEDIA-AGREGADOS-1, agregado c). El `.scroll-cue` del
          prototipo (index.html:137): una línea vertical con un segmento que la recorre + la
          etiqueta. Default `false` = SIN cue (byte-idéntico a hoy). Se OMITE en preview, mismo
          criterio que el indicador de HeroCurtina.tsx: "scrollear" no significa nada dentro de un
          marco de vista previa.
          REDUCED MOTION: el segmento anima `y` (un TRANSFORM) con un `motion.span`, así que
          `ReducedMotionProvider` (`lib/animation.ts`, `MotionConfig reducedMotion="user"`, montado
          en `app/(storefront)/layout.tsx` sobre TODO el árbol del storefront) lo CONGELA solo bajo
          `prefers-reduced-motion` — salto instantáneo al valor final, sin el `repeat: Infinity` —
          visible pero sin animar, nunca desaparece. No se agrega ningún guard propio acá: es el
          MISMO mecanismo que ya apaga el bote de la flecha de HeroCurtina.tsx (§ el docstring de
          `ReducedMotionProvider`). */}
      {hero.cueDesliza && !preview && (
        <div
          data-hero-cue="desliza"
          className="absolute bottom-8 left-4 z-10 flex flex-col items-start gap-3 sm:bottom-10 sm:left-6 lg:bottom-12 lg:left-8 text-[var(--sf-sobre-banda-suave,color-mix(in_oklab,white_70%,transparent))]"
        >
          <div className="relative h-14 w-px overflow-hidden bg-[var(--sf-linea-sobre,white)]/30">
            <motion.span
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-1/2 w-full bg-[var(--sf-sobre-banda,white)]"
              animate={{ y: ['-100%', '220%'] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
          <span className="text-xs font-medium uppercase tracking-[0.2em]">Desliza</span>
        </div>
      )}
    </section>
  );
}
