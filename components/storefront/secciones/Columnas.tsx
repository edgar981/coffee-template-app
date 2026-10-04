"use client";

import Image from "next/image";
import Link from "next/link";
import RevelarBloque from "@/components/storefront/RevelarBloque";
import CampoEditable, { HuecoImagenOpcional } from "@/components/storefront/CampoEditable";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { resolverCtaSeccion } from "@/lib/config/site-content-defaults";
import { contenedorAnchoClase } from "@/lib/config/themes";
import type { InstanciaColumnasContent } from "@/lib/config/secciones-instancias";

// LA SECCIÓN "COLUMNAS" del catálogo curado de instancias (§ SECCIONES-TIPOS-2) — título opcional
// + de DOS a SEIS columnas (imagen opcional, título, texto, enlace opcional), cada una SOBRE el
// fondo de la banda (`--sf-sobre-banda*`), MISMA familia de tokens que la variante "índice" de
// Presentaciones (`GrindChooserIndice.tsx`) — sin superficie de tarjeta propia, porque el spec no
// pide una ("imagen opcional, título, texto, enlace"), no la tarjeta con sombra de Testimonios.
//
// EN MÓVIL SE APILAN (`grid-cols-1`), NO UN CARRUSEL: la decisión y su porqué, medidos.
// `/nosotros` (galería) y el resto de los grids del storefront (Presentaciones mosaico, BrandStory)
// ya resuelven "muchas piezas en poco ancho" apilando — ningún componente del storefront de hoy
// implementa scroll-snap horizontal, así que un carrusel sería un mecanismo NUEVO (gestos táctiles,
// indicador de página, accesibilidad de scroll) para un problema que apilar ya resuelve sin
// construir nada. Columnas de 2 a 6 apiladas en una sola columna angosta es exactamente lo que
// Presentaciones (2-4) y la galería (hasta 12) ya hacen.
//
// EL NÚMERO DE COLUMNAS SALE DE `items.length`, NUNCA DE UN ESCALAR PROPIO: "de dos a seis" ya lo
// garantiza el EDITOR (`InstanciaItemsEditor`, `min:2`/`max:6` del descriptor); el grid sólo lee
// cuántas hay. Lookup LITERAL (§ CLAUDE.md, "El GRID va por lookup LITERAL" — Presentaciones), no
// interpolado, para que el JIT de Tailwind vea las clases.
const GRID_COLS_COLUMNAS: Record<number, string> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
  5: "md:grid-cols-5",
  6: "md:grid-cols-6",
};

export default function SeccionColumnas({
  id,
  instancia,
  style,
}: {
  id: string;
  instancia: InstanciaColumnasContent;
  style?: React.CSSProperties;
}) {
  const { paginas, navTratamiento } = useSiteContent();
  const preview = useIsPreview();
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);
  const gridClase = GRID_COLS_COLUMNAS[instancia.items.length] ?? GRID_COLS_COLUMNAS[2];

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
        <div className={`grid grid-cols-1 gap-8 ${gridClase}`}>
          {instancia.items.map((col, i) => {
            // `enlace` ES EL CTA de la columna entera: no hay un `enlaceLabel` separado, así que
            // reusa `resolverCtaSeccion` con el TÍTULO como label — igual criterio que cualquier CTA
            // de sección: sin destino válido o con la página de destino apagada, `null` (sin link
            // roto, § CLAUDE.md "preferir callar"). `titulo` es REQUERIDO en el descriptor, así que
            // esto nunca cae en el caso "label vacío" salvo que el dueño lo vacíe a propósito.
            const href = resolverCtaSeccion(col.titulo, col.enlace, paginas);
            const contenido = (
              <>
                <div className="relative mb-4 aspect-[4/3] overflow-hidden sf-radio-imagen sf-sombra-imagen">
                  {col.imagen ? (
                    <CampoEditable campo={`${id}.items.${i}.imagen`} tipo="imagen">
                      <Image
                        src={col.imagen}
                        alt={col.titulo}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </CampoEditable>
                  ) : (
                    <HuecoImagenOpcional campo={`${id}.items.${i}.imagen`} className="absolute inset-0 bg-[var(--sf-linea)]" />
                  )}
                </div>
                <h3 className="mb-1 font-playfair text-lg text-[var(--sf-sobre-banda,var(--sf-tinta))] group-hover:underline">
                  <CampoEditable campo={`${id}.items.${i}.titulo`}>{col.titulo}</CampoEditable>
                </h3>
                {col.texto && (
                  <p className="text-sm text-[var(--sf-sobre-banda-suave,var(--sf-texto))]">
                    <CampoEditable campo={`${id}.items.${i}.texto`} multilinea>{col.texto}</CampoEditable>
                  </p>
                )}
              </>
            );
            return (
              <RevelarBloque key={i} indice={instancia.titulo ? i + 1 : i} preview={preview}>
                {href ? (
                  <Link href={href} className="group block">
                    {contenido}
                  </Link>
                ) : (
                  <div className="group">{contenido}</div>
                )}
              </RevelarBloque>
            );
          })}
        </div>
      </div>
    </section>
  );
}
