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
  /** EL TÍTULO QUIETO (§ ONIX-PAGINAS-FIDELIDAD-1, el spec item 1) — sin desplazamiento con el
   *  scroll, al ras de la izquierda, sangrando por el borde inferior: la maqueta aprobada de
   *  /suscripciones y /nosotros. Default `false`: /tienda CONSERVA su movimiento tal cual —
   *  "nadie lo pidió cambiar" — así que esto no cambia nada ahí salvo el fix de acentos de abajo,
   *  que es universal.
   *
   *  Se logra con `Movimiento id={quieto ? undefined : 'T06'}`: `id` AUSENTE ya hace que esa pieza
   *  NO monte ningún wrapper propio (§ Movimiento.tsx — "sin un id, este componente no renderiza
   *  ningún nodo propio"), así que el título queda PLANO, sin animación — y esto no toca
   *  `lib/movimiento/` ni `animaciones.ts` para nada: T06 sigue intacto para quien lo pida. */
  quieto?: boolean;
}

export default function Apertura({
  imagen, rotuloIzquierda, rotuloDerecha, titulo, alto = ALTO_POR_DEFECTO, quieto = false,
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
          {/* EL VELO (§ ONIX-PAGINAS-FIDELIDAD-1, el spec item 3 — "section colors") — la maqueta
              oscurece hasta 35% abajo (`rgba(16,36,7,.35)` = tinta al 35%), no 80%: antes el degradé
              llegaba a tinta/80 y se veía más oscuro y más verde de lo aprobado. `color-mix` en vez
              de un `to-[var(--sf-tinta)]/35` porque el stop intermedio de la maqueta NO es
              transparente-a-mitad (el default de Tailwind): es transparente A LOS 30%, así que el
              degradé entero se escribe como un `linear-gradient` arbitrario con sus TRES stops
              exactos — `color-mix` deriva el 35% de LA TINTA DEL TENANT, nunca un hex fijo de Onix. */}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18),transparent_30%,color-mix(in_srgb,var(--sf-tinta)_35%,transparent)_100%)]" />
        </>
      )}

      {(rotuloIzquierda || rotuloDerecha) && (
        // CREMA PLENA (§ ONIX-PAGINAS-FIDELIDAD-1, el spec item 3): la maqueta pinta los rótulos de
        // esquina al 100% de opacidad; antes iban a `/60`, que los dejaba apagados contra la foto.
        <div className="relative z-10 flex items-start justify-between px-6 pt-8 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sf-fondo)] sm:px-10">
          <span>{rotuloIzquierda}</span>
          <span>{rotuloDerecha}</span>
        </div>
      )}

      {/* SIN `overflow-hidden` EN ESTE WRAPPER (§ ONIX-PAGINAS-FIDELIDAD-1, el spec item 1 — "sin
          recortar acentos", arreglado en LAS TRES composiciones porque es un defecto, no sólo en las
          dos quietas). Con `leading-[0.82]` el line-box queda más chico que el glifo completo, y
          este wrapper recortaba la TAPA de los acentos («É») contra su propio borde superior — medido:
          «CAFÉ ONIX» perdía la tilde. El recorte que sí hace falta (el sangrado del título por el
          borde inferior de la foto) lo sigue dando el `overflow-hidden` del `<section>` de arriba. */}
      <div className={`relative z-10 mt-auto ${quieto ? 'pl-3 sm:pl-[clamp(12px,1.4vw,24px)]' : 'pb-6 sm:pb-10'}`}>
        <Movimiento id={quieto ? undefined : 'T06'} as="div">
          <h1
            className={
              quieto
                ? // AL RAS DE LA IZQUIERDA, SANGRANDO POR EL BORDE INFERIOR, SIN DESPLAZAMIENTO
                  // (§ ONIX-PAGINAS-FIDELIDAD-1, el spec item 1): el `22vw` mobile sustituye al
                  // `22cqi` de la maqueta — este storefront no tiene container queries armadas
                  // (`container-type`) en ningún ancestro, así que `vw` es el sustituto pragmático
                  // ya sugerido por la revisión, no una invención.
                  'sf-movimiento-gigante select-none whitespace-normal font-playfair text-[22vw] uppercase leading-[0.86] tracking-[-0.01em] text-[var(--sf-fondo)] sm:whitespace-nowrap sm:text-[clamp(84px,14vw,220px)] sm:leading-[0.82]'
                : 'sf-movimiento-gigante select-none whitespace-nowrap font-playfair text-[clamp(60px,14vw,220px)] uppercase leading-[0.82] text-[var(--sf-fondo)]'
            }
          >
            {titulo}
          </h1>
        </Movimiento>
      </div>
    </section>
  );
}
