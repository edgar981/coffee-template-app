"use client";

import { useEffect, useRef, useState } from "react";
import { preload } from "react-dom";
import Image from "next/image";

import { motion, useReducedMotion, useTransform } from "framer-motion";

import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { objectPositionDePuntoFocal, productoSpotlight } from "@/lib/config/site-content-defaults";
import { useProgresoScroll, transformMarquesinaTexto, transformMarquesinaTarjeta } from "@/lib/animation";
import { getCatalog } from "@/lib/api/products";
import type { Product } from "@/types/product";
import { imagenPortada } from "@/lib/producto-imagen";

// EL COMPONENTE DE LA VARIANTE "STICKY" DEL HERO (§ MUESTRARIO-HERO-MARQUESINA-STICKY-1) — la
// CUARTA composición (tras curtina/ficha/media, § HeroSection.tsx: `VARIANTES.sticky`), y la que
// reemplaza el diagnóstico del owner («las letras del marquee salen lit sobre el hero, no en una
// sección abajo») con lo que el tema REAL construye: NO dos bandas apiladas (hero +
// `Marquesina.tsx` debajo, la forma de hoy bajo CORTE) sino UNA sola composición pineada, con el
// texto y la tarjeta pasando POR ENCIMA de la media del hero mientras ésta queda fija.
//
// LA CLAVE DE VARIANTE ES `'sticky'`, NO `'marquesina'` — pese a que el ARCHIVO/COMPONENTE se llama
// `HeroMediaMarquesina` (por lo que HACE: media de hero + contenido de marquesina) y a que TODO su
// contenido sale de la sección `marquesina`. `'marquesina'` como CLAVE de variante ya está
// reservada en `PLIEGO.variantes.hero` (themes.ts) para una composición ajena; ver el docstring de
// `HeroSection.tsx`/`REGISTRY.hero.variantes` (site-content-defaults.ts) para el desvío medido.
//
// MEDIDO CONTRA EL TEMA REAL (`https://x-cafeone.myshopify.com/`, NO el prototipo estático — ver
// abajo por qué), buscando `hero_banner_marquee`: UNA sola sección, `position:sticky;top:0;
// height:100vh`, con el VIDEO de fondo, un VELO oscuro PLANO encima, una capa de TEXTO
// `position:absolute;top:50%;transform:translateY(-50%);z-index:10;white-space:nowrap` (el track
// del marquee) y la TARJETA de producto, encima de todo. El efecto: el hero queda PEGADO mientras
// el texto cruza y la tarjeta entra sobre él.
//
// `docs/prototipos/cafeone/` DERIVA DEL TEMA Y YA NO ES LA AUTORIDAD PARA ESTA BANDA. Su `.marquee`
// (que `Marquesina.tsx` reproduce fielmente) es una SEGUNDA sección, aparte del `.hero`, con su
// propia foto de fondo velada al 55% — la forma de DOS bandas apiladas que el owner reportó como
// mala tres veces. El tema real las fusionó en una; esta variante hace lo mismo en nuestro modelo.
//
// REUSA CONTENIDO, NO LO DUPLICA (instrucción explícita del spec: "si te parece que deben ser
// campos propios del hero, PARÁ y reportá — duplicar el dato es peor"). El texto del loop y el pin
// de la tarjeta flotante YA VIVEN en `marquesina` (`texto`/`productoSlug`, § `MarquesinaContent`) —
// el MISMO mecanismo que `Marquesina.tsx` ya usa (`productoSpotlight`, puntero al `Product` vivo,
// nunca copia). Esta variante los LEE directo, sin depender de `marquesina.visible`: la banda
// SUELTA (`Marquesina.tsx`) sigue siendo su propio interruptor, independiente de qué variante de
// hero esté activa — es responsabilidad del PRESET que active esta variante apagar también la banda
// suelta con `bandasVisibles.marquesina:false` (§ MUESTRARIO-BANDA-APAGABLE-1), para no mostrar el
// mismo contenido dos veces (una acá, encima del hero; otra en su propia banda, debajo). Esta
// variante NO lo apaga por sí misma — no le corresponde decidir la visibilidad de OTRA sección.
//
// EL FONDO/VELO SON DEL PROPIO HERO, COMO LAS DEMÁS VARIANTES: `hero.imagen`/`imagenTipo`/
// `imagenPoster`/`puntoFocal` (video o imagen, con el mismo punto focal de HERO-PUNTO-FOCAL-1) —
// `marquesina.imagen` (la foto de la banda suelta) NO se usa acá, porque el fondo de ESTA
// composición es el del HERO, no el de la marquesina. `marquesina` sólo aporta el TEXTO y el PIN.
//
// EL VELO ES UN OVERLAY PLANO, NO EL GRADIENTE DE DOS PARADAS DE HeroMedia.tsx: lo medido dice "un
// velo oscuro encima del video" (una sola capa, no un degradado top→bottom), así que se reusa el
// MISMO token compartido `--sf-velo` (§ CORTE-MARQUESINA-VELO-1, `app/globals.css`,
// `color-mix(in oklab, var(--sf-tinta) 80%, transparent)`) con el tratamiento PLANO de
// `Marquesina.tsx` (`bg-[var(--sf-velo)]`), no el `from/via/to` de HeroMedia.tsx. Un velo plano al
// 80% en TODO el alto de la sección protege al nav transparente-flotante AL MENOS tanto como el
// tramo superior de HeroMedia (60%) — nunca menos —, así que la legibilidad del nav está cubierta
// sin necesitar un segundo tono para el tercio superior.
//
// ALTURALLENA/CUEDESLIZA NO SE LEEN ACÁ, A PROPÓSITO (decisión pedida por el spec: "decidí cómo
// conviven con el sticky y asentalo"). Los dos son agregados de `HeroMedia.tsx` para su propio caso
// (una sección NO pineada, en flujo normal, que puede o no llenar el viewport y puede o no llevar
// el cue de "Desliza"). Lo medido contra el tema real es un panel SIEMPRE de `height:100vh` fijo
// (nunca `92vh`) y SIN cue de scroll (el gesto de "pasar por encima" del marquee ya ES la
// indicación de que hay más abajo) — así que esta variante usa `h-[100svh]` incondicional y no
// declara ningún cue propio. `alturaLlena`/`cueDesliza` siguen siendo exclusivos de `HeroMedia`.
//
// LA MECÁNICA DE STICKY, EN DOS ELEMENTOS: el elemento que el visitante VE pineado
// (`<section className="sticky top-0 h-[100svh] …">`) necesita un ANCESTRO más alto que el
// viewport para tener contra qué "engancharse" — un `position:sticky` del mismo alto que su
// contenedor no tiene distancia de scroll que recorrer y nunca se pinea. Ese ancestro es el `<div>`
// raíz de este componente (`min-h-[calc(100svh+70vh)]`): el `100svh` es el propio panel pineado, y
// el `70vh` extra es el PRESUPUESTO DE SCROLL para que el texto y la tarjeta completen su
// recorrido — el MISMO alto que `Marquesina.tsx` ya usaba para su propia banda (`min-h-[70vh]`),
// reusado acá en vez de inventar un número nuevo: es el mismo trayecto de scroll que el texto y la
// tarjeta siempre recorrieron, ahora ENCIMA del hero en vez de en su propia banda suelta.
//
// EL PROGRESO DE SCROLL SE MIDE CONTRA ESE ANCESTRO, NUNCA CONTRA EL PANEL PINEADO: mientras está
// pineado, un elemento `sticky` reporta `top:0` FIJO ante `getBoundingClientRect` — medirlo daría
// un progreso estancado. El ancestro, en cambio, sigue en flujo normal y se mueve con el scroll
// real. Por eso `useProgresoScroll` (§ lib/animation.ts, el MISMO motor de `Marquesina.tsx`, sin
// una sola línea nueva) recibe la ref del `<div>` exterior, no la de la `<section>` pineada. Con
// eso, `transformMarquesinaTexto`/`transformMarquesinaTarjeta` (las MISMAS funciones puras que
// `Marquesina.tsx` ya usa) producen exactamente el mismo desplazamiento/escala-rotación de siempre,
// sólo que ahora leídos contra el presupuesto de scroll del ancestro en vez del de la banda suelta.
//
// VERIFICADO ANTES DE ESCRIBIR (§ el spec: "verificá que ningún ancestro tenga overflow que rompa
// el sticky"): `StorefrontLayout` (`app/(storefront)/layout.tsx`) no impone `overflow` en NINGÚN
// nivel entre `<body>` y esta sección (`<div className="min-h-screen …">` sin overflow, `<main>`
// sin overflow, y `page.tsx` monta cada banda en un `<Fragment>` sin envoltorio propio) — `grep -n
// overflow` sobre esos dos archivos da CERO resultados. El sticky funciona por construcción.
//
// MOVIMIENTO REDUCIDO Y VISTA PREVIA: MISMO gate que `Marquesina.tsx` (`estatico = preview ||
// !!useReducedMotion()`) — con él, el texto queda CENTRADO y QUIETO y la tarjeta sin transformar,
// nunca "a medio camino" de un recorrido que no va a avanzar.
const TRAVEL_FALLBACK_PX = 1600;

export default function HeroMediaMarquesina({ style }: { style?: React.CSSProperties } = {}) {
  const { hero, marquesina } = useSiteContent();
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

  // El ANCESTRO del sticky (§ el docstring de cabecera) — el target de `useProgresoScroll`, nunca
  // la `<section>` pineada.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const progreso = useProgresoScroll(wrapperRef);
  const transformTexto = useTransform(progreso, (p) => transformMarquesinaTexto(p, travelPx, estatico));
  const transformTarjeta = useTransform(progreso, (p) => transformMarquesinaTarjeta(p, estatico));

  // PUNTO FOCAL (§ HERO-PUNTO-FOCAL-1): mismo mecanismo que HeroMedia.tsx, aplicado a los DOS
  // medios. `undefined` para la canónica ('centro') o basura — no se emite ningún `style`.
  const objectPosition = objectPositionDePuntoFocal(hero.puntoFocal);
  const estiloPuntoFocal = objectPosition ? { objectPosition } : undefined;

  const esVideo = hero.imagenTipo === 'video';
  const videoRef = useRef<HTMLVideoElement>(null);
  const reproducir = esVideo && !preview && !reduce;

  if (esVideo && hero.imagenPoster) {
    preload(hero.imagenPoster, { as: "image", fetchPriority: "high" });
  }

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    if (reproducir) v.play().catch(() => {});
    else v.pause();
  }, [reproducir]);

  return (
    <div
      ref={wrapperRef}
      className="relative min-h-[calc(100svh+70vh)] bg-[var(--sf-banda,var(--sf-tinta))]"
      style={style}
    >
      <section
        aria-label={marquesina.texto}
        className="sticky top-0 flex h-[100svh] items-center justify-center overflow-hidden bg-[var(--sf-banda,var(--sf-tinta))]"
      >
        <div className="absolute inset-0">
          {esVideo ? (
            <video
              ref={videoRef}
              src={hero.imagen}
              poster={hero.imagenPoster || undefined}
              muted
              loop
              playsInline
              preload={reproducir ? 'auto' : 'none'}
              controls={!!reduce && !preview}
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover"
              style={estiloPuntoFocal}
            />
          ) : (
            <Image
              src={hero.imagen}
              alt=""
              fill
              priority
              sizes="100vw"
              quality={85}
              className="object-cover"
              style={estiloPuntoFocal}
            />
          )}

          {/* EL VELO — overlay PLANO en `--sf-velo` (§ el docstring de cabecera), NO el gradiente de
              dos paradas de HeroMedia.tsx. */}
          <div className="absolute inset-0 bg-[var(--sf-velo)]" />
        </div>

        {/* EL LOOP DE TEXTO — MEDIDO: `position:absolute;top:50%;z-index:10;white-space:nowrap`.
            Decorativo (el nombre accesible vive en el `aria-label` de la sección, como
            `Marquesina.tsx`); se repite dos veces para el efecto de cinta continua. */}
        <motion.div
          aria-hidden="true"
          className="absolute left-0 top-1/2 z-10 flex whitespace-nowrap font-playfair text-[clamp(3rem,10vw,10rem)] leading-none text-[var(--sf-sobre-banda,white)]"
          style={{ transform: transformTexto }}
        >
          <span className="pr-8">{marquesina.texto} —&nbsp;</span>
          <span className="pr-8">{marquesina.texto} —&nbsp;</span>
        </motion.div>

        {/* LA TARJETA — MEDIDO: "encima" del texto y del velo. `z-20` (por encima del `z-10` del
            loop). Hide-on-empty de UN elemento (el pin), como en `Marquesina.tsx`: sin `productoSlug`
            o con el catálogo vacío, simplemente no se muestra — el texto del loop no depende de ella. */}
        {producto && (
          <motion.div
            className="relative z-20 grid aspect-[3/4] w-[min(340px,62vw)] place-items-center rounded-2xl bg-[var(--sf-tarjeta,white)] p-8"
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
    </div>
  );
}
