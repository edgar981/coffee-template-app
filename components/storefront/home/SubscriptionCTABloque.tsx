"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { planesDeSuscripcion, planesDelTeaser, gridColsTeaser } from "@/lib/storefront/planes-suscripcion";

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } };

// LA VARIANTE "BLOQUE" (TEMAS-SUBSCRIPTIONCTA-LINEA-1, § eje 5e): la CANÓNICA — el layout de HOY,
// verbatim (texto a un lado, tarjetas de plan del teaser al otro, `grid-cols-1 lg:grid-cols-2`). Es
// el mismo componente que vivía en `SubscriptionCTA.tsx` antes de que esa sección ganara variantes;
// se movió acá tal cual, sin reescribir un byte, para abrirle el slot a "linea" (§ SubscriptionCTALinea).
//
// El gate de visibilidad (`seccionEsVisible` + el flag de página `paginas.suscripciones.visible`)
// vive en el DISPATCHER (`SubscriptionCTA.tsx`), no acá — mismo patrón que GrindChooser/HeroSection.
//
// Las tarjetas de plan son DATO: leen la MISMA sección `suscripcionPlanes` que /suscripciones (§ Backlog
// #49, opción 1) → las dos superficies no divergen. El teaser LIMITA los planes (`planesDelTeaser`, § d):
// es un anzuelo que enlaza a /suscripciones, no el grid completo. El destaque sale del dato
// (`plan.destacado`, el `destacadoSlot` de la sección), no del `i===1` hardcodeado de antes. El href del
// CTA es estructura (`/suscripciones`), sólo el label es editable.
export default function SubscriptionCTABloque({ style }: { style?: React.CSSProperties } = {}) {
  const { subscriptionCTA, suscripcionPlanes } = useSiteContent();
  const preview = useIsPreview();
  const planesTeaser = planesDelTeaser(planesDeSuscripcion(suscripcionPlanes));

  const beneficios = [
    subscriptionCTA.bullet1,
    subscriptionCTA.bullet2,
    subscriptionCTA.bullet3,
    subscriptionCTA.bullet4,
  ].filter(b => b.trim() !== ""); // vacíos omitidos → la lista se cierra sin hueco

  return (
    <section className="py-20 bg-[var(--sf-banda,var(--sf-tinta-2))]" style={style}>
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
              {/* `--sf-tostado` era FIJO (§ eje 5b, home-2 — mismo hueco que el eyebrow del hero):
                  `--sf-sobre-banda` con `--sf-tostado` de fallback preserva hoy y se adapta por
                  esquema. El bullet-dot y las tarjetas de plan del teaser NO se tocan: el primero es
                  decorativo (no texto), las segundas son tarjetas self-contained con su propio par
                  acento/acento-txt, independiente del esquema de la sección.
                  EL TÍTULO/SUBTÍTULO/BENEFICIOS (§ eje 5b, home-3) estaban en `--sf-sobre`
                  —floreado contra la TARJETA— y daban 1.07:1 al asignar 'crema' a esta banda
                  (canónica oscura). Se apoyan DIRECTO en el fondo de la banda: el título va a
                  `--sf-sobre-banda`; subtítulo/beneficios (con el alfa de diseño) van a
                  `--sf-sobre-banda-suave`, SIN el modificador `/NN` de Tailwind encima (reduciría el
                  `texto-suave` ya floreado por debajo de AA), con el alfa horneado en el fallback
                  (`color-mix(in oklab, white NN%, transparent)` — la MISMA fórmula que Tailwind
                  genera para `/NN` — así que sin esquema el resultado es el mismo píxel que
                  `text-white/NN` de siempre). */}
              {subscriptionCTA.eyebrow && (
                <p className="text-[var(--sf-sobre-banda,var(--sf-tostado))] text-xs tracking-[0.2em] uppercase mb-3">{subscriptionCTA.eyebrow}</p>
              )}
              <h2 className="text-4xl font-playfair text-[var(--sf-sobre-banda,white)] mb-4">{subscriptionCTA.titulo}</h2>
              <p className="text-[var(--sf-sobre-banda-suave,color-mix(in_oklab,white_60%,transparent))] mb-8 leading-relaxed">{subscriptionCTA.subtitulo}</p>
              <div className="space-y-3 mb-8">
                {beneficios.map((b, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-[var(--sf-sobre-banda-suave,color-mix(in_oklab,white_70%,transparent))]">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--sf-tostado)]" />
                    {b}
                  </div>
                ))}
              </div>
              <Link href="/suscripciones" className="inline-flex items-center gap-2 bg-[var(--sf-accion,var(--sf-tostado))] hover:bg-[var(--sf-tostado-4)] text-[var(--sf-tinta)] font-semibold px-8 py-4 sf-pildora text-sm transition-all hover:-translate-y-0.5">
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
                   tarjeta con `opacity-70` (antes `text-white/70`, que fijaba blanco).
                   EL NOMBRE DEL PLAN (§ TEMAS-P6-FAMILIAS-2) leía `--sf-tostado` fijo, sin piso
                   contra NINGUNA de las dos superficies —3,135:1 sobre `acento`, 1,378:1 sobre
                   `acento-2`, medido en VETA—. `sobre-acento`/`sobre-acento-2` GANAN PISO contra
                   la superficie que cada rama realmente pinta, con fallback a `--sf-tostado`
                   (Nayoli, sin raíces custom, sigue viendo el tostado de hoy). */
                <div key={p.slot} className={`rounded-2xl p-5 ${p.destacado ? 'bg-[var(--sf-acento)] text-[var(--sf-acento-txt)]' : 'bg-[var(--sf-acento-2)] text-white'}`}>
                  <p className={`text-xs font-medium mb-2 ${p.destacado ? 'text-[var(--sf-sobre-acento,var(--sf-tostado))]' : 'text-[var(--sf-sobre-acento-2,var(--sf-tostado))]'}`}>{p.nombre}</p>
                  <p className="opacity-70 text-xs leading-snug">{p.descripcion}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>
  )
}
