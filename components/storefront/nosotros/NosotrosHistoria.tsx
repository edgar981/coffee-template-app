"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { fadeUp } from "@/lib/animation";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { contenedorAnchoClase } from "@/lib/config/themes";

// La HISTORIA LARGA de /nosotros. `eyebrow` y `parrafo2/3` son opcionales → se omiten vacíos;
// `titulo` y `parrafo1` vienen resueltos. Preview ESTÁTICO (`whileInView`→`animate` con
// `initial={false}`), como las secciones de la home, para que la vista en vivo del editor (tanda 1,
// commit 3) no lo deje invisible.
//
// `imagen` (§ NOSOTROS-COMPOSICION-1): OPCIONAL. **Vacía → EXACTAMENTE el render de antes de este
// slice, byte a byte** (la bifurcación ocurre ANTES de tocar el layout, así que el árbol de la rama
// sin imagen es literalmente el JSX de siempre, sólo factorizado en `texto`). Con imagen: composición
// imagen-con-texto a DOS COLUMNAS en escritorio, apiladas en móvil — medida contra el `image_with_text`
// con el que abre el about del tema real (§ CENSO-NOSOTROS-TEMA-REAL-1). El `alt=""` es decorativo,
// mismo criterio que `marquesina.imagen` (Marquesina.tsx): el texto adjunto ya cuenta la historia.
export default function NosotrosHistoria() {
  const { nosotrosHistoria, navTratamiento } = useSiteContent();
  const preview = useIsPreview();
  const { eyebrow, titulo, parrafo1, parrafo2, parrafo3, imagen } = nosotrosHistoria;
  const parrafos = [parrafo1, parrafo2, parrafo3].filter(p => p.trim() !== "");
  const tieneImagen = imagen.trim() !== "";
  // EL CONTENEDOR (§ PARIDAD-ANCHO-CONTENIDO-1) — SÓLO para la rama CON imagen (dos columnas,
  // abajo). La rama SIN imagen (`max-w-3xl`, unas líneas más abajo) es un CONTENEDOR DE LECTURA
  // —prosa en una sola columna— que se queda ANGOSTO a propósito, en las DOS geometrías: ensanchar
  // el ancho de línea de un párrafo de texto corrido lo hace más difícil de leer, no más fiel al
  // prototipo (§ el spec de este slice, que nombra este caso como excepción legítima).
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);

  const texto = (
    <motion.div
      initial={preview ? false : "hidden"}
      animate={preview ? "visible" : undefined}
      whileInView={preview ? undefined : "visible"}
      viewport={preview ? undefined : { once: true }}
      variants={fadeUp}
    >
      {eyebrow && <p className="text-[var(--sf-acento-texto)] text-xs font-medium tracking-[0.2em] uppercase mb-3">{eyebrow}</p>}
      {/* h1: es el encabezado principal de la PÁGINA (la home usa h2 por sección). */}
      <h1 className="text-4xl sm:text-5xl font-playfair text-[var(--sf-tinta)] leading-tight mb-8">{titulo}</h1>
      <div className="space-y-6">
        {parrafos.map((p, i) => (
          <p key={i} className="text-[var(--sf-acento-2)]/80 leading-relaxed text-lg">{p}</p>
        ))}
      </div>
    </motion.div>
  );

  if (!tieneImagen) {
    return (
      <section className="py-24 bg-[var(--sf-fondo)]">
        {/* Contenedor de LECTURA — angosto a propósito, NO `contenedorAnchoClase` (§ arriba). */}
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {texto}
        </div>
      </section>
    );
  }

  return (
    <section className="py-24 bg-[var(--sf-fondo)]">
      <div className={`${contenedorClase} mx-auto`}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {texto}
          <motion.div
            initial={preview ? false : { opacity: 0, scale: 0.95 }}
            animate={preview ? { opacity: 1, scale: 1 } : undefined}
            whileInView={preview ? undefined : { opacity: 1, scale: 1 }}
            viewport={preview ? undefined : { once: true }}
            transition={preview ? undefined : { duration: 0.6 }}
            className="relative aspect-[3/4] overflow-hidden rounded-2xl"
          >
            <Image src={imagen} alt="" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
