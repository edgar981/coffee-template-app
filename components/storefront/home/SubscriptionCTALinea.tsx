"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useReducedMotion, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { fadeUp, useProgresoScroll } from "@/lib/animation";
import { resolverCtaSeccion } from "@/lib/config/site-content-defaults";

// LA VARIANTE "LÍNEA" (TEMAS-SUBSCRIPTIONCTA-LINEA-1, § eje 5e): del BLOQUE apilado de hoy
// (§ SubscriptionCTABloque — texto en una columna, tarjetas de plan en la otra) a una FRANJA
// HORIZONTAL condensada: el gancho (`eyebrow`), el título y el botón en una línea.
//
// PÉRDIDA DE BYTES VISIBLES, A PROPÓSITO — el owner la tiene que ver: el `subtitulo` y los hasta
// cuatro `bullet1..4` de la sección NO SE RENDERIZAN en esta composición. Los bullets son una LISTA
// y una franja de una línea no la puede llevar; el subtítulo es una frase completa que, sumada al
// gancho + el título + el botón, ya no cabría "en una línea" (dejaría de ser la franja condensada
// que esta variante existe para ser). El DATO no se borra —sigue en `subscriptionCTA.subtitulo`/
// `bullet1..4`, intacto en la base— y vuelve a mostrarse si la sección cambia a la variante
// `bloque`: lo que no se renderiza es sólo de ESTA composición.
//
// El gate de visibilidad (`seccionEsVisible` + el flag de página `paginas.suscripciones.visible`)
// vive en el DISPATCHER (`SubscriptionCTA.tsx`), no acá — mismo patrón que GrindChooser/HeroSection.
// Las tarjetas de plan del teaser (§ SubscriptionCTABloque) tampoco viven acá: son del bloque de dos
// columnas, y una franja de una línea no tiene dónde ponerlas.
//
// ANGOSTO: una franja de una línea no entra en una pantalla angosta, así que se resuelve con el
// MISMO patrón que ya usa el pie de página para el mismo problema (`StoreFooter`, la "Bottom Bar":
// `flex-col` apilado → `sm:flex-row` una línea) — no se inventa un mecanismo nuevo. Bajo `sm` el
// texto (gancho + título) se apila centrado sobre los botones; desde `sm` los dos quedan en la misma
// fila, el texto a la izquierda y los botones a la derecha.
//
// EL SEGUNDO BOTÓN (§ MUESTRARIO-SECCION-CTA-1, MEDIDO contra `.cta-strip` del prototipo,
// `docs/prototipos/cafeone/index.html:313-320`, "Únete al club" + "Explorar" — DOS botones, no uno):
// `subscriptionCTA.ctaSecundarioLabel`/`.ctaSecundarioDestino` resuelven el href con
// `resolverCtaSeccion` — vacío = sin segundo botón, byte-idéntico. Va con estilo SECUNDARIO (borde,
// no relleno), igual tratamiento que `hero.ctaSecundarioLabel` en `HeroCurtina`. El PRIMER botón
// (`ctaLabel`) no cambia: sigue con href fijo a `/suscripciones`, no editable.
//
// LA IMAGEN DE FONDO OPCIONAL (§ MUESTRARIO-CTA-BANNER-FOTO-1, MEDIDO contra `.cta-strip` del
// prototipo — foto a sangre completa + velo degradado + parallax `[data-parallax]`,
// `js/home.js:303-307`: `translateY((p-0.5)*-10%)` sobre el progreso CRUDO de scroll de la sección).
// `subscriptionCTA.imagenFondo` vacío (default, Nayoli incluida) → el fondo SÓLIDO de hoy,
// byte-idéntico. Con imagen: CERO piezas nuevas del motor de scroll — `useProgresoScroll`
// (`lib/animation.ts`) es el MISMO hook que ya usa `Marquesina.tsx`, y la transformación
// `translateY` de arriba se calcula ACÁ inline (una sola línea, no amerita una función nueva en
// `lib/animation.ts`, fuera de `touches:` de este slice).
//
// EL VELO reusa `--sf-velo` (`app/globals.css`), el MISMO token que Marquesina/HeroMedia — nunca un
// rgba nuevo. Es un degradado de DOS paradas, no las tres de `HeroMedia.tsx`
// (`from-tinta/60 via-transparent to-velo`): esa `via-transparent` deja CERO protección a medio
// camino, y tiene sentido ahí porque el texto vive en el PIE de un hero de viewport completo, lejos
// del centro. Acá el contenido va CENTRADO en una franja corta (py-8): un hueco transparente a
// mitad de camino caería justo donde vive el texto. Se omite ese stop y el degradado corre entre los
// MISMOS DOS extremos que `HeroMedia.tsx` ya calibró y midió (`--sf-tinta`/60 → `--sf-velo`), así que
// el piso de protección en TODA la franja es el 60% que ese docstring ya midió en 4.68:1–5.32:1
// sobre tres fotos claras de referencia (AA, ≥4.5:1) — nunca por debajo de eso.
//
// MOVIMIENTO REDUCIDO, NO NEGOCIABLE (mismo gate que Marquesina/BrandStoryCentrada/Origen):
// `estatico` (preview del editor, que no puede scrollear de verdad, o `prefers-reduced-motion`) deja
// la imagen QUIETA, sin desplazamiento — nunca a medio camino de un recorrido que no avanza.
//
// `SubscriptionCTABloque` (la variante canónica, la de Nayoli) NO LEE `imagenFondo` — no se toca.
export default function SubscriptionCTALinea({ style }: { style?: React.CSSProperties } = {}) {
  const { subscriptionCTA, paginas } = useSiteContent();
  const preview = useIsPreview();
  const reduce = useReducedMotion();
  const estatico = preview || !!reduce;
  const ctaSecundarioHref = resolverCtaSeccion(subscriptionCTA.ctaSecundarioLabel, subscriptionCTA.ctaSecundarioDestino, paginas);
  const tieneImagenFondo = subscriptionCTA.imagenFondo.trim() !== "";

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
      className={`relative overflow-hidden py-8${tieneImagenFondo ? "" : " bg-[var(--sf-banda,var(--sf-tinta-2))]"}`}
      style={style}
    >
      {tieneImagenFondo && (
        <div className="absolute inset-0" aria-hidden="true">
          {/* La caja del parallax se extiende 6% arriba/abajo (§ arriba): el `translateY` de
              ±5% de su propio alto (≤ 5% de 112%) nunca expone un borde vacío. */}
          <motion.div className="absolute inset-x-0 top-[-6%] bottom-[-6%]" style={{ y: parallaxY }}>
            <Image src={subscriptionCTA.imagenFondo} alt="" fill sizes="100vw" className="object-cover" />
          </motion.div>
          <div className="absolute inset-0 bg-linear-to-b from-[var(--sf-tinta)]/60 to-[var(--sf-velo)]" />
        </div>
      )}
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* En preview, `whileInView`→`animate` con `initial={false}`: la vista escalada no dispara
            la intersección (como HeroSection/BrandStory/SubscriptionCTABloque). Fuera de preview,
            idéntico a cualquier otra sección. */}
        <motion.div
          initial={preview ? false : "hidden"}
          animate={preview ? "visible" : undefined}
          whileInView={preview ? undefined : "visible"}
          viewport={preview ? undefined : { once: true }}
          variants={fadeUp}
          className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:text-left"
        >
          {/* El gancho y el título en la MISMA línea (`items-baseline`, `flex-wrap` por si el título
              es largo): son los dos primeros de los tres elementos que esta franja compone. Mismos
              tokens `--sf-sobre-banda` que el bloque — la composición cambia, no la paleta. */}
          <div className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 sm:justify-start">
            {subscriptionCTA.eyebrow && (
              <p className="text-[var(--sf-sobre-banda,var(--sf-tostado))] text-xs tracking-[0.2em] uppercase">
                {subscriptionCTA.eyebrow}
              </p>
            )}
            <h2 className="text-xl sm:text-2xl font-playfair text-[var(--sf-sobre-banda,white)]">
              {subscriptionCTA.titulo}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/suscripciones"
              className="inline-flex shrink-0 items-center gap-2 bg-[var(--sf-accion,var(--sf-tostado))] hover:bg-[var(--sf-tostado-4)] text-[var(--sf-tinta)] font-semibold px-6 py-3 sf-pildora text-sm transition-all hover:-translate-y-0.5"
            >
              {subscriptionCTA.ctaLabel} <ArrowRight className="w-4 h-4" />
            </Link>
            {ctaSecundarioHref && (
              <Link
                href={ctaSecundarioHref}
                className="inline-flex shrink-0 items-center gap-2 border border-[var(--sf-linea-sobre,white)]/30 px-6 py-3 sf-pildora text-sm font-medium text-[var(--sf-sobre-banda,white)] transition-all hover:border-[var(--sf-linea-sobre,white)]/60 hover:bg-white/10"
              >
                {subscriptionCTA.ctaSecundarioLabel}
              </Link>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
