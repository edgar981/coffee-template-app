"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion, useTransform } from "framer-motion";

import { useProgresoScroll, transformMarquesinaTexto, transformMarquesinaTarjeta } from "@/lib/animation";
import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { REGISTRY, seccionEsVisible, productoSpotlight } from "@/lib/config/site-content-defaults";
import { getCatalog } from "@/lib/api/products";
import type { Product } from "@/types/product";
import { imagenPortada } from "@/lib/producto-imagen";

// LA BANDA MARQUESINA (§ MARQUESINA-BANDA-1, medido: MARQUESINA-BANDA-CENSO-1) — tres capas: foto
// de fondo velada con overlay oscuro, un LOOP de texto a gran escala que se desplaza con el scroll
// de la sección, y una tarjeta de producto flotante que escala/rota con el mismo progreso. Ver el
// docstring de `MarquesinaContent` (site-content-defaults.ts) para el porqué mecánico de que NAZCA
// APAGADA y de su posición 2ª (justo tras el hero). El gate de visibilidad vive ACÁ (como
// brandStory/origen/spotlight), no en `page.tsx`.
//
// EL PIN — `productoSlug` resuelto con `productoSpotlight` (site-content-defaults.ts), el MISMO
// mecanismo que ya usa `Spotlight.tsx`: puntero al `Product` vivo, nunca copia de su nombre/precio/
// imagen (§ SpotlightContent, "la decisión es PUNTERO no copia"). Sin pin, o con el catálogo vacío,
// la tarjeta flotante simplemente NO se muestra — hide-on-empty de UN elemento, no de toda la
// sección: el texto del loop no depende del producto.
//
// EL SCROLL — reusa `useScroll`/`useTransform` de `lib/animation.ts` (§ TEMAS-BRANDSTORY-DIRECCION-
// ARTE-1, el motor que ese slice construyó, no un listener propio): `useProgresoScroll` da el
// progreso CRUDO 0..1 de la sección (mismo offset que mide `FSA.scrub`,
// `docs/prototipos/cafeone/js/app.js:190-197`), y `transformMarquesinaTexto`/
// `transformMarquesinaTarjeta` (puras, `lib/animation.ts`) reproducen el desplazamiento del texto y
// la escala/rotación de la tarjeta de `js/home.js:259-282`.
//
// MOVIMIENTO REDUCIDO, NO NEGOCIABLE: con `prefers-reduced-motion` (o en la vista previa del editor,
// que tampoco puede scrollear de verdad — mismo criterio que `BrandStoryCentrada`/`Origen`) el texto
// queda QUIETO —centrado, legible, sin desplazarse— y la tarjeta sin transformar (su estado
// acomodado: escala 1, sin rotar). `useReducedMotion()` es el detector: un valor de scroll ligado
// directo vía `useScroll`+`useTransform` no pasa por `ReducedMotionProvider` (`MotionConfig` sólo
// congela animaciones DECLARATIVAS disparadas por `.start()`), así que el guard acá SÍ hace falta —
// mismo razonamiento que el comentario de `BrandStoryCentrada.tsx`.
//
// EL TRAVEL (cuánto se desplaza el texto) se mide del viewport REAL tras montar
// (`window.innerWidth * 1.6`, § `js/home.js:270`) — en un `useEffect`, nunca en el primer render
// (SSR no tiene `window`). Antes de esa medición se usa un fallback razonable; con `estatico` el
// travel no se usa (el texto no se desplaza), así que el fallback nunca llega a verse.
const TRAVEL_FALLBACK_PX = 1600;

export default function Marquesina({ style }: { style?: React.CSSProperties } = {}) {
  const { marquesina } = useSiteContent();
  const preview = useIsPreview();
  const reduce = useReducedMotion();
  const estatico = preview || !!reduce;

  const [catalog, setCatalog] = useState<Product[]>([]);
  useEffect(() => {
    getCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);
  const producto = productoSpotlight(catalog, marquesina.productoSlug);

  const [travelPx, setTravelPx] = useState(TRAVEL_FALLBACK_PX);
  useEffect(() => {
    setTravelPx(window.innerWidth * 1.6);
  }, []);

  const sectionRef = useRef<HTMLElement>(null);
  const progreso = useProgresoScroll(sectionRef);
  const transformTexto = useTransform(progreso, (p) => transformMarquesinaTexto(p, travelPx, estatico));
  const transformTarjeta = useTransform(progreso, (p) => transformMarquesinaTarjeta(p, estatico));

  if (!seccionEsVisible(REGISTRY.marquesina, marquesina)) return null;

  return (
    <section
      ref={sectionRef}
      aria-label={marquesina.texto}
      className="relative flex min-h-[70vh] items-center justify-center overflow-hidden bg-[var(--sf-banda,var(--sf-tinta))] py-24"
      style={style}
    >
      <div className="absolute inset-0">
        <Image src={marquesina.imagen} alt="" fill sizes="100vw" className="object-cover opacity-55" />
        {/* EL VELO lee `--sf-velo` (§ CORTE-MARQUESINA-VELO-1, `app/globals.css`), la MISMA variable
            que el PIE del velo de HeroMedia.tsx, para que la banda se lea continua con el hero justo
            arriba — una sola superficie oscura, sin costura. Antes era un literal propio (`/70`,
            distinto del `/80` del hero) que ya derivaba de `--sf-tinta` pero no coincidía con el
            hero; ahora los dos VALEN lo mismo porque LEEN lo mismo. */}
        <div className="absolute inset-0 bg-[var(--sf-velo)]" />
      </div>

      {/* EL LOOP — decorativo (el texto accesible vive en el `aria-label` de la sección); se repite
          dos veces, como `.marquee-track` del prototipo, para el efecto de cinta continua. */}
      <motion.div
        aria-hidden="true"
        className="absolute left-0 top-1/2 flex whitespace-nowrap font-playfair text-[clamp(3rem,10vw,10rem)] leading-none text-[var(--sf-sobre-banda,white)]"
        style={{ transform: transformTexto }}
      >
        <span className="pr-8">{marquesina.texto} —&nbsp;</span>
        <span className="pr-8">{marquesina.texto} —&nbsp;</span>
      </motion.div>

      {producto && (
        <motion.div
          className="relative z-10 grid aspect-[3/4] w-[min(340px,62vw)] place-items-center rounded-2xl bg-[var(--sf-tarjeta,white)] p-8"
          style={{ transform: transformTarjeta }}
        >
          <div className="relative h-full w-full">
            <Image
              src={imagenPortada(producto.imagen)}
              alt={producto.nombre}
              fill
              sizes="340px"
              className="object-contain"
            />
          </div>
        </motion.div>
      )}
    </section>
  );
}
