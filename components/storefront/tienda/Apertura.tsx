"use client";

// LA APERTURA — pieza COMPARTIDA (§ ONIX-PAGINAS-PIEZAS-COMPARTIDAS-1). Nació como la composición
// «Apertura» del encabezado de /tienda (§ TIENDA-ONIX-CARTELERA-1, `TiendaEncabezado.tsx`): foto a
// pantalla completa con el H1 gigante encima; sin foto, una superficie de color tinta con el mismo
// título. El owner aprobó el 2026-10-11 la maqueta de /suscripciones y /nosotros con esta MISMA
// pieza al inicio de cada una, con SU PROPIO contenido (§ ONIX-PAGINAS-COMPOSICIONES-CENSO-1) — así
// que se extrae para que las tres páginas la monten sin reimplementarla.
//
// PRESENTACIONAL: recibe TODO por props, nunca `useSiteContent`/`useIsPreview` adentro. El llamador
// decide de qué sección sale cada valor (en /tienda, `TiendaEncabezado.tsx` sigue resolviendo el
// fallback `titulo || negocio || 'Nuestra Tienda'` — esa lógica es de ESA composición, no de la
// pieza) y qué `alto` usar.
import Image from 'next/image';
import Movimiento from '@/components/storefront/movimiento/Movimiento';

/** El alto de /tienda (§ TIENDA-ONIX-CARTELERA-1, la forma C aprobada) — el DEFAULT de esta pieza,
 *  para que /tienda siga pidiendo exactamente lo de siempre sin declarar el literal en su propio
 *  call site. Un literal de clase COMPLETO, nunca interpolado: Tailwind JIT escanea el texto del
 *  archivo que lo escribe — acá, o el call site que pase un `alto` propio. */
const ALTO_POR_DEFECTO = 'h-[85vh] min-h-[480px]';

export interface AperturaProps {
  imagen?: string;
  rotuloIzquierda?: string;
  rotuloDerecha?: string;
  titulo: string;
  /** Default = el alto de /tienda (`ALTO_POR_DEFECTO`). Un segundo consumidor con otra proporción
   *  pasa su propio literal de clase completo. */
  alto?: string;
}

export default function Apertura({
  imagen, rotuloIzquierda, rotuloDerecha, titulo, alto = ALTO_POR_DEFECTO,
}: AperturaProps) {
  return (
    <section className={`relative flex ${alto} w-full flex-col overflow-hidden bg-[var(--sf-tinta)]`}>
      {imagen && (
        <>
          {/* QUALITY 85 (§ ONIX-PAGINAS-PIEZAS-COMPARTIDAS-1, el pedido del owner del 2026-10-11:
              "The current ones don't look in HD quality") — antes sin `quality` propio (default 75
              de `next/image`), igual que el riel de Presentaciones antes de `quality={90}`
              (`GrindChooserRiel.tsx`). `85` ya está en `next.config.ts` → `images.qualities`. */}
          <Image
            src={imagen}
            alt=""
            fill
            priority
            sizes="100vw"
            quality={85}
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[var(--sf-tinta)]/40 via-transparent to-[var(--sf-tinta)]/80" />
        </>
      )}

      {(rotuloIzquierda || rotuloDerecha) && (
        <div className="relative z-10 flex items-start justify-between px-6 pt-8 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sf-fondo)]/60 sm:px-10">
          <span>{rotuloIzquierda}</span>
          <span>{rotuloDerecha}</span>
        </div>
      )}

      <div className="relative z-10 mt-auto overflow-hidden pb-6 sm:pb-10">
        <Movimiento id="T06" as="div">
          <h1 className="sf-movimiento-gigante select-none whitespace-nowrap font-playfair text-[clamp(60px,14vw,220px)] uppercase leading-[0.82] text-[var(--sf-fondo)]">
            {titulo}
          </h1>
        </Movimiento>
      </div>
    </section>
  );
}
