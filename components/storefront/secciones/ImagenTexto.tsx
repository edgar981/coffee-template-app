"use client";

import Image from "next/image";
import Link from "next/link";
import RevelarBloque from "@/components/storefront/RevelarBloque";
import CampoEditable, { HuecoImagenOpcional } from "@/components/storefront/CampoEditable";
import Movimiento from "@/components/storefront/movimiento/Movimiento";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { resolverCtaSeccion } from "@/lib/config/site-content-defaults";
import { contenedorAnchoClase } from "@/lib/config/themes";
import type { InstanciaImagenTextoContent } from "@/lib/config/secciones-instancias";

// LA SECCIÓN "IMAGEN CON TEXTO" del catálogo curado de instancias (§ SECCIONES-INSTANCIAS-1) — una
// foto a un lado, el texto al otro, con `lado` ('izquierda'|'derecha') decidiendo de qué lado va la
// imagen. ES BI-TONAL POR LAYOUT, como la variante 'ficha' del hero (§ `instanciaEsUniforme` en
// `secciones-instancias.ts`): el nav flotante no debe posarse encima asumiendo un solo tono.
//
// LA IMAGEN ES OPCIONAL Y SIN DEFAULT (§ CLAUDE.md "El código compartido no NACE siendo Nayoli/
// demo"): vacía muestra el hueco "+ Agregar foto" del editor (`HuecoImagenOpcional`), nunca un
// `<img src="">` roto ni una foto prestada de otra sección.

export default function SeccionImagenTexto({
  id,
  instancia,
  style,
}: {
  id: string;
  instancia: InstanciaImagenTextoContent;
  style?: React.CSSProperties;
}) {
  const { paginas, navTratamiento } = useSiteContent();
  const preview = useIsPreview();
  const ctaHref = resolverCtaSeccion(instancia.ctaLabel, instancia.ctaDestino, paginas);
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);
  const imagenPrimero = instancia.lado === "izquierda";

  return (
    <section className="py-20 bg-[var(--sf-banda,var(--sf-fondo))]" style={style}>
      <div className={`${contenedorClase} mx-auto`}>
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {instancia.animacion ? (
            // § MOVIMIENTO-EDITOR-EXPOSICION-1 — «imagen → la foto». `Movimiento` reemplaza a
            // `RevelarBloque` sólo con una animación elegida; con «Ninguna» este branch nunca se
            // toma (byte-idéntico a antes de este slice).
            <Movimiento
              id={instancia.animacion}
              as="div"
              className={`relative aspect-[4/3] overflow-hidden sf-radio-imagen sf-sombra-imagen ${imagenPrimero ? "lg:order-1" : "lg:order-2"}`}
            >
              {instancia.imagen ? (
                <CampoEditable campo={`${id}.imagen`} tipo="imagen">
                  <Image src={instancia.imagen} alt={instancia.titulo} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
                </CampoEditable>
              ) : (
                <HuecoImagenOpcional campo={`${id}.imagen`} className="absolute inset-0 bg-[var(--sf-linea)]" />
              )}
              {/* § MOVIMIENTO-NIVEL-EDITORIAL-1 — T06, mismo marcador que Banner.tsx. */}
              {instancia.animacion === 'T06' && instancia.imagen && instancia.titulo && (
                <div
                  aria-hidden="true"
                  className="sf-movimiento-gigante pointer-events-none absolute inset-x-0 bottom-[6%] select-none overflow-hidden whitespace-nowrap font-playfair text-[clamp(32px,7vw,96px)] leading-[0.8] text-[var(--sf-fondo)]/90"
                >
                  {instancia.titulo.toUpperCase()}
                </div>
              )}
            </Movimiento>
          ) : (
            <RevelarBloque
              indice={0}
              preview={preview}
              className={`relative aspect-[4/3] overflow-hidden sf-radio-imagen sf-sombra-imagen ${imagenPrimero ? "lg:order-1" : "lg:order-2"}`}
            >
              {instancia.imagen ? (
                <CampoEditable campo={`${id}.imagen`} tipo="imagen">
                  <Image src={instancia.imagen} alt={instancia.titulo} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
                </CampoEditable>
              ) : (
                <HuecoImagenOpcional campo={`${id}.imagen`} className="absolute inset-0 bg-[var(--sf-linea)]" />
              )}
            </RevelarBloque>
          )}

          <div className={`flex flex-col gap-4 ${imagenPrimero ? "lg:order-2" : "lg:order-1"}`}>
            {instancia.antetitulo && (
              <RevelarBloque as="p" indice={1} preview={preview} className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--sf-sobre-banda,var(--sf-acento-texto))]">
                <CampoEditable campo={`${id}.antetitulo`}>{instancia.antetitulo}</CampoEditable>
              </RevelarBloque>
            )}
            <RevelarBloque as="h2" indice={2} preview={preview} className="font-playfair text-3xl leading-tight text-[var(--sf-sobre-banda,var(--sf-tinta))] sm:text-4xl">
              <CampoEditable campo={`${id}.titulo`}>{instancia.titulo}</CampoEditable>
            </RevelarBloque>
            {instancia.texto && (
              <RevelarBloque as="p" indice={3} preview={preview} className="text-base leading-relaxed text-[var(--sf-sobre-banda-suave,var(--sf-texto))]">
                <CampoEditable campo={`${id}.texto`} multilinea>{instancia.texto}</CampoEditable>
              </RevelarBloque>
            )}
            {ctaHref && (
              <RevelarBloque indice={4} preview={preview} className="mt-2">
                <Link
                  href={ctaHref}
                  className="inline-flex items-center gap-2 sf-pildora bg-[var(--sf-accion,var(--sf-tostado))] px-8 py-4 text-sm font-semibold text-[var(--sf-accion-txt,var(--sf-tinta))] transition-all hover:-translate-y-0.5 hover:bg-[var(--sf-accion-hover,var(--sf-tostado-4))] w-fit"
                >
                  <CampoEditable campo={`${id}.ctaLabel`}>{instancia.ctaLabel}</CampoEditable>
                </Link>
              </RevelarBloque>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
