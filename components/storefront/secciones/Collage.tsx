"use client";

import Image from "next/image";
import Link from "next/link";
import RevelarBloque from "@/components/storefront/RevelarBloque";
import CampoEditable, { HuecoImagenOpcional } from "@/components/storefront/CampoEditable";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { resolverCtaSeccion } from "@/lib/config/site-content-defaults";
import { contenedorAnchoClase } from "@/lib/config/themes";
import { VideoCelda } from "@/components/storefront/nosotros/NosotrosGaleria";
import type { InstanciaCollageContent, InstanciaCollageItem } from "@/lib/config/secciones-instancias";

// LA SECCIÓN "COLLAGE" del catálogo curado de instancias (§ SECCIONES-TIPOS-3) — título opcional +
// de TRES a SEIS ítems (foto o video, con enlace y leyenda corta opcionales), compuestos como un
// mosaico: UNA pieza GRANDE (siempre `items[0]`) + una GRILLA de chicas (el resto), a la izquierda o
// a la derecha de la grande. `disposicion` decide las COLUMNAS de la grilla de chicas ('dos' = una
// fila de dos; 'cuatro' = 2×2) — NO cuántos ítems existen (eso lo fija "de tres a seis", el
// min/max del editor, § DESCRIPTOR_INSTANCIA.collage).
//
// A DIFERENCIA de `NosotrosGaleria` (masonry, proporción NATURAL por foto — la galería ES el
// contenido, sin estructura fija), acá cada celda tiene un ALTO FIJO por su ROL (grande/chica) y
// recorta con `object-cover`: un collage estructurado "una grande + una grilla" necesita que las
// piezas ENCAJEN entre sí, así que no se preservan dimensiones por ítem (§ el descriptor, que por
// eso no declara `w`/`h`). Lo que SÍ se reusa de NosotrosGaleria es su manejo de VIDEO —
// `VideoCelda`, exportada de ahí— porque ESE problema (reproducir en bucle, silenciado, con la
// señal "esto es un video", respetando `prefers-reduced-motion`) es idéntico en los dos.
//
// MÓVIL: SIEMPRE una sola columna, la grande primero y luego las chicas en el orden del array —
// mismo criterio que Columnas/Filas/la galería: apilar es lo que este storefront ya hace con "muchas
// piezas en poco ancho", nunca un carrusel nuevo. El `lado` sólo tiene efecto en escritorio.

const COLS_CHICAS: Record<string, string> = {
  dos: "grid-cols-1",
  cuatro: "grid-cols-2",
};

// LA CAJA (`relative ${className}`, con el alto/aspect-ratio de la celda) SIEMPRE se monta, pase lo
// que pase adentro — a diferencia de delegar la caja a `HuecoImagenOpcional`, que fuera de modo
// editor devuelve `null` (§ CampoEditable.tsx: "+Agregar foto" es sólo una affordance de editor).
// Sin esta caja propia, un ítem SIN media en el storefront publicado (el caso de los defaults, que
// nacen sin foto/video a propósito) colapsaría a ALTO CERO: la celda desaparecería de la grilla del
// mosaico y la `<Leyenda>` (position:absolute) quedaría flotando sin una caja `relative` de la que
// colgar — el defecto medido con el arnés de este slice antes de este fix (§ DECISIONS.md).
function Media({
  item,
  campo,
  alt,
  className,
}: {
  item: InstanciaCollageItem;
  campo: string;
  alt: string;
  className: string;
}) {
  return (
    <div className={`relative bg-[var(--sf-linea)] ${className}`}>
      {!item.url ? (
        <HuecoImagenOpcional campo={campo} className="absolute inset-0" />
      ) : item.tipo === "video" ? (
        <CampoEditable campo={campo} tipo="imagen">
          <VideoCelda src={item.url} poster={item.poster || undefined} alt={alt} />
        </CampoEditable>
      ) : (
        <CampoEditable campo={campo} tipo="imagen">
          <Image src={item.url} alt={alt} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
        </CampoEditable>
      )}
    </div>
  );
}

function Leyenda({ texto }: { texto: string }) {
  if (!texto) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/60 to-transparent px-3 pt-8 pb-2">
      <p className="text-xs leading-snug text-white">{texto}</p>
    </div>
  );
}

export default function SeccionCollage({
  id,
  instancia,
  style,
}: {
  id: string;
  instancia: InstanciaCollageContent;
  style?: React.CSSProperties;
}) {
  const { paginas, navTratamiento } = useSiteContent();
  const preview = useIsPreview();
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);

  // `items[0]` SIEMPRE es la pieza grande (§ el docstring de cabecera). Con el mínimo del editor (3)
  // nunca llega vacío a un home publicado, pero el dispatcher SIEMPRE pasa por `instanciaEsVisible`
  // (hide-on-empty) antes de montar este componente — una red más, nunca mostrar un mosaico vacío.
  const [grande, ...chicas] = instancia.items;
  if (!grande) return null;
  const colsChicas = COLS_CHICAS[instancia.disposicion] ?? COLS_CHICAS.dos;
  const grandePrimero = instancia.lado !== "derecha";
  const ordenGrande = grandePrimero ? "md:order-1" : "md:order-2";
  const ordenChicas = grandePrimero ? "md:order-2" : "md:order-1";

  const hrefGrande = resolverCtaSeccion(grande.leyenda, grande.enlace, paginas);
  const contenidoGrande = (
    <>
      <Media
        item={grande}
        campo={`${id}.items.0.url`}
        alt={grande.leyenda || instancia.titulo || "Foto del mosaico"}
        className="aspect-[4/5] overflow-hidden sf-radio-imagen sf-sombra-imagen md:h-full"
      />
      <Leyenda texto={grande.leyenda} />
    </>
  );

  return (
    <section className="py-20 bg-[var(--sf-banda,var(--sf-fondo))]" style={style}>
      <div className={`${contenedorClase} mx-auto`}>
        {instancia.titulo && (
          <RevelarBloque
            as="h2"
            indice={0}
            preview={preview}
            className="mb-10 text-center font-playfair text-3xl leading-tight text-[var(--sf-sobre-banda,var(--sf-tinta))] sm:text-4xl"
          >
            <CampoEditable campo={`${id}.titulo`}>{instancia.titulo}</CampoEditable>
          </RevelarBloque>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <RevelarBloque indice={instancia.titulo ? 1 : 0} preview={preview} className={ordenGrande}>
            {hrefGrande ? (
              <Link href={hrefGrande} className="group relative block h-full">{contenidoGrande}</Link>
            ) : (
              <div className="group relative h-full">{contenidoGrande}</div>
            )}
          </RevelarBloque>

          <div className={`grid ${colsChicas} gap-4 ${ordenChicas}`}>
            {chicas.map((item, i) => {
              const n = i + 1; // índice REAL en `instancia.items` (la grande ocupa el 0)
              const href = resolverCtaSeccion(item.leyenda, item.enlace, paginas);
              const contenido = (
                <>
                  <Media
                    item={item}
                    campo={`${id}.items.${n}.url`}
                    alt={item.leyenda || instancia.titulo || "Foto del mosaico"}
                    className="aspect-square overflow-hidden sf-radio-imagen sf-sombra-imagen"
                  />
                  <Leyenda texto={item.leyenda} />
                </>
              );
              return (
                <RevelarBloque key={n} indice={(instancia.titulo ? 1 : 0) + 1 + i} preview={preview}>
                  {href ? (
                    <Link href={href} className="group relative block">{contenido}</Link>
                  ) : (
                    <div className="group relative">{contenido}</div>
                  )}
                </RevelarBloque>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
