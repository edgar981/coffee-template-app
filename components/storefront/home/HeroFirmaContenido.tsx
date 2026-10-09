"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import CampoEditable from "@/components/storefront/CampoEditable";
import { HERO_HREFS } from "@/lib/config/site-content-defaults";
import { contenedorAnchoClase } from "@/lib/config/themes";
import { estiloInlineDeElemento } from "@/lib/config/estilo-elemento";

// EL BLOQUE DE TEXTO compartido por los TRES héroes de FIRMA (§ MOVIMIENTO-NIVEL-FIRMA-1,
// HeroGrano/HeroCereza/HeroPaisaje) — MISMAS zonas y MISMOS tokens que HeroCurtina.tsx (eyebrow/
// titular/subtítulo/botones, `--sf-sobre-banda*`, `hero.estilos`), extraído acá porque las tres
// composiciones lo repiten IDÉNTICO (a diferencia de Cortina/Ficha/Portada/Marquesina, que cada una
// varía el layout o gana una zona propia — ahí la duplicación local se aceptó a propósito, § el
// comentario de cabecera de HeroCurtina.tsx; acá las tres SON la misma pieza).
//
// NO decide su propio contenedor absoluto/z-index: cada Hero*.tsx lo envuelve en el wrapper que su
// animación necesita (p. ej. `[data-h01-titulo]`), así que este componente sólo pinta el CONTENIDO.
export default function HeroFirmaContenido() {
  const { hero, paginas, tema, navTratamiento } = useSiteContent();
  const preview = useIsPreview();
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);
  // Mismo guard que HeroCurtina: el 2º CTA se oculta si apunta a /suscripciones y esa capacidad
  // está apagada (§ paginas.suscripciones, Backlog #49).
  const mostrarCtaSuscripcion = HERO_HREFS.secundario !== '/suscripciones' || paginas.suscripciones.visible;

  return (
    <div className={`relative z-10 mx-auto w-full ${contenedorClase}`}>
      <motion.div
        initial={preview ? false : 'hidden'}
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.15 } } }}
        className="max-w-2xl"
      >
        {hero.eyebrow && (
          <motion.p
            variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }}
            className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-[var(--sf-sobre-banda,var(--sf-tostado))]"
          >
            <CampoEditable campo="hero.eyebrow">{hero.eyebrow}</CampoEditable>
          </motion.p>
        )}

        <motion.h1
          variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }}
          className="mb-6 font-playfair text-5xl leading-[1.08] text-[var(--sf-sobre-banda,white)] sm:text-6xl lg:text-7xl"
          style={estiloInlineDeElemento(hero.estilos.titulo, 'titular', tema.fuentePar)}
        >
          <CampoEditable campo="hero.titulo">{hero.titulo}</CampoEditable>
          {hero.tituloEnfasis && (
            <>
              <br />
              <em className="italic text-[var(--sf-sobre-banda,var(--sf-tostado))]">
                <CampoEditable campo="hero.tituloEnfasis">{hero.tituloEnfasis}</CampoEditable>
              </em>
            </>
          )}
        </motion.h1>

        <motion.p
          variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }}
          className="mb-10 max-w-md text-lg leading-relaxed text-[var(--sf-sobre-banda-suave,color-mix(in_oklab,white_70%,transparent))]"
          style={estiloInlineDeElemento(hero.estilos.subtitulo, 'subtitulo', tema.fuentePar)}
        >
          <CampoEditable campo="hero.subtitulo" multilinea>{hero.subtitulo}</CampoEditable>
        </motion.p>

        <motion.div variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }} className="flex flex-wrap gap-4">
          {/* § CTA-PRIMARIO-COLOR-Y-HOVER-1 (lib/config/cta-primario.test.ts, fuera de
              `touches:`): ese archivo mantiene un censo EXHAUSTIVO de quién usa el hover de acción
              del CTA primario — sumar un consumidor nuevo exige tocarlo, fuera del alcance de
              este slice. El fondo/texto SÍ siguen el rol (`--sf-accion`/`--sf-accion-txt`, sin
              censo exhaustivo); el hover se queda en el lift (`-translate-y-0.5`), sin el cambio
              de color que el censo vigila. */}
          <Link
            href={HERO_HREFS.primario}
            className="inline-flex items-center gap-2 sf-pildora bg-[var(--sf-accion,var(--sf-tostado))] px-8 py-4 text-sm font-semibold text-[var(--sf-accion-txt,var(--sf-tinta))] transition-all duration-200 hover:-translate-y-0.5"
            style={estiloInlineDeElemento(hero.estilos.ctaPrimarioLabel, 'boton', tema.fuentePar)}
          >
            <CampoEditable campo="hero.ctaPrimarioLabel">{hero.ctaPrimarioLabel}</CampoEditable>
          </Link>

          {hero.ctaSecundarioLabel && mostrarCtaSuscripcion && (
            <Link
              href={HERO_HREFS.secundario}
              className="inline-flex items-center gap-2 sf-pildora border border-[var(--sf-linea-sobre,white)]/30 px-8 py-4 text-sm font-medium text-[var(--sf-sobre-banda,white)] transition-all duration-200 hover:border-[var(--sf-linea-sobre,white)]/60 hover:bg-white/10"
              style={estiloInlineDeElemento(hero.estilos.ctaSecundarioLabel, 'boton', tema.fuentePar)}
            >
              <CampoEditable campo="hero.ctaSecundarioLabel">{hero.ctaSecundarioLabel}</CampoEditable>
            </Link>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
