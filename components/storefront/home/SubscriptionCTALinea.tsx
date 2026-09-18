"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { fadeUp } from "@/lib/animation";

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
// texto (gancho + título) se apila centrado sobre el botón; desde `sm` los dos quedan en la misma
// fila, el texto a la izquierda y el botón a la derecha.
export default function SubscriptionCTALinea({ style }: { style?: React.CSSProperties } = {}) {
  const { subscriptionCTA } = useSiteContent();
  const preview = useIsPreview();

  return (
    <section className="py-8 bg-[var(--sf-banda,var(--sf-tinta-2))]" style={style}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
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
          <Link
            href="/suscripciones"
            className="inline-flex shrink-0 items-center gap-2 bg-[var(--sf-tostado)] hover:bg-[var(--sf-tostado-4)] text-[var(--sf-tinta)] font-semibold px-6 py-3 sf-pildora text-sm transition-all hover:-translate-y-0.5"
          >
            {subscriptionCTA.ctaLabel} <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
