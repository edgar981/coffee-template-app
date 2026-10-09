"use client";

import Image from "next/image";
import Link from "next/link";
import RevelarBloque from "@/components/storefront/RevelarBloque";
import CampoEditable, { HuecoImagenOpcional } from "@/components/storefront/CampoEditable";
import Movimiento from "@/components/storefront/movimiento/Movimiento";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { resolverCtaSeccion, claseAlturaHero } from "@/lib/config/site-content-defaults";
import { contenedorAnchoClase } from "@/lib/config/themes";
import type { InstanciaBannerContent } from "@/lib/config/secciones-instancias";

// LA SECCIÓN "BANNER" del catálogo curado de instancias (§ SECCIONES-INSTANCIAS-1) — foto de fondo
// a sangre + velo, título + texto centrados, uno o dos CTA, con "alto" (Justo/Alto/Pantalla)
// REUSANDO `claseAlturaHero` del hero (mismos tres pasos, misma canónica 'justo') en vez de
// reinventar la escala. Es OSCURO y UNIFORME por CANÓNICA (§ `instanciaOscuraCanonica`/
// `instanciaEsUniforme`, secciones-instancias.ts) — misma forma que el hero 'curtina': fondo de
// foto con velo, un solo tono para el nav flotante.
//
// SIN IMAGEN DE FONDO (el estado inicial, sin default — § `DEFAULTS_INSTANCIA.banner`), el fondo
// cae al color de sección de siempre (`--sf-banda`/`--sf-tinta`, el mismo literal que ya usa
// `subscriptionCTA` sin `imagenFondo`) y se muestra el hueco "+ Agregar foto" en vez de un `<img
// src="">` roto.

export default function SeccionBanner({
  id,
  instancia,
  style,
}: {
  id: string;
  instancia: InstanciaBannerContent;
  style?: React.CSSProperties;
}) {
  const { paginas, navTratamiento } = useSiteContent();
  const preview = useIsPreview();
  const ctaHref = resolverCtaSeccion(instancia.ctaLabel, instancia.ctaDestino, paginas);
  const ctaSecundarioHref = resolverCtaSeccion(instancia.ctaSecundarioLabel, instancia.ctaSecundarioDestino, paginas);
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);
  const alturaClase = claseAlturaHero(instancia.alto, false);

  return (
    <section
      className={`relative flex items-center justify-center overflow-hidden bg-[var(--sf-banda,var(--sf-tinta))] ${alturaClase}`}
      style={style}
    >
      {instancia.imagen ? (
        <>
          {/* § MOVIMIENTO-EDITOR-EXPOSICION-1 — «imagen → la foto». Con «Ninguna» (el default) este
              `<Movimiento>` devuelve los children sin wrapper — la foto queda exactamente como
              antes de este slice, byte-idéntico.
              § MOVIMIENTO-NIVEL-EDITORIAL-1 — con T06, `.sf-movimiento-gigante` es el título
              gigante que `t06()` desliza sobre la foto (marcador, no hoja de estilos — § el
              docstring de `animaciones.ts`). Con cualquier otro id, o «Ninguna», no se renderiza. */}
          <Movimiento id={instancia.animacion} as="div" className="absolute inset-0">
            <Image src={instancia.imagen} alt={instancia.titulo} fill priority={false} sizes="100vw" className="object-cover" />
            {instancia.animacion === 'T06' && instancia.titulo && (
              <div
                aria-hidden="true"
                className="sf-movimiento-gigante pointer-events-none absolute inset-x-0 bottom-[8%] select-none overflow-hidden whitespace-nowrap font-playfair text-[clamp(60px,14vw,220px)] leading-[0.8] text-[var(--sf-fondo)]/90"
              >
                {instancia.titulo.toUpperCase()}
              </div>
            )}
          </Movimiento>
          <div className="absolute inset-0 bg-linear-to-b from-[var(--sf-tinta)]/60 via-transparent to-[var(--sf-tinta)]/80 pointer-events-none" />
        </>
      ) : (
        <HuecoImagenOpcional campo={`${id}.imagen`} className="absolute inset-0" />
      )}

      <div className={`relative ${contenedorClase} mx-auto`}>
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <RevelarBloque as="h2" indice={0} preview={preview} className="font-playfair text-3xl leading-tight text-white sm:text-4xl">
            <CampoEditable campo={`${id}.titulo`}>{instancia.titulo}</CampoEditable>
          </RevelarBloque>
          {instancia.texto && (
            <RevelarBloque as="p" indice={1} preview={preview} className="text-base leading-relaxed text-white/85">
              <CampoEditable campo={`${id}.texto`} multilinea>{instancia.texto}</CampoEditable>
            </RevelarBloque>
          )}
          {(ctaHref || ctaSecundarioHref) && (
            <RevelarBloque indice={2} preview={preview} className="mt-2 flex flex-wrap items-center justify-center gap-4">
              {ctaHref && (
                <Link
                  href={ctaHref}
                  className="inline-flex items-center gap-2 sf-pildora bg-[var(--sf-accion,var(--sf-tostado))] px-8 py-4 text-sm font-semibold text-[var(--sf-accion-txt,var(--sf-tinta))] transition-all hover:-translate-y-0.5 hover:bg-[var(--sf-accion-hover,var(--sf-tostado-4))]"
                >
                  <CampoEditable campo={`${id}.ctaLabel`}>{instancia.ctaLabel}</CampoEditable>
                </Link>
              )}
              {ctaSecundarioHref && (
                <Link
                  href={ctaSecundarioHref}
                  className="inline-flex items-center gap-2 sf-pildora border border-white/70 px-8 py-4 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-white/10"
                >
                  <CampoEditable campo={`${id}.ctaSecundarioLabel`}>{instancia.ctaSecundarioLabel}</CampoEditable>
                </Link>
              )}
            </RevelarBloque>
          )}
        </div>
      </div>
    </section>
  );
}
