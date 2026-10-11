"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { REGISTRY, seccionEsVisible } from "@/lib/config/site-content-defaults";
import { filasCompletas } from "@/lib/tienda/creditos";
import { CreditosFilas } from "@/components/storefront/tienda/TiendaCreditos";
import CampoEditable from "@/components/storefront/CampoEditable";

// LAS «ESCENAS» de /nosotros (§ ONIX-NOSOTROS-ESCENAS-FICHA-1, sobre ONIX-PAGINAS-COMPOSICIONES-
// CENSO-1 — el owner aprobó el 2026-10-11 la maqueta «Tres escenas» de Onix). El módulo
// still→número+título→dos líneas→créditos, de 1 a 4 veces (`nosotrosEscenas.items`, tope 4, §
// REGISTRY.nosotrosEscenas). NO reemplaza a `nosotrosGaleria` (el masonry) en el modelo: las dos
// secciones conviven como capacidades independientes — Onix llena ésta y deja la otra vacía.
//
// HIDE-ON-EMPTY A DOS NIVELES: el toggle + el array vacío (`seccionEsVisible`, como cualquier
// repeater) oculta la SECCIÓN; `foto.trim() !== ''` oculta cada ÍTEM sin foto (§ el spec: "Sin foto,
// la escena no se muestra") — mismo criterio exacto que `NosotrosGaleria.tsx` con sus `medios`. Si
// las únicas escenas con foto son cero, la sección se oculta IGUAL aunque `items` no esté vacío.
//
// EL ÍNDICE ORIGINAL (`idx`) sobrevive al filtro para el campo editable (slot, no posición — mismo
// criterio que `NosotrosGaleria`); el NÚMERO VISIBLE ("01", "02"…) es la posición ENTRE LAS VISIBLES
// (`i`), NO el slot: es estructura, no contenido, como el "01" de `GrindChooserIndice`/
// `SuscripcionPasos` — sin su propio campo, sin tabular-nums en playfair (el spec agrupa "número y
// título en serif mayúscula a 40px", pero el MISMO renglón de la maqueta (`s-nos-d-1.png`) muestra un
// "01" chico y sans junto a un "COSECHA" grande y serif — el patrón ya establecido en este repo para
// un índice de posición gana sobre la lectura literal de la frase).
//
// LOS CRÉDITOS por escena (1 o 2 filas) REUSAN `CreditosFilas`/`filasCompletas` de /tienda (§
// lib/tienda/creditos.ts) en vez de un segundo JSX de fila etiqueta/valor — los 4 campos planos del
// ítem (`credito1Etiqueta/Valor`, `credito2Etiqueta/Valor`) se empaquetan en un array `CreditoItem[]`
// ad-hoc y se filtran con la MISMA regla ("fila completa = etiqueta Y valor no vacíos"). Sin
// CampoEditable en las filas: mismo criterio que `TiendaCreditos`/`TiendaTaquilla`, se editan desde
// el RepeaterEditor del panel, no inline.
//
// ESPACIADO: `gap-24 sm:gap-[160px]` entre escenas — `gap-24` de Tailwind YA es 96px (coincide con
// "96 px en celular" del spec), así que no hace falta un arbitrario para el caso mobile.
export default function NosotrosEscenas() {
  const { nosotrosEscenas } = useSiteContent();
  const preview = useIsPreview();
  if (!seccionEsVisible(REGISTRY.nosotrosEscenas, nosotrosEscenas)) return null;

  const escenas = nosotrosEscenas.items
    .map((e, idx) => ({ e, idx }))
    .filter(({ e }) => e.foto.trim() !== ""); // defensivo: sin foto no se renderiza una escena
  if (escenas.length === 0) return null;

  return (
    <section className="bg-[var(--sf-fondo)] py-20">
      <div className="flex flex-col gap-24 sm:gap-[160px]">
        {escenas.map(({ e, idx }, i) => {
          const filas = filasCompletas([
            { etiqueta: e.credito1Etiqueta, valor: e.credito1Valor },
            { etiqueta: e.credito2Etiqueta, valor: e.credito2Valor },
          ]);
          return (
            <motion.div
              key={idx}
              initial={preview ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mx-auto w-full max-w-[880px]"
            >
              <div className="relative aspect-[4/5] overflow-hidden sm:aspect-[3/2]">
                <CampoEditable campo={`nosotrosEscenas.items.${idx}.foto`} tipo="imagen">
                  <Image
                    src={e.foto}
                    alt={e.titulo.trim() || "Escena"}
                    fill
                    sizes="(max-width: 640px) 100vw, 880px"
                    className="object-cover"
                  />
                </CampoEditable>
              </div>
              <div className="px-6 pt-8 sm:px-0">
                <div className="flex items-baseline gap-3">
                  <span className="text-sm font-medium tabular-nums text-[var(--sf-texto-suave)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-playfair text-[28px] uppercase leading-tight text-[var(--sf-tinta)] sm:text-[40px]">
                    <CampoEditable campo={`nosotrosEscenas.items.${idx}.titulo`}>{e.titulo}</CampoEditable>
                  </h3>
                </div>
                {e.descripcion.trim() !== "" && (
                  <p className="mt-4 max-w-xl text-[17px] text-[var(--sf-texto)]">
                    <CampoEditable campo={`nosotrosEscenas.items.${idx}.descripcion`} multilinea>
                      {e.descripcion}
                    </CampoEditable>
                  </p>
                )}
                {filas.length > 0 && (
                  <div className="mt-6 max-w-xl">
                    <CreditosFilas filas={filas} />
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
