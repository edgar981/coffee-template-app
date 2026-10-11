"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { fadeUp } from "@/lib/animation";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { useModoEditorActivo } from "@/components/storefront/ModoEditor";
import CampoEditable, { HuecoImagenOpcional } from "@/components/storefront/CampoEditable";

// LA «SINOPSIS PARTIDA» de /nosotros (§ ONIX-NOSOTROS-APERTURA-SINOPSIS-1, sobre ONIX-PAGINAS-
// COMPOSICIONES-CENSO-1 — el owner aprobó el 2026-10-11 la maqueta «Tres escenas» de Onix). Segunda
// composición de `nosotrosHistoria` (§ REGISTRY.nosotrosHistoria.variantes), hermana de
// `NosotrosHistoriaRelato` bajo el mismo dispatcher (`NosotrosHistoria.tsx`).
//
// REUSA tres campos del modelo, ninguno nuevo: `eyebrow` → el rótulo «SINOPSIS» (mismo dato que el
// kicker de «Relato», sólo que reposicionado — `tiendaInterludio` ya reusa `imagen` entre sus dos
// composiciones por el mismo criterio); `parrafo1` → el ÚNICO párrafo que esta composición muestra
// (`parrafo2`/`parrafo3` quedan SIN EFECTO, § "lo que no se muestra no se borra" — siguen editables
// para cuando el dueño vuelva a «Relato»); `imagen` → el retrato a sangre. `retratoNombre` es el
// ÚNICO campo NUEVO: opcional, alimenta el pie «[NOMBRE] · CAFICULTOR» — vacío, el retrato no lleva
// pie (criterio opcional de siempre, no un claim fabricado).
//
// ESCRITORIO: mitades 50/50 con alto mínimo 640px y un filete vertical de 1px entre ellas (tinta al
// 15%, § refero-onix-paginas.md: "Filetes de 1 px (tinta al 15 %) y radio 0 en todo"). CELULAR: el
// retrato en 4:5 ARRIBA del texto (`order-1`/`order-2`, invertido contra el DOM del texto que va
// segundo) — el spec lo pide explícito, a diferencia de «Relato» (imagen siempre después del texto).
//
// SIN RETRATO (fuera de modo editor): la columna cae al mismo fondo tinta llana que la pieza
// `Apertura` usa sin foto — nunca un `<img src="">` roto. En modo editor, el hueco "Agregar foto"
// (mismo patrón que `NosotrosHistoriaRelato`) para que el operador tenga dónde subirla.
export default function NosotrosHistoriaSinopsis() {
  const { nosotrosHistoria } = useSiteContent();
  const preview = useIsPreview();
  const activo = useModoEditorActivo();
  const { eyebrow, parrafo1, imagen, retratoNombre } = nosotrosHistoria;
  const tieneImagen = imagen.trim() !== "";
  const pie = retratoNombre.trim() !== "" ? `${retratoNombre} · CAFICULTOR` : "";

  return (
    <section className="w-full bg-[var(--sf-fondo)]">
      <div className="grid grid-cols-1 lg:min-h-[640px] lg:grid-cols-2">
        {/* TEXTO — primero en el DOM (mobile: debajo del retrato, § `order-2`); a la izquierda en
            escritorio (`lg:order-1`). */}
        <div className="order-2 flex items-center px-6 py-16 lg:order-1 lg:px-16 lg:py-0">
          <motion.div
            initial={preview ? false : "hidden"}
            animate={preview ? "visible" : undefined}
            whileInView={preview ? undefined : "visible"}
            viewport={preview ? undefined : { once: true }}
            variants={fadeUp}
          >
            {eyebrow && (
              <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--sf-acento-texto)]">
                <CampoEditable campo="nosotrosHistoria.eyebrow">{eyebrow}</CampoEditable>
              </p>
            )}
            <p className="max-w-[40ch] font-playfair text-[21px] leading-[1.3] text-[var(--sf-tinta)] lg:text-[28px]">
              <CampoEditable campo="nosotrosHistoria.parrafo1" multilinea>{parrafo1}</CampoEditable>
            </p>
          </motion.div>
        </div>

        {/* RETRATO A SANGRE — primero en el DOM (mobile: arriba); a la derecha en escritorio
            (`lg:order-2`), con el filete vertical de 1px contra la columna de texto. */}
        <motion.div
          initial={preview ? false : { opacity: 0, scale: 0.95 }}
          animate={preview ? { opacity: 1, scale: 1 } : undefined}
          whileInView={preview ? undefined : { opacity: 1, scale: 1 }}
          viewport={preview ? undefined : { once: true }}
          transition={preview ? undefined : { duration: 0.6 }}
          className="relative order-1 aspect-[4/5] overflow-hidden bg-[var(--sf-tinta)] lg:order-2 lg:aspect-auto lg:border-l lg:border-[var(--sf-linea)]/15"
        >
          {tieneImagen ? (
            <CampoEditable campo="nosotrosHistoria.imagen" tipo="imagen">
              <Image src={imagen} alt={pie || ""} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
            </CampoEditable>
          ) : activo ? (
            <HuecoImagenOpcional campo="nosotrosHistoria.imagen" className="absolute inset-0" />
          ) : null}
          {pie && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--sf-tinta)]/70 to-transparent px-6 py-6 sm:px-10">
              {/* El sufijo " · CAFICULTOR" queda FUERA de `CampoEditable`: el overlay de edición en
                  vivo lee `textContent` como valor inicial (§ EditorPuenteVivo.tsx) y lo escribe TAL
                  CUAL de vuelta en `retratoNombre` — envolver el `pie` COMPUTADO lo guardaría con el
                  sufijo duplicado en el siguiente ciclo. */}
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sf-fondo)]/90">
                <CampoEditable campo="nosotrosHistoria.retratoNombre">{retratoNombre}</CampoEditable>
                {" · CAFICULTOR"}
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
