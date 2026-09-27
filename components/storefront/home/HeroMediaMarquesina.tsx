"use client";

import { useEffect, useRef, useState } from "react";
import { preload } from "react-dom";
import Image from "next/image";

import { motion, useReducedMotion, useTransform } from "framer-motion";

import { useSiteContent } from "@/components/storefront/SiteContentProvider";
import { useIsPreview } from "@/components/storefront/PreviewMode";
import { objectPositionDePuntoFocal, productoSpotlight } from "@/lib/config/site-content-defaults";
import {
  useProgresoScrollDesdeTope, transformMarquesinaTarjeta, veloOpacidad,
  opacidadRevelado, translateYRevelado, claseAlturaAncestroMarquesina,
  duracionTickerS, VELOCIDAD_TICKER_PX_S, DURACION_TICKER_FALLBACK_S,
} from "@/lib/animation";
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
// MEDIDO CONTRA EL TEMA REAL — VERIFICADO POR EJECUCIÓN (`node --eval "fetch(...)"` contra
// `https://x-cafeone.myshopify.com/`, no sólo citado del spec), buscando `hero_banner_marquee`: es
// `<xo-parallax class="h:300vh">` envolviendo `<div class="pos:sticky t:s0 h:100vh …">` — el panel
// pineado mide `100vh` DENTRO de un ancestro de `300vh` (100vh propios + 200vh de presupuesto de
// scroll). Adentro del panel: el VIDEO de fondo (`<xo-video-cover>`), un velo negro cuya opacidad
// en el sitio real ANIMA con el scroll (`xo-parallax-scroll` con keyframes 0→0.6 entre 20%-40% del
// progreso — NO un plano estático), una capa de TEXTO `pos:absolute;t:50%;
// trf:translateY(-50%);z:10` que envuelve un ticker `<xo-marquee xo-speed="1">` (auto-scroll
// CONTINUO por velocidad/tiempo, independiente del scroll de página) con su propio reveal de
// entrada (slide-up + fade, otro `xo-parallax-scroll`), y la TARJETA de producto con su propio
// reveal de entrada (slide-up + fade, SIN escala ni rotación), en `z:100`. El efecto visible: el
// hero queda PEGADO mientras el texto y la tarjeta aparecen y se mueven por encima.
//
// ESTA VARIANTE REPLICA LA ESTRUCTURA (sticky + velo opt-in + texto-encima + tarjeta-encima) Y, DESDE
// § CORTE-HERO-VELO-OFF-Y-TICKER-1, TAMBIÉN EL EJE HORIZONTAL DEL TEXTO — RONDA 3, QUE REVIERTE LA
// DECISIÓN ORIGINAL. La primera versión (arriba, histórica) ataba el desplazamiento horizontal al
// SCROLL (`transformMarquesinaTexto`, la función que `Marquesina.tsx` ya usaba) por una decisión
// EXPLÍCITA del spec de `MUESTRARIO-HERO-MARQUESINA-STICKY-1` ("reusá el motor de scroll… no agregues
// librería"). El owner, sobre el tema real: «las letras… están continuamente desplazándose
// horizontalmente, como un aviso, no estático» — es LITERALMENTE lo que ese spec original prohibió
// reproducir (§ RONDA 3, el bloque del ticker más abajo, y § el docstring de `VELOCIDAD_TICKER_PX_S`
// en `lib/animation.ts`, donde vive la medición contra el JS del tema real). El eje VERTICAL (el
// revelado por scroll, § RONDA 3 más abajo) no cambió: sigue siendo scroll-scrubbed, sin tocar. La
// TARJETA sigue usando `transformMarquesinaTarjeta` (scroll-driven, sin cambios) — el pedido del
// owner es sobre el TEXTO, no sobre la tarjeta, y no hay evidencia de que la tarjeta deba cambiar de
// motor.
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
// EL VELO — RONDA 2 (§ CORTE-HERO-STICKY-RONDA-2-1): DEJÓ DE SER UN OVERLAY SIEMPRE-ENCENDIDO. La
// primera versión de esta variante lo fijaba al 80% horneado en `--sf-velo` en TODO momento —el
// owner, sobre el prototipo aplicado, reportó "el velo... lo oscurece mucho... se ve opaca la
// página"—. Ahora la OPACIDAD DEL ELEMENTO (el `opacity` CSS del `<div>`, una segunda capa de alfa
// que multiplica al 80% ya horneado en el token) sigue el MISMO `progreso` de scroll que ya mueve
// texto/tarjeta, vía `veloOpacidad` (`lib/animation.ts`): casi transparente en reposo (el PISO
// `VELO_OPACIDAD_PISO`, medido por contraste — ver el docstring de esa función para los tres números
// contra las fotos de referencia de `HeroMedia.tsx`), denso al final del recorrido — la MISMA
// dirección que el `xo-parallax-scroll` 0→0.6 real (§ el comentario de cabecera), sin replicar sus
// keyframes exactos. **EL COLOR SIGUE SALIENDO DEL TOKEN**: el fondo del `<div>` sigue siendo
// `bg-[var(--sf-velo)]`, sin tocar; sólo se le agrega un `style.opacity` animado por encima — nunca
// un rgba horneado ni un segundo color. Bajo `estatico` (reduced-motion/preview) el velo NO puede
// quedar en el piso semitransparente —no hay scroll que lo densifique—, así que rinde la MISMA
// densidad de HOY (1 → efectiva 0.80).
//
// EL VELO ES OPT-IN — RONDA 3 (§ CORTE-HERO-VELO-OFF-Y-TICKER-1): `hero.veloVisible` (default
// `true`, § `HeroContent.veloVisible` en site-content-defaults.ts) decide si el `<motion.div>` del
// velo se MONTA en absoluto — no un `opacity:0` disfrazado, el nodo directamente no existe cuando es
// `false`. El owner, sobre CORTE aplicado: «ese velo verde debemos quitarlo, hace que el video se vea
// sin calidad» — CORTE apaga el toggle (`heroVeloVisible:false`, § themes.ts); el mecanismo de arriba
// (`veloOpacidad`, el piso, la densidad final) NO CAMBIÓ, sigue rigiendo para todo tema que deje el
// toggle en su default `true`. El contraste SIN velo, medido contra las mismas tres fotos de
// referencia, está MUY por debajo del piso AA (§ el docstring de `veloOpacidad`) — apagarlo es
// seguro para CORTE sólo porque su video es oscuro, no porque el mecanismo de contraste deje de
// importar; ver ese docstring para el número completo y la advertencia al owner.
//
// ALTURALLENA sigue SIN leerse acá (decisión ORIGINAL, sin cambios en esta ronda): es un agregado de
// `HeroMedia.tsx` para su propio caso (una sección NO pineada que puede o no llenar el viewport); lo
// medido contra el tema real es un panel SIEMPRE de `height:100vh` fijo (nunca `92vh`), así que esta
// variante usa `h-[100svh]` incondicional sin necesitar el toggle.
//
// CUEDESLIZA — RONDA 2 (§ CORTE-HERO-STICKY-RONDA-2-1): SÍ SE LEE, a diferencia de la decisión
// original ("esta variante no declara ningún cue propio... el gesto de pasar por encima del
// marquee ya ES la indicación"). El owner lo pidió VISIBLE, y CORTE (el único preset que hoy pide
// `hero:'sticky'`) YA declara `heroCueDesliza:true` (`lib/config/themes.ts`) — un dato que existía y
// que, antes de esta ronda, ningún render leía (§ `hero-toggles-preset.test.ts`, el caso que este
// slice invierte). Se lee el MISMO campo `hero.cueDesliza` que `HeroMedia.tsx` ya declara —sin
// inventar uno nuevo, instrucción explícita del spec— y se rinde el MISMO marcado
// (`data-hero-cue="desliza"`, la línea con el segmento que la recorre + la etiqueta "Desliza"),
// verbatim, para no duplicar ni divergir la única implementación del cue. Mismo gate que allá:
// `!preview` (scrollear no significa nada en un marco de vista previa) y sin guard propio de
// reduced-motion (`ReducedMotionProvider`, montado en el layout, ya congela el `y` animado del
// segmento — § el docstring de `ReducedMotionProvider`, `lib/animation.ts`).
//
// EL REVELADO DEL TEXTO — § CORTE-HERO-MARQUEE-REVELA-1 (`lib/animation.ts`, el bloque
// "EL REVELADO DEL TEXTO" para la derivación completa): el owner reportó, sobre el muestrario de
// RONDA 2, que el marquee «no debe salir inicialmente… las letras van saliendo hacia arriba, en una
// transición smooth, cuando alguien empiece a hacer scroll». `opacidadRevelado`/`translateYRevelado`
// se SUMAN al `transformMarquesinaTexto`/`veloOpacidad` de siempre (no los reemplazan): en reposo
// (`progreso=0`) el texto es invisible (`opacity:0`) y está corrido `fadeUp.hidden.y` (24px) por
// debajo de su centrado; al 20% del progreso (`UMBRAL_REVELADO_TEXTO.hasta`) ya llegó a su posición
// final y opacidad completa, y el resto del recorrido (el desplazamiento horizontal continuo + la
// tarjeta) sigue exactamente igual que antes de esta ronda. Bajo `estatico` el texto queda SIEMPRE
// visible y en su lugar (`opacidadRevelado`/`translateYRevelado` rinden 1/0) — un gate de movimiento
// nunca puede esconder contenido.
//
// EL PRESUPUESTO DE SCROLL DEJA DE SER FIJO — § CORTE-HERO-MARQUEE-REVELA-1 (`lib/animation.ts`, el
// bloque "EL PRESUPUESTO DE SCROLL"): medido contra el muestrario desplegado, su catálogo está VACÍO
// y la sección pineada nunca renderiza la tarjeta, así que el ancestro arrastraba 200vh de recorrido
// —135vh de ellos dedicados a la ventana [0.12,0.57] de `transformMarquesinaTarjeta`— sin nada que
// esa ventana pudiera animar: el "tramo muerto" que el owner reportó como bug. `producto` (hide-on-
// empty, ya calculado más abajo para decidir si la tarjeta se muestra) decide TAMBIÉN cuánto
// presupuesto reservar (`claseAlturaAncestroMarquesina`): 200vh con tarjeta (sin cambios), 65vh sin
// ella —lo que queda tras restar exactamente la ventana de la tarjeta—.
//
// LA MECÁNICA DE STICKY, EN DOS ELEMENTOS: el elemento que el visitante VE pineado
// (`<section className="sticky top-0 h-[100svh] …">`) necesita un ANCESTRO más alto que el
// viewport para tener contra qué "engancharse" — un `position:sticky` del mismo alto que su
// contenedor no tiene distancia de scroll que recorrer y nunca se pinea. Ese ancestro es el `<div>`
// raíz de este componente (`min-h-[calc(100svh+200vh)]`): el `100svh` es el propio panel pineado, y
// el `200vh` extra es el PRESUPUESTO DE SCROLL, MEDIDO —no inventado— contra el `<xo-parallax
// class="h:300vh">` real (§ el comentario de cabecera: 300vh = 100vh del panel + 200vh de
// recorrido). No se reusó el `min-h-[70vh]` de la banda SUELTA de `Marquesina.tsx` —esa cifra es el
// alto de OTRA composición (una banda en flujo normal, no un ancestro de sticky) y coincide sólo
// por casualidad de vocabulario, no de medición—.
//
// EL PROGRESO DE SCROLL SE MIDE CONTRA ESE ANCESTRO, NUNCA CONTRA EL PANEL PINEADO: mientras está
// pineado, un elemento `sticky` reporta `top:0` FIJO ante `getBoundingClientRect` — medirlo daría
// un progreso estancado. El ancestro, en cambio, sigue en flujo normal y se mueve con el scroll
// real.
//
// `useProgresoScrollDesdeTope` — RONDA 2 (§ CORTE-HERO-STICKY-RONDA-2-1), NO `useProgresoScroll`.
// La primera versión reusaba `useProgresoScroll` a secas ("el MISMO motor de `Marquesina.tsx`, sin
// una sola línea nueva") y eso era el BUG que el owner reportó: "las letras salen de una, deberían
// salir apenas alguien empieza a hacer scroll". `useProgresoScroll` usa el offset `["start end",
// "end start"]`, calibrado para un elemento que el visitante encuentra MÁS ABAJO de la página (entra
// por el borde inferior del viewport) — pero este ancestro es el PRIMER hijo de `<main>` (el
// `<header>` de `StoreNav` es `fixed`, no ocupa flujo), así que al cargar (scrollY=0) ya estaba
// "adentro" según ese offset: MEDIDO por derivación cerrada (no adivinado, § el docstring de
// `useProgresoScrollDesdeTope`/`progresoDesdeTope` en `lib/animation.ts`), el progreso al cargar
// era **0.25** — un cuarto del recorrido ya consumido, exactamente la forma del defecto (el texto
// nace trasladado `-0.25*travelPx`). La hermana usa `["start start", "end start"]` — el MISMO ancla
// final (sin tocar), sólo cambia el ancla de progreso-0 al instante en que el tope del ancestro toca
// el tope del viewport (`scrollY=0` para este ancestro) — progreso EXACTO 0 al cargar. NO se tocó
// `useProgresoScroll`: la usan también `Marquesina.tsx` y `SubscriptionCTALinea.tsx`, bandas de media
// página donde su offset SÍ es el correcto; la hermana vive aparte, en el mismo archivo.
//
// `transformMarquesinaTarjeta` (la MISMA función pura que `Marquesina.tsx` ya usa, sin cambios en
// esta ronda) produce exactamente la misma escala/rotación de siempre, leída contra el progreso YA
// corregido. `transformMarquesinaTexto` YA NO SE LLAMA ACÁ — desde § CORTE-HERO-VELO-OFF-Y-TICKER-1
// (RONDA 3) el eje horizontal del texto es un TICKER por tiempo, no por scroll; ver esa sección más
// abajo para el porqué y la mecánica completa. `Marquesina.tsx` sigue usando la función sin cambios.
//
// VERIFICADO ANTES DE ESCRIBIR (§ el spec: "verificá que ningún ancestro tenga overflow que rompa
// el sticky"): `StorefrontLayout` (`app/(storefront)/layout.tsx`) no impone `overflow` en NINGÚN
// nivel entre `<body>` y esta sección (`<div className="min-h-screen …">` sin overflow, `<main>`
// sin overflow, y `page.tsx` monta cada banda en un `<Fragment>` sin envoltorio propio) — `grep -n
// overflow` sobre esos dos archivos da CERO resultados. El sticky funciona por construcción.
//
// EL TICKER — RONDA 3 (§ CORTE-HERO-VELO-OFF-Y-TICKER-1, ver el docstring de `VELOCIDAD_TICKER_PX_S`
// en `lib/animation.ts` para la medición contra el tema real): el texto se desplaza horizontalmente
// SOLO, por TIEMPO — `framer-motion`'s `animate` con `x: ['0%', '-50%']`, `repeat: Infinity`,
// `ease: 'linear'` — DESACOPLADO de `progreso` (el scroll). Vive en un `<motion.div>` ANIDADO dentro
// del que centra/revela por scroll: dos elementos, dos motores, en vez del `transform` armado a mano
// de antes. `trackRef` mide el ancho de UNA COPIA del texto (el primer `<span>`) para calcular la
// duración de un ciclo a la velocidad medida (`duracionTickerS`) — se re-mide al montar y en cada
// resize, porque el ancho depende del texto y del tamaño de fuente responsive (`clamp(3rem,10vw,
// 10rem)`).
//
// `estatico` (reduced-motion/preview) DETIENE el ticker — `animate:{x:'0%'}` sin keyframes ni
// `repeat` — texto VISIBLE, QUIETO y legible, nunca "a medio camino" de un desplazamiento que no va a
// avanzar. Mismo criterio que ya rige `transformMarquesinaTarjeta`/`veloOpacidad` bajo `estatico`.
//
// SIN PAUSA AL PASAR EL CURSOR — medido contra el tema real (§ el docstring de
// `VELOCIDAD_TICKER_PX_S`): `xoPauseOnHover` es `false` por default y el HTML servido no trae el
// atributo que lo activaría. No se implementa acá tampoco.
//
// MOVIMIENTO REDUCIDO Y VISTA PREVIA: MISMO gate que `Marquesina.tsx` (`estatico = preview ||
// !!useReducedMotion()`) — con él, el texto queda CENTRADO, QUIETO (ticker detenido) y la tarjeta sin
// transformar, nunca "a medio camino" de un recorrido que no va a avanzar.

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

  // El TICKER (§ el docstring de cabecera, "EL TICKER — RONDA 3"): `trackRef` apunta al `<motion.div>`
  // con las dos copias del texto; se mide el ancho de la PRIMERA (`children[0]`) para derivar la
  // duración de un ciclo a `VELOCIDAD_TICKER_PX_S`. Re-medido al montar y en cada resize — el ancho
  // depende del texto y de un tamaño de fuente `clamp(...)` responsive.
  const trackRef = useRef<HTMLDivElement>(null);
  const [duracionTicker, setDuracionTicker] = useState(DURACION_TICKER_FALLBACK_S);
  useEffect(() => {
    function medir() {
      const primero = trackRef.current?.children[0] as HTMLElement | undefined;
      if (!primero) return;
      const ancho = primero.getBoundingClientRect().width;
      if (ancho > 0) setDuracionTicker(duracionTickerS(ancho, VELOCIDAD_TICKER_PX_S));
    }
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [marquesina.texto]);

  // El ANCESTRO del sticky (§ el docstring de cabecera) — el target de `useProgresoScrollDesdeTope`,
  // nunca la `<section>` pineada.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const progreso = useProgresoScrollDesdeTope(wrapperRef);
  // EL REVELADO (§ el docstring de cabecera): SÓLO el eje VERTICAL — centrado (`translateY(-50%)`) +
  // `translateYRevelado` sumado (dos `translate()` sucesivos se combinan por suma), nunca lo
  // reemplaza. El eje HORIZONTAL vive aparte, en el ticker (arriba) — ya no en este `transform`.
  // `dy===0` (estatico, o progreso ya pasó la ventana) omite el translateY extra en vez de sumar un
  // "translateY(0.0px)" inerte.
  const transformVertical = useTransform(progreso, (p) => {
    const dy = translateYRevelado(p, estatico);
    return dy === 0 ? 'translateY(-50%)' : `translateY(-50%) translateY(${dy.toFixed(1)}px)`;
  });
  const opacidadTexto = useTransform(progreso, (p) => opacidadRevelado(p, estatico));
  const transformTarjeta = useTransform(progreso, (p) => transformMarquesinaTarjeta(p, estatico));
  const opacidadVelo = useTransform(progreso, (p) => veloOpacidad(p, estatico));

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
      className={`relative ${claseAlturaAncestroMarquesina(!!producto)} bg-[var(--sf-banda,var(--sf-tinta))]`}
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

          {/* EL VELO — OPT-IN DESDE RONDA 3 (§ el docstring de cabecera, "EL VELO ES OPT-IN"):
              `hero.veloVisible` decide si este nodo se MONTA. Cuando se monta, mismo `bg-[var(
              --sf-velo)]` de siempre (el color sigue del TOKEN, sin tocar) con su `opacity` siguiendo
              el scroll — casi transparente en reposo, densa al final del recorrido. */}
          {hero.veloVisible && (
            <motion.div className="absolute inset-0 bg-[var(--sf-velo)]" style={{ opacity: opacidadVelo }} />
          )}
        </div>

        {/* EL LOOP DE TEXTO — DOS ELEMENTOS DESDE RONDA 3 (§ el docstring de cabecera, "EL TICKER"):
            el de AFUERA centra/revela por SCROLL (posición + opacidad, MEDIDO:
            `position:absolute;top:50%;z-index:10;white-space:nowrap`); el de ADENTRO (`trackRef`)
            desplaza por TIEMPO, continuo, independiente del scroll. Decorativo (el nombre accesible
            vive en el `aria-label` de la sección, como `Marquesina.tsx`); el texto se repite dos
            veces para el efecto de cinta continua — trasladar el track la mitad de su ancho total
            (`-50%`) mueve exactamente el ancho de UNA copia, cerrando el loop sin salto. */}
        <motion.div
          aria-hidden="true"
          className="absolute left-0 top-1/2 z-10 whitespace-nowrap font-playfair text-[clamp(3rem,10vw,10rem)] leading-none text-[var(--sf-sobre-banda,white)]"
          style={{ transform: transformVertical, opacity: opacidadTexto }}
        >
          <motion.div
            ref={trackRef}
            className="flex whitespace-nowrap"
            initial={{ x: '0%' }}
            animate={estatico ? { x: '0%' } : { x: ['0%', '-50%'] }}
            transition={estatico ? { duration: 0 } : { duration: duracionTicker, repeat: Infinity, ease: 'linear' }}
          >
            <span className="pr-8">{marquesina.texto} —&nbsp;</span>
            <span className="pr-8">{marquesina.texto} —&nbsp;</span>
          </motion.div>
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

        {/* CUE ANIMADO "DESLIZA" — RONDA 2 (§ el docstring de cabecera): MISMO marcado que
            `HeroMedia.tsx` (data-hero-cue, la línea + el segmento que la recorre + la etiqueta),
            leyendo el MISMO campo `hero.cueDesliza`. Se OMITE en preview (scrollear no significa
            nada en un marco de vista previa); reduced-motion lo congela vía `ReducedMotionProvider`
            (global), sin guard propio. */}
        {hero.cueDesliza && !preview && (
          <div
            data-hero-cue="desliza"
            className="absolute bottom-8 left-4 z-10 flex flex-col items-start gap-3 sm:bottom-10 sm:left-6 lg:bottom-12 lg:left-8 text-[var(--sf-sobre-banda-suave,color-mix(in_oklab,white_70%,transparent))]"
          >
            <div className="relative h-14 w-px overflow-hidden bg-[var(--sf-linea-sobre,white)]/30">
              <motion.span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-1/2 w-full bg-[var(--sf-sobre-banda,white)]"
                animate={{ y: ['-100%', '220%'] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
            <span className="text-xs font-normal uppercase tracking-[0.11em]">Desliza</span>
          </div>
        )}
      </section>
    </div>
  );
}
