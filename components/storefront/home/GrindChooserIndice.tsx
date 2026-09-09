"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { fadeUp } from "@/lib/animation";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { tarjetasDePresentaciones } from "@/lib/storefront/presentaciones";

// LA VARIANTE "ÍNDICE" (§ eje 5e): de dos cortinas oscuras gemelas a un índice — filas numeradas,
// encabezado alineado a la izquierda, foto chica al margen y divisor entre ítems. Ya no hay texto
// blanco sobre foto —la textura que hacía que dos fincas se leyeran clonadas—. Aguanta 2, 3 o 4 filas
// sin tocar el grid: es una LISTA vertical, no un grid (`gridColsPresentaciones` no aplica acá).
//
// TOKENS: superficie ON-BAND (la fila se apoya en la banda, clara por defecto, pero sigue al ESQUEMA
// si se le asigna uno a `presentaciones`), no la tile oscura fija del mosaico. `--sf-sobre-banda` /
// `--sf-sobre-banda-suave` AUTO-FLIPEAN con el esquema (§ esquema-style.ts); los fallbacks reproducen
// el mismo par que Newsletter usa sobre una banda CLARA (`--sf-tinta`/`--sf-texto`), no el blanco fijo
// de Hero/BrandStory/Subscription (esas son bandas OSCURAS).
//
// El gate de visibilidad (`seccionEsVisible`) vive en el DISPATCHER (`GrindChooser.tsx`), no acá.
//
// EL `negocio` DEL ALT LLEGA POR PROP, no por `useSiteSettings()` — mismo motivo que el mosaico
// (§ GrindChooserMosaico): se monta también en la vista previa del panel, sin el SiteSettingsProvider
// del storefront.
export default function GrindChooserIndice({ negocio, style }: { negocio?: string; style?: React.CSSProperties }) {
  const { presentaciones } = useSiteContent();
  const preview = useIsPreview();

  const tarjetas = tarjetasDePresentaciones(presentaciones);

  return (
    <section className="py-20 bg-[var(--sf-banda,var(--sf-fondo))]" style={style}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* En el preview escalado, `whileInView` no dispara (la intersección no llega) → se cambia a
            `animate` con `initial={false}`, asentado desde el primer render. Fuera de preview, idéntico. */}
        <motion.div
          initial={preview ? false : "hidden"}
          animate={preview ? "visible" : undefined}
          whileInView={preview ? undefined : "visible"}
          viewport={preview ? undefined : { once: true }}
          variants={fadeUp}
          className="mb-12 text-left"
        >
          {presentaciones.eyebrow && (
            <p className="text-[var(--sf-sobre-banda,var(--sf-acento-texto))] text-xs font-medium tracking-[0.2em] uppercase mb-2">{presentaciones.eyebrow}</p>
          )}
          <h2 className="text-3xl sm:text-4xl font-playfair text-[var(--sf-sobre-banda,var(--sf-tinta))]">{presentaciones.titulo}</h2>
        </motion.div>

        <div className="divide-y divide-[var(--sf-linea)] border-t border-[var(--sf-linea)]">
          {tarjetas.map((op, i) => (
            <motion.div
              key={i}
              initial={preview ? false : "hidden"}
              animate={preview ? "visible" : undefined}
              whileInView={preview ? undefined : "visible"}
              viewport={preview ? undefined : { once: true }}
              variants={fadeUp}
              transition={{ delay: i * 0.08 }}
            >
              {/* `data-sf-tarjeta`: marcador INERTE del slot (1-4) para el puente vista→formulario del
                  editor (§ Backlog #46), gemelo del mosaico — el mecanismo (`onClicTarjeta` +
                  `.closest('[data-sf-tarjeta]')`) es agnóstico de markup. Sólo en preview; en la tienda
                  del visitante el atributo es `undefined` y React lo omite. */}
              <Link
                href={op.href}
                data-sf-tarjeta={preview ? op.slot : undefined}
                className="group flex items-center gap-5 sm:gap-6 py-6"
              >
                {/* Número de POSICIÓN visible (01, 02…), no el `slot` —que puede saltar si una tarjeta
                    opcional se llena fuera de orden—. Sólo decora el orden que el visitante VE. */}
                <span className="w-8 shrink-0 text-sm font-medium tabular-nums text-[var(--sf-sobre-banda-suave,var(--sf-texto))]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xl sm:text-2xl font-playfair text-[var(--sf-sobre-banda,var(--sf-tinta))] mb-1 group-hover:underline">
                    {op.label}
                  </h3>
                  <p className="text-sm text-[var(--sf-sobre-banda-suave,var(--sf-texto))] max-w-md">{op.copy}</p>
                </div>
                {/* Foto chica al margen. Sin foto: hueco de marca (`--sf-linea`) — nunca un
                    `<img src="">` roto, mismo criterio que el mosaico. */}
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-[var(--sf-linea)] sm:h-24 sm:w-24">
                  {op.img && (
                    <Image
                      src={op.img}
                      alt={negocio ? `${negocio} ${op.label}` : op.label}
                      fill
                      sizes="96px"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
