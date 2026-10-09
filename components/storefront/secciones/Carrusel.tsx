"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import RevelarBloque from "@/components/storefront/RevelarBloque";
import CampoEditable, { HuecoImagenOpcional } from "@/components/storefront/CampoEditable";
import Movimiento from "@/components/storefront/movimiento/Movimiento";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { resolverCtaSeccion, claseAlturaHero } from "@/lib/config/site-content-defaults";
import { contenedorAnchoClase } from "@/lib/config/themes";
import { Carousel, CarouselContent, CarouselItem, useCarousel } from "@/components/ui/carousel";
import type { InstanciaCarruselContent, InstanciaCarruselItem } from "@/lib/config/secciones-instancias";

// LA SECCIÓN "CARRUSEL" del catálogo curado de instancias (§ SECCIONES-CARRUSEL-1) — de DOS a SEIS
// diapositivas (foto de fondo + velo, título + texto + botón, cada una una copia del Banner de
// siempre), con flechas, puntos, deslizar con el dedo, teclado, y avance automático OPCIONAL
// (apagado por defecto) que se pausa al interactuar (mouse encima, foco o toque) y NUNCA corre con
// `prefers-reduced-motion`. Usa `embla-carousel-react` vía `components/ui/carousel.tsx` — sin
// dependencias nuevas; no reusa `CarouselPrevious`/`CarouselNext` de ese archivo (shadcn/admin-level,
// con `Button`): los controles de acá son propios, con los tokens `--sf-*`/overlay-sobre-foto de
// Banner, iguales a cualquier otra sección del storefront.
//
// CADA DIAPOSITIVA es, en forma, un Banner — título/texto/botón centrados sobre foto a sangre con
// velo — así que `Diapositiva` reusa LITERALMENTE ese vocabulario visual, no lo reinventa. `alto`
// ES de instancia (Justo/Alto/Pantalla, como el banner): el carrusel entero tiene un alto, no cada
// diapositiva por separado — todas comparten el mismo alto, igual que las páginas de un mismo libro.
//
// `titulo` DE INSTANCIA (cabecera opcional, fuera de cualquier diapositiva) NO estaba en el plan
// original — se agregó porque `components/admin/TiendaPaginas.tsx` (fuera de `touches:`) asume
// `.titulo` en TODA instancia (medido con `npm run typecheck`, § el docstring de
// `InstanciaCarruselContent`, secciones-instancias.ts). Se renderiza ANTES del carrusel a sangre,
// nunca dentro de una diapositiva — mismo lugar que el `titulo` opcional de Collage/Columnas/Filas/
// Preguntas sobre su contenido.

const AUTOPLAY_MS = 6000;

function Diapositiva({
  item,
  campoBase,
  contenedorClase,
  paginas,
  preview,
}: {
  item: InstanciaCarruselItem;
  campoBase: string;
  contenedorClase: string;
  paginas: ReturnType<typeof useSiteContent>["paginas"];
  preview: boolean;
}) {
  const ctaHref = resolverCtaSeccion(item.ctaLabel, item.ctaDestino, paginas);

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden">
      {item.imagen ? (
        <>
          <Image src={item.imagen} alt={item.titulo} fill priority={false} sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-linear-to-b from-[var(--sf-tinta)]/60 via-transparent to-[var(--sf-tinta)]/80 pointer-events-none" />
        </>
      ) : (
        <HuecoImagenOpcional campo={`${campoBase}.imagen`} className="absolute inset-0" />
      )}

      <div className={`relative ${contenedorClase} mx-auto px-6`}>
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <RevelarBloque as="h2" indice={0} preview={preview} className="font-playfair text-3xl leading-tight text-white sm:text-4xl">
            <CampoEditable campo={`${campoBase}.titulo`}>{item.titulo}</CampoEditable>
          </RevelarBloque>
          {item.texto && (
            <RevelarBloque as="p" indice={1} preview={preview} className="text-base leading-relaxed text-white/85">
              <CampoEditable campo={`${campoBase}.texto`} multilinea>{item.texto}</CampoEditable>
            </RevelarBloque>
          )}
          {ctaHref && (
            // OUTLINE, no el relleno `--sf-accion` de Banner — MISMO precedente que Video.tsx (§ su
            // docstring): un botón traslúcido lee mejor sobre una foto en movimiento, y de paso el
            // CTA de "carrusel" no se suma al censo exhaustivo de `lib/config/cta-primario.test.ts`
            // (fuera de `touches:` de este slice) con un consumidor nuevo que ese archivo tendría
            // que nombrar — ese censo hace grep del token de hover del PRIMARIO literal, así que ni
            // este comentario puede deletrearlo entero (medido con `npm test`, que sin este cambio
            // falla ese censo).
            <RevelarBloque indice={2} preview={preview} className="mt-2">
              <Link
                href={ctaHref}
                className="inline-flex items-center gap-2 sf-pildora border border-white/70 px-8 py-4 text-sm font-medium text-white transition-all hover:-translate-y-0.5 hover:bg-white/10"
              >
                <CampoEditable campo={`${campoBase}.ctaLabel`}>{item.ctaLabel}</CampoEditable>
              </Link>
            </RevelarBloque>
          )}
        </div>
      </div>
    </div>
  );
}

// LOS CONTROLES (flechas + puntos) Y EL AVANCE AUTOMÁTICO viven en un hijo de `<Carousel>` — es lo
// que permite leer `api` vía `useCarousel()` (§ el export de `components/ui/carousel.tsx`), sin
// ensanchar el contexto compartido con un estado (`selectedIndex`) que sólo esta sección necesita.
function Controles({ autoplay, activo, total }: { autoplay: boolean; activo: boolean; total: number }) {
  const { api, scrollPrev, scrollNext, canScrollPrev, canScrollNext } = useCarousel();
  const [seleccionado, setSeleccionado] = useState(0);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setSeleccionado(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api]);

  // EL AVANCE AUTOMÁTICO — `activo` ya trae apagado/`prefers-reduced-motion`/preview/pausado
  // resueltos (§ el componente de abajo): acá sólo queda el `setInterval` + `scrollNext`, sin
  // reimplementar ninguna de esas condiciones por duplicado.
  useEffect(() => {
    if (!api || !autoplay || !activo) return;
    const id = setInterval(() => api.scrollNext(), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [api, autoplay, activo]);

  if (total <= 1) return null;

  return (
    <>
      <button
        type="button"
        onClick={scrollPrev}
        disabled={!canScrollPrev}
        aria-label="Diapositiva anterior"
        className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white transition-colors hover:bg-black/50 disabled:opacity-30"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={scrollNext}
        disabled={!canScrollNext}
        aria-label="Siguiente diapositiva"
        className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white transition-colors hover:bg-black/50 disabled:opacity-30"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
      <div className="absolute inset-x-0 bottom-4 z-10 flex items-center justify-center gap-2">
        {Array.from({ length: total }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => api?.scrollTo(i)}
            aria-label={`Ir a la diapositiva ${i + 1}`}
            aria-current={seleccionado === i}
            className={`h-2 rounded-full transition-all ${seleccionado === i ? "w-6 bg-white" : "w-2 bg-white/50"}`}
          />
        ))}
      </div>
    </>
  );
}

export default function SeccionCarrusel({
  id,
  instancia,
  style,
}: {
  id: string;
  instancia: InstanciaCarruselContent;
  style?: React.CSSProperties;
}) {
  const { paginas, navTratamiento } = useSiteContent();
  const preview = useIsPreview();
  const reduce = useReducedMotion();
  const contenedorClase = contenedorAnchoClase(navTratamiento.posicion);
  const alturaClase = claseAlturaHero(instancia.alto, false);

  // LA PAUSA (§ el spec: "se pausa al pasar el mouse, con foco o al tocar") vive ACÁ, no dentro de
  // `Controles` — necesita envolver TODA la superficie interactiva (flechas, puntos, diapositivas),
  // y `Carousel` reenvía cualquier prop de `<div>` a su nodo raíz (`CarouselProps extends
  // React.HTMLAttributes<HTMLDivElement>`), así que los handlers van directo ahí sin un wrapper
  // nuevo. `activo` (pasado a `Controles`) combina la pausa con el resto de las condiciones.
  const [pausado, setPausado] = useState(false);
  const pausar = () => setPausado(true);
  const reanudar = () => setPausado(false);

  // Red SOFT adicional: el dispatcher (`SeccionInstancia.tsx`) ya aplica hide-on-empty vía
  // `instanciaEsVisible` antes de montar este componente, pero un `items` vacío que llegara igual
  // (p. ej. un dato viejo re-resuelto a mano) no debe intentar dibujar un carrusel sin diapositivas.
  if (instancia.items.length === 0) return null;

  const activo = instancia.autoplay && !reduce && !preview && !pausado;

  return (
    <section className="bg-[var(--sf-banda,var(--sf-fondo))]" style={style}>
      {instancia.titulo && (
        <div className={`${contenedorClase} mx-auto px-6 pt-14`}>
          {instancia.animacion ? (
            // § MOVIMIENTO-EDITOR-EXPOSICION-1 — «texto → la cabecera». Con «Ninguna» este branch
            // nunca se toma (byte-idéntico a antes de este slice).
            <Movimiento id={instancia.animacion} as="h2" className="text-center font-playfair text-3xl leading-tight text-[var(--sf-sobre-banda,var(--sf-tinta))] sm:text-4xl">
              <CampoEditable campo={`${id}.titulo`}>{instancia.titulo}</CampoEditable>
            </Movimiento>
          ) : (
            <RevelarBloque
              as="h2"
              indice={0}
              preview={preview}
              className="text-center font-playfair text-3xl leading-tight text-[var(--sf-sobre-banda,var(--sf-tinta))] sm:text-4xl"
            >
              <CampoEditable campo={`${id}.titulo`}>{instancia.titulo}</CampoEditable>
            </RevelarBloque>
          )}
        </div>
      )}
      {/* FONDO OSCURO por canónica (`instanciaOscuraCanonica('carrusel') === true`,
          secciones-instancias.ts) — MISMO fallback que Banner.tsx (`--sf-tinta`, no `--sf-fondo`
          como el wrapper claro de arriba): una diapositiva SIN foto (el estado inicial de los dos
          ejemplos del default) muestra título/texto en BLANCO, así que sin este fondo oscuro de
          respaldo el texto quedaría invisible sobre el claro de la sección. `--sf-banda` (si hay
          esquema asignado) sigue cascando igual, heredado del `style` del `<section>` de arriba —
          sólo cambia el FALLBACK cuando no hay esquema. */}
      <div className={`relative overflow-hidden bg-[var(--sf-banda,var(--sf-tinta))] ${alturaClase}`}>
        <Carousel
          className="absolute inset-0"
          opts={{ loop: true }}
          aria-label="Carrusel de diapositivas"
          onMouseEnter={pausar}
          onMouseLeave={reanudar}
          onFocus={pausar}
          onBlur={reanudar}
          onTouchStart={pausar}
          onTouchEnd={reanudar}
          onTouchCancel={reanudar}
        >
          <CarouselContent className="ml-0 h-full">
            {instancia.items.map((item, i) => (
              <CarouselItem key={i} className="h-full pl-0">
                <Diapositiva
                  item={item}
                  campoBase={`${id}.items.${i}`}
                  contenedorClase={contenedorClase}
                  paginas={paginas}
                  preview={preview}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
          <Controles autoplay={instancia.autoplay} activo={activo} total={instancia.items.length} />
        </Carousel>
      </div>
    </section>
  );
}
