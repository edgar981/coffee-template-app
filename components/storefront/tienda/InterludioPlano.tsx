"use client";

// EL INTERLUDIO «PLANO» — pieza COMPARTIDA (§ ONIX-PAGINAS-PIEZAS-COMPARTIDAS-1). Nació como la
// composición «Plano» del interludio de /tienda (§ TIENDA-ONIX-CARTELERA-1, `TiendaInterludio.tsx`):
// una foto documental a sangre con un pie en micro-mayúsculas — sin el arco ni la cita atribuida de
// «Retrato y cita». El owner aprobó el 2026-10-11 montarla también en /suscripciones y /nosotros,
// cada una con SU PROPIO pie (§ ONIX-PAGINAS-COMPOSICIONES-CENSO-1).
//
// PRESENTACIONAL: recibe TODO por props, nunca `useSiteContent`/`useIsPreview` adentro — el gate de
// visibilidad (¿hay imagen?) y la lectura del contenido siguen viviendo en la composición de cada
// página, no acá.
import Image from 'next/image';
import { motion } from 'framer-motion';

export interface InterludioPlanoProps {
  imagen: string;
  pie?: string;
  preview: boolean;
}

export default function InterludioPlano({ imagen, pie, preview }: InterludioPlanoProps) {
  return (
    <motion.section
      initial={preview ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="relative aspect-[4/5] w-full overflow-hidden sm:aspect-[21/9]"
    >
      {/* QUALITY 85 (§ ONIX-PAGINAS-PIEZAS-COMPARTIDAS-1, el pedido del owner del 2026-10-11) — antes
          sin `quality` propio (default 75). `85` ya está en `next.config.ts` → `images.qualities`. */}
      <Image
        src={imagen}
        alt={pie || ''}
        fill
        sizes="100vw"
        quality={85}
        className="object-cover"
      />
      {pie && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--sf-tinta)]/70 to-transparent px-6 py-6 sm:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sf-fondo)]/90">
            {pie}
          </p>
        </div>
      )}
    </motion.section>
  );
}
