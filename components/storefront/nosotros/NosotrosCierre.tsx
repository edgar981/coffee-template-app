"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion, useTransform } from "framer-motion";
import { fadeUp, useProgresoScroll } from "@/lib/animation";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { REGISTRY, seccionEsVisible, resolverCtaSeccion } from "@/lib/config/site-content-defaults";
import CampoEditable from "@/components/storefront/CampoEditable";

// EL CTA DE CIERRE de /nosotros (§ NOSOTROS-COMPOSICION-1) — la banda final antes del pie, en el
// mismo lugar donde el tema real cierra la página con titular + párrafo + botón (medido, §
// CENSO-NOSOTROS-TEMA-REAL-1). REUSA LA GRAMÁTICA visual de `SubscriptionCTALinea.tsx` (imagen a
// sangre completa + velo degradado con `--sf-velo` + parallax vía `useProgresoScroll` + el gate de
// movimiento reducido no-negociable), NO su contenido: el cierre de /nosotros tiene su propio
// `titulo`/`parrafo`/botón, nunca el texto de la suscripción de la home.
//
// HIDE-ON-EMPTY POR `titulo`, no por un repeater — `seccionEsVisible` sólo hace hide-on-empty para
// secciones con `repeater` (§ site-content-defaults.ts); ésta es una sección de campos PLANOS, así
// que el gate de contenido vive ACÁ, mismo patrón que `Spotlight.tsx`
// (`if (!seccionEsVisible(...)) return null; if (!producto) return null;`). Con `titulo` vacío
// —el default, para todo tenant que no la llene— la banda NO se monta: ningún byte nuevo para nadie.
export default function NosotrosCierre({ style }: { style?: React.CSSProperties } = {}) {
  const { nosotrosCierre, paginas } = useSiteContent();
  const preview = useIsPreview();
  const reduce = useReducedMotion();
  const estatico = preview || !!reduce;

  if (!seccionEsVisible(REGISTRY.nosotrosCierre, nosotrosCierre)) return null;
  if (nosotrosCierre.titulo.trim() === "") return null;

  const ctaHref = resolverCtaSeccion(nosotrosCierre.ctaLabel, nosotrosCierre.ctaDestino, paginas);
  const tieneImagenFondo = nosotrosCierre.imagenFondo.trim() !== "";

  const sectionRef = useRef<HTMLElement>(null);
  const progreso = useProgresoScroll(sectionRef);
  const parallaxY = useTransform(progreso, (p) => {
    if (estatico) return "0%";
    const t = Math.max(0, Math.min(1, p));
    return `${((t - 0.5) * -10).toFixed(2)}%`;
  });

  return (
    <section
      ref={sectionRef}
      className={`relative overflow-hidden py-24${tieneImagenFondo ? "" : " bg-[var(--sf-tinta-2)]"}`}
      style={style}
    >
      {tieneImagenFondo && (
        <div className="absolute inset-0" aria-hidden="true">
          {/* La caja del parallax se extiende 6% arriba/abajo: el `translateY` de ±5% de su propio
              alto (≤ 5% de 112%) nunca expone un borde vacío — MISMA cuenta que SubscriptionCTALinea. */}
          <motion.div className="absolute inset-x-0 top-[-6%] bottom-[-6%]" style={{ y: parallaxY }}>
            <CampoEditable campo="nosotrosCierre.imagenFondo" tipo="imagen">
              <Image src={nosotrosCierre.imagenFondo} alt="" fill sizes="100vw" className="object-cover" />
            </CampoEditable>
          </motion.div>
          {/* `pointer-events-none` (§ DEVIACIÓN MEDIDA, EDITOR-TIENDA-CAMPO-EDITABLE-PAGINAS-1 — mismo
              defecto que ya cerró EDITOR-TIENDA-CAMPO-EDITABLE-HOME-1 para el gradiente de
              GrindChooserMosaico): este velo pinta DESPUÉS del `motion.div` de la imagen, en la MISMA
              caja `absolute inset-0`, así que sin esto se lleva el hit-test del clic sobre el marcador
              de imagen de arriba. Neutro para un visitante real: el velo nunca tuvo propósito
              interactivo. */}
          <div className="absolute inset-0 bg-linear-to-b from-[var(--sf-tinta)]/60 to-[var(--sf-velo)] pointer-events-none" />
        </div>
      )}
      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* En preview, `whileInView`→`animate` con `initial={false}`: la vista escalada no dispara la
            intersección (como el resto de las bandas). Fuera de preview, idéntico a cualquier otra. */}
        <motion.div
          initial={preview ? false : "hidden"}
          animate={preview ? "visible" : undefined}
          whileInView={preview ? undefined : "visible"}
          viewport={preview ? undefined : { once: true }}
          variants={fadeUp}
        >
          <h2 className="text-3xl sm:text-4xl font-playfair text-[var(--sf-sobre)] leading-tight mb-6">
            <CampoEditable campo="nosotrosCierre.titulo">{nosotrosCierre.titulo}</CampoEditable>
          </h2>
          {nosotrosCierre.parrafo && (
            <p className="text-[var(--sf-sobre)]/80 leading-relaxed text-lg mb-8">
              <CampoEditable campo="nosotrosCierre.parrafo" multilinea>{nosotrosCierre.parrafo}</CampoEditable>
            </p>
          )}
          {ctaHref && (
            <Link
              href={ctaHref}
              className="inline-flex items-center gap-2 bg-[var(--sf-accion,var(--sf-tostado))] hover:bg-[var(--sf-accion-hover,var(--sf-tostado-4))] text-[var(--sf-accion-txt,var(--sf-tinta))] font-semibold px-8 py-4 sf-pildora text-sm transition-all hover:-translate-y-0.5"
            >
              <CampoEditable campo="nosotrosCierre.ctaLabel">{nosotrosCierre.ctaLabel}</CampoEditable>
            </Link>
          )}
        </motion.div>
      </div>
    </section>
  );
}
