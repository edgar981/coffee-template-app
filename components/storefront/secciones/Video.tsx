"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Play } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import RevelarBloque from "@/components/storefront/RevelarBloque";
import CampoEditable, { HuecoImagenOpcional } from "@/components/storefront/CampoEditable";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { resolverCtaSeccion, claseAlturaHero } from "@/lib/config/site-content-defaults";
import { contenedorAnchoClase } from "@/lib/config/themes";
import type { InstanciaVideoContent } from "@/lib/config/secciones-instancias";

// LA SECCIÓN "VIDEO" del catálogo curado de instancias (§ SECCIONES-TIPOS-3) — un video subido
// (mismo tope y mismo pipeline de subida que el hero, § MAX_VIDEO_HERO_BYTES en el editor), póster
// OBLIGATORIO (exigido por `site-content-schema.ts`, nunca a nivel de este componente — acá sólo se
// LEE lo ya validado), y dos MODOS (`instancia.modo`, escalar clampado):
//   - 'fondo' (canónica): el video llena la sección a sangre, en bucle y SILENCIADO, con un velo
//     + título/texto/botón ENCIMA — la MISMA forma que `Banner.tsx`, con video en vez de foto.
//   - 'reproducir': el video vive CONTENIDO (aspecto 16:9) sobre el fondo de la sección, con el
//     póster a la vista y un botón de Reproducir ENCIMA; al tocarlo arranca con controles y CON
//     sonido (es un gesto del visitante, no autoplay) — embeber YouTube/Vimeo queda FUERA (§ el
//     spec): el video es siempre el archivo subido, servido por Blob como cualquier otro.
//
// SIN VIDEO (`imagen` vacía, el estado inicial — ninguna instancia nace con uno, § los defaults
// neutros): el hueco "+ Agregar video" en el lugar del medio, mismo patrón que `Banner.tsx` sin
// imagen de fondo.

export default function SeccionVideo({
  id,
  instancia,
  style,
}: {
  id: string;
  instancia: InstanciaVideoContent;
  style?: React.CSSProperties;
}) {
  const { paginas, navTratamiento } = useSiteContent();
  const preview = useIsPreview();
  const reduce = useReducedMotion();
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);
  const ctaHref = resolverCtaSeccion(instancia.ctaLabel, instancia.ctaDestino, paginas);
  const esFondo = instancia.modo !== "reproducir";

  const videoRefFondo = useRef<HTMLVideoElement>(null);
  const reproducirFondo = esFondo && !!instancia.imagen && !preview && !reduce;
  useEffect(() => {
    const v = videoRefFondo.current;
    if (!v) return;
    v.muted = true;
    if (reproducirFondo) v.play().catch(() => {});
    else v.pause();
  }, [reproducirFondo]);

  // MODO 'reproducir': arranca quieto en el póster; el botón lo dispara. Una vez tocado, el
  // elemento nativo trae sus propios controles (play/pause/volumen) — este componente no reimplementa
  // esa UI, sólo el gesto de ARRANCAR.
  const videoRefReproducir = useRef<HTMLVideoElement>(null);
  const [reproduciendo, setReproduciendo] = useState(false);
  const reproducir = () => {
    const v = videoRefReproducir.current;
    if (!v) return;
    v.play().catch(() => {});
  };

  if (esFondo) {
    const alturaClase = claseAlturaHero("justo", false);
    return (
      <section
        className={`relative flex items-center justify-center overflow-hidden bg-[var(--sf-banda,var(--sf-tinta))] ${alturaClase}`}
        style={style}
      >
        {instancia.imagen ? (
          <CampoEditable campo={`${id}.imagen`} tipo="imagen">
            <video
              ref={videoRefFondo}
              src={instancia.imagen}
              poster={instancia.poster || undefined}
              muted
              loop
              playsInline
              preload={reproducirFondo ? "auto" : "none"}
              controls={!!reduce && !preview}
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </CampoEditable>
        ) : (
          <HuecoImagenOpcional campo={`${id}.imagen`} className="absolute inset-0" />
        )}
        <div className="absolute inset-0 bg-linear-to-b from-[var(--sf-tinta)]/60 via-transparent to-[var(--sf-tinta)]/80 pointer-events-none" />

        <div className={`relative ${contenedorClase} mx-auto`}>
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
            {instancia.titulo && (
              <RevelarBloque as="h2" indice={0} preview={preview} className="font-playfair text-3xl leading-tight text-white sm:text-4xl">
                <CampoEditable campo={`${id}.titulo`}>{instancia.titulo}</CampoEditable>
              </RevelarBloque>
            )}
            {instancia.texto && (
              <RevelarBloque as="p" indice={1} preview={preview} className="text-base leading-relaxed text-white/85">
                <CampoEditable campo={`${id}.texto`} multilinea>{instancia.texto}</CampoEditable>
              </RevelarBloque>
            )}
            {ctaHref && (
              <RevelarBloque indice={2} preview={preview} className="mt-2">
                {/* OUTLINE, no el relleno `--sf-accion` de Banner: reusa el patrón del CTA
                    SECUNDARIO que Banner.tsx YA usa (`border-white/70` + `hover:bg-white/10`),
                    no el token de hover del PRIMARIO — un botón traslúcido lee mejor sobre un
                    video en movimiento que un relleno sólido, y de paso el CTA de "video" no se
                    suma al censo exhaustivo de `lib/config/cta-primario.test.ts` (fuera de
                    `touches:` de este slice) con un consumidor nuevo que ese archivo tendría que
                    nombrar — ese censo hace grep del token literal, así que ni este comentario
                    puede deletrearlo entero. */}
                <Link
                  href={ctaHref}
                  className="inline-flex items-center gap-2 sf-pildora border border-white/70 px-8 py-4 text-sm font-medium text-white transition-all hover:-translate-y-0.5 hover:bg-white/10"
                >
                  <CampoEditable campo={`${id}.ctaLabel`}>{instancia.ctaLabel}</CampoEditable>
                </Link>
              </RevelarBloque>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 bg-[var(--sf-banda,var(--sf-fondo))]" style={style}>
      <div className={`${contenedorClase} mx-auto`}>
        <div className="mx-auto mb-10 flex max-w-2xl flex-col items-center gap-4 text-center">
          {instancia.titulo && (
            <RevelarBloque as="h2" indice={0} preview={preview} className="font-playfair text-3xl leading-tight text-[var(--sf-sobre-banda,var(--sf-tinta))] sm:text-4xl">
              <CampoEditable campo={`${id}.titulo`}>{instancia.titulo}</CampoEditable>
            </RevelarBloque>
          )}
          {instancia.texto && (
            <RevelarBloque as="p" indice={1} preview={preview} className="text-base leading-relaxed text-[var(--sf-sobre-banda-suave,var(--sf-texto))]">
              <CampoEditable campo={`${id}.texto`} multilinea>{instancia.texto}</CampoEditable>
            </RevelarBloque>
          )}
        </div>

        {/* LA CAJA (`aspect-video`) vive en `RevelarBloque`, SIEMPRE montada — no en el contenido
            condicional. `HuecoImagenOpcional` devuelve `null` fuera de modo editor (§ CampoEditable.
            tsx), así que si el aspect-ratio dependiera de ESA rama, un "video" recién agregado (sin
            video todavía) colapsaría a alto CERO en el storefront publicado — mismo defecto medido
            en Collage.tsx con este slice (§ DECISIONS.md), cerrado acá con el mismo patrón que
            `ImagenTexto.tsx` ya usa: el aspect-ratio en el wrapper, el contenido adentro. */}
        <RevelarBloque indice={2} preview={preview} className="relative aspect-video overflow-hidden sf-radio-imagen sf-sombra-imagen">
          {instancia.imagen ? (
            <CampoEditable campo={`${id}.imagen`} tipo="imagen">
              <video
                ref={videoRefReproducir}
                src={instancia.imagen}
                poster={instancia.poster || undefined}
                playsInline
                controls={reproduciendo}
                onPlay={() => setReproduciendo(true)}
                onPause={() => setReproduciendo(false)}
                className="h-full w-full object-cover"
              />
              {!reproduciendo && (
                <button
                  type="button"
                  onClick={reproducir}
                  aria-label="Reproducir video"
                  className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors hover:bg-black/30"
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-lg">
                    <Play className="h-7 w-7 translate-x-px fill-[var(--sf-tinta)] text-[var(--sf-tinta)]" />
                  </span>
                </button>
              )}
            </CampoEditable>
          ) : (
            <HuecoImagenOpcional campo={`${id}.imagen`} className="absolute inset-0 bg-[var(--sf-linea)]" />
          )}
        </RevelarBloque>
      </div>
    </section>
  );
}
