"use client";

// EL INTERLUDIO «PLANO» — pieza COMPARTIDA (§ ONIX-PAGINAS-PIEZAS-COMPARTIDAS-1). Nació como la
// composición «Plano» del interludio de /tienda (§ TIENDA-ONIX-CARTELERA-1, `TiendaInterludio.tsx`):
// una foto documental a sangre con un pie en micro-mayúsculas — sin el arco ni la cita atribuida de
// «Retrato y cita». El owner aprobó el 2026-10-11 montarla también en /suscripciones y /nosotros,
// cada una con SU PROPIO pie (§ ONIX-PAGINAS-COMPOSICIONES-CENSO-1).
//
// § ONIX-APERTURA-MOVIL-INTERLUDIO-PARALLAX-1 — gana PARALLAX (`Movimiento id="I03"`, "la foto se
// mueve más despacio que la página dentro de su marco", § catalogo.ts). `i03()` (animaciones.ts)
// mueve `raiz.firstElementChild` de `yPercent -8` a `8`; para que ese desplazamiento NUNCA exponga
// un borde vacío, el hijo que se mueve es una capa SOBREDIMENSIONADA (`-top-[12%] -bottom-[12%]`,
// el MISMO margen del prototipo aprobado — `docs/movimiento/catalogo-movimiento.html`, `.foto
// .capa{inset:-12% 0}`) — 12% de margen por lado cubre de sobra el `±8% × 1.24` (≈9.92%) que la
// propia capa recorre, en escritorio y en celular (la proporción es relativa al alto del marco, no
// a un breakpoint). El marco (`Movimiento` en sí) es `absolute inset-0`: sin tamaño propio por
// `position:static` colapsaría a alto 0 (un hijo absoluto no aporta alto a un padre `static`), y el
// `-top/-bottom` en % resolvería contra 0. El propio `<section>` (ya `overflow-hidden`) recorta la
// capa sobredimensionada al marco visible — `object-cover` cubre la caja entera sea cual sea su
// alto, así que nunca deja hueco por construcción; el margen del 12% es lo que evita que el MOVIMIENTO
// exponga el borde de esa caja (no el object-cover, que nunca lo expone).
//
// PRESENTACIONAL: recibe TODO por props, nunca `useSiteContent`/`useIsPreview` adentro — el gate de
// visibilidad (¿hay imagen?) y la lectura del contenido siguen viviendo en la composición de cada
// página, no acá.
import Image from 'next/image';
import { motion } from 'framer-motion';
import Movimiento from '@/components/storefront/movimiento/Movimiento';

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
      <Movimiento id="I03" as="div" className="absolute inset-0">
        <div className="absolute inset-x-0 -top-[12%] -bottom-[12%]">
          {/* QUALITY 85 (§ ONIX-PAGINAS-PIEZAS-COMPARTIDAS-1, el pedido del owner del 2026-10-11) —
              antes sin `quality` propio (default 75). `85` ya está en `next.config.ts` →
              `images.qualities`. */}
          <Image
            src={imagen}
            alt={pie || ''}
            fill
            sizes="100vw"
            quality={85}
            className="object-cover"
          />
        </div>
      </Movimiento>
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
