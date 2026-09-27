"use client";

import { createElement, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { MotionConfig, useScroll, useTransform } from "framer-motion";

// fadeUp — la variante compartida de entrada (opacity 0→1, y 24→0) que usan las
// animaciones de scroll-in del storefront (`whileInView`/`initial+animate` + `variants`).
export const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } };

// ── ACOMODO DE SCROLL — el motor de scroll-scrub, TEMAS-BRANDSTORY-DIRECCION-ARTE-1 ──────────────
//
// La variante `centrada` de brandStory (§ CORTE-BRANDSTORY-COLLAGE-1) dejó escrito en su propio
// comentario que el prototipo resuelve la inclinación/superposición del collage EN FUNCIÓN DEL
// PROGRESO DE SCROLL de la sección (`docs/prototipos/cafeone/js/app.js:183-203`, `FSA.scrub`;
// consumido por el collage en `js/home.js:284-301`) — no de un disparo único —, y que "un motor de
// scroll-scrub propio que este repo no tiene" se aproximaba con una entrada `whileInView`. Esto es
// ese motor, construido sobre `useScroll`+`useTransform` (el mismo paquete de `fadeUp`/
// `ReducedMotionProvider`, NO un listener de scroll propio).
//
// LOS DOS UMBRALES SON MEDIDOS, no inventados: `js/home.js:291` calcula
// `t = clamp((p - 0.15) / 0.5, 0, 1)` para el collage — el acomodo ocurre entre el 15% y el 65% del
// progreso. `UMBRAL_ACOMODO` es esa MISMA ventana.
export const UMBRAL_ACOMODO = { desde: 0.15, hasta: 0.65 } as const;

// `transformAcomodo` reproduce, PURA y sin React, el cálculo por-figura de `js/home.js:290-297`
// (`rot = from[i]*(1-t)`) más el asiento vertical que la aproximación anterior por `whileInView` ya
// usaba (`y: 16 → 0`, ahora scrubbed en vez de disparado una vez, mismo número). Separada del hook
// para poder afirmarla en `node:test` sin navegador — el hook (abajo) no se puede testear por
// render sin jsdom, esta función sí.
//
// `estatico` es el gate de MOVIMIENTO REDUCIDO (y de la vista previa del editor, que tampoco puede
// scrollear de verdad): con `estatico=true` la figura rinde SIEMPRE `'none'` —el collage
// ACOMODADO, quieto y legible—, sin importar `progreso`. Es la garantía de que no hay un estado
// "a medio inclinar" bajo esa preferencia.
export function transformAcomodo(
  rotarInicialDeg: number,
  asientoInicialPx: number,
  progreso: number,
  estatico: boolean,
): string {
  if (estatico) return "none";
  const t = Math.max(0, Math.min(1, progreso));
  const rot = rotarInicialDeg * (1 - t);
  const y = asientoInicialPx * (1 - t);
  return `rotate(${rot.toFixed(2)}deg) translateY(${y.toFixed(2)}px)`;
}

// `useProgresoAcomodo` — el progreso de scroll [0,1] YA acotado a `UMBRAL_ACOMODO`, listo para que
// cada figura derive su propio `transformAcomodo` con `useTransform`. El rango de `useScroll`
// (`["start end", "end start"]`) es el mismo que `FSA.scrub` mide a mano
// (`p = (vh - r.top) / (r.height + vh)`, `js/app.js:190-197`): progreso 0 cuando el target entra
// por el borde inferior del viewport, 1 cuando termina de salir por el superior.
export function useProgresoAcomodo(target: RefObject<HTMLElement | null>) {
  const { scrollYProgress } = useScroll({ target, offset: ["start end", "end start"] });
  return useTransform(scrollYProgress, [UMBRAL_ACOMODO.desde, UMBRAL_ACOMODO.hasta], [0, 1], { clamp: true });
}

// ── EL LOOP DE LA MARQUESINA — texto y tarjeta scrubbed por scroll, § MARQUESINA-BANDA-1 ──────────
//
// El prototipo (`docs/prototipos/cafeone/js/home.js:259-282`) mueve DOS piezas con el MISMO
// progreso crudo de scroll de la sección `.marquee` (`FSA.scrub(marquee, fn)`, sin la ventana
// [0.15,0.65] que `UMBRAL_ACOMODO` recorta para el collage de brandStory — acá el `p` que cada
// callback recibe es el CRUDO 0..1 de `js/app.js:190-197`, sin mapear):
//   · el TEXTO en loop se traslada horizontalmente: `travel = innerWidth*1.6`,
//     `track.style.transform = translate(-p*travel, -50%)` (`js/home.js:269-271`);
//   · la TARJETA flotante escala y rota, con su PROPIO recorte interno del mismo `p`:
//     `t = clamp((p-0.12)/0.45, 0, 1)`, `scale = 0.85+0.15*t`, `rot = -4+4*t` (`js/home.js:274-279`).
//
// `useProgresoScroll` es el progreso CRUDO —gemelo de `useProgresoAcomodo` pero SIN el mapeo a
// `UMBRAL_ACOMODO`—, mismo `useScroll`/offset, ninguna instancia nueva del motor.
export function useProgresoScroll(target: RefObject<HTMLElement | null>) {
  const { scrollYProgress } = useScroll({ target, offset: ["start end", "end start"] });
  return scrollYProgress;
}

// `transformMarquesinaTexto` reproduce, PURA y sin React, `js/home.js:269-271`. `estatico` (§ el
// mismo gate que `transformAcomodo`: `prefers-reduced-motion` o la vista previa del editor) deja el
// texto QUIETO —sin el desplazamiento horizontal, pero centrado verticalmente, legible— en vez de
// congelado a medio camino de un recorrido que nunca avanza.
export function transformMarquesinaTexto(progreso: number, travelPx: number, estatico: boolean): string {
  if (estatico) return "translateY(-50%)";
  const p = Math.max(0, Math.min(1, progreso));
  return `translate(${(-p * travelPx).toFixed(1)}px, -50%)`;
}

// `transformMarquesinaTarjeta` reproduce, PURA y sin React, `js/home.js:274-279`. `estatico` rinde
// el estado YA ACOMODADO de la tarjeta (escala 1, sin rotar) — el mismo criterio que
// `transformAcomodo(…, estatico=true)` devuelve `'none'` en vez del arranque a medio inclinar.
export function transformMarquesinaTarjeta(progreso: number, estatico: boolean): string {
  if (estatico) return "none";
  const p = Math.max(0, Math.min(1, progreso));
  const t = Math.max(0, Math.min(1, (p - 0.12) / 0.45));
  const scale = 0.85 + 0.15 * t;
  const rot = -4 + 4 * t;
  return `scale(${scale.toFixed(3)}) rotate(${rot.toFixed(2)}deg)`;
}

// ── EL PROGRESO DESDE EL TOPE — hermana de `useProgresoScroll`, § CORTE-HERO-STICKY-RONDA-2-1 ─────
//
// EL DEFECTO (reportado por el owner sobre HeroMediaMarquesina.tsx, la variante `sticky` del hero):
// «las letras salen de una, deberían salir apenas alguien empieza a hacer scroll» — al cargar la
// home el marquee ya aparece corrido, como si se hubiera scrolleado un tramo.
//
// LA HIPÓTESIS DEL ORQUESTADOR ERA CORRECTA, CONFIRMADA por derivación cerrada (no por navegador:
// las clases de `HeroMediaMarquesina.tsx` son valores fijos, así que la cuenta es exacta, no una
// suposición). `useProgresoScroll` usa `offset: ["start end", "end start"]`, pensado para un
// elemento que el visitante encuentra MÁS ABAJO de la página (`Marquesina.tsx`, una banda suelta):
// progreso 0 cuando el TOPE del target toca el FONDO del viewport. Verificado contra el propio
// código de framer-motion (`node_modules/framer-motion/dist/es/render/dom/scroll/offsets/{offset,
// edge,inset}.mjs`): con `T` = posición-en-documento del tope del target (`calcInset`, la suma de
// `offsetTop` hasta el contenedor de scroll), `H` = alto del target y `VH` = alto del viewport, el
// ancla de progreso-0 de `"start end"` cae en `scrollY = T - VH` y la de progreso-1 de `"end start"`
// en `scrollY = T + H` — progreso = (scrollY - (T-VH)) / (H+VH).
//
// El wrapper de `HeroMediaMarquesina` es el PRIMER hijo de `<main>` (el `<header>` de `StoreNav` es
// `fixed`, § `components/storefront/layout/StoreNav.tsx:203` — no ocupa flujo) y CORTE (el único
// preset que hoy pide `hero:'sticky'`) también lo pone primero en `orden` (`lib/config/themes.ts`,
// `CORTE.orden`) — así que `T = 0`. Con `H = 100svh + 200vh = 300vh` (§ el docstring de cabecera de
// `HeroMediaMarquesina.tsx`), al cargar (`scrollY = 0`): progreso = (0 - (0-VH)) / (300vh+VH) =
// VH / 400vh = **0.25** — un cuarto del recorrido YA consumido antes de que el visitante scrollee un
// solo píxel. Es EXACTAMENTE la forma del defecto reportado: `transformMarquesinaTexto` traslada el
// texto `-0.25*travelPx` desde el primer render.
//
// LA HERMANA usa `["start start", "end start"]` — MISMO ancla final (`"end start"`, sin tocar: sigue
// siendo el punto en que el wrapper entero terminó de salir por arriba, § el docstring de cabecera),
// sólo cambia el ancla de progreso-0: `"start start"` ancla en `scrollY = T` (targetPoint = T+H*0,
// containerPoint = VH*0 = 0) — el instante en que el TOPE del target alcanza el TOPE del viewport,
// que es el único instante que tiene sentido como "arranque" para un elemento que empieza pineado
// desde el principio del documento. progreso = (scrollY - T) / H — con T=0, progreso=0 EXACTO en
// scrollY=0 (el criterio de aceptación del spec), y progreso=1 en scrollY=H, SIN mover el ancla
// final. NO SE TOCÓ `useProgresoScroll`: la usan también `Marquesina.tsx` y
// `SubscriptionCTALinea.tsx`, bandas de MEDIA página donde "start end"/"end start" es el offset
// correcto (el target SÍ entra desde abajo del viewport); cambiarla ahí habría arreglado un
// consumidor rompiendo dos.
//
// `progresoDesdeTope` es la MISMA fórmula, pura y SIN React —dado `rectTop` (el
// `getBoundingClientRect().top` del target, es decir `T - scrollY`) y `alturaTotal` (`H`)—, para
// poder afirmar la derivación en `node:test` sin DOM: progreso = (scrollY-T)/H = -rectTop/H. Nótese
// que el alto del VIEWPORT no aparece en la fórmula —se cancela porque las dos anclas usan
// `containerPoint` en el mismo extremo (0, "start")—, a diferencia de la fórmula vieja
// (`p = (vh - r.top)/(r.height+vh)`, § `useProgresoAcomodo`) que sí lo necesita. El hook no LLAMA a
// esta función (framer-motion mide el DOM real por su cuenta); es la prueba, no la implementación.
export function progresoDesdeTope(rectTop: number, alturaTotal: number): number {
  if (alturaTotal <= 0) return 0;
  const p = -rectTop / alturaTotal;
  return Math.max(0, Math.min(1, p));
}

export function useProgresoScrollDesdeTope(target: RefObject<HTMLElement | null>) {
  const { scrollYProgress } = useScroll({ target, offset: ["start start", "end start"] });
  return scrollYProgress;
}

// EL VELO ANIMADO — antes un overlay SIEMPRE-ENCENDIDO en `--sf-velo` (decisión explícita de
// `MUESTRARIO-HERO-MARQUESINA-STICKY-1`, "reusá el motor de scroll... no repliques la curva exacta
// del tema real"); el owner reportó, sobre el prototipo aplicado, que "oscurece mucho... se ve
// opaca la página". El tema real anima la opacidad del velo con el MISMO progreso de scroll (§ el
// docstring de cabecera de `HeroMediaMarquesina.tsx`) — esta función sigue esa DIRECCIÓN (casi
// transparente en reposo, densa al final del recorrido), no la curva exacta (el spec no la pide).
//
// EL COLOR SIGUE SALIENDO DEL TOKEN `--sf-velo` (NUNCA un rgba horneado): lo que anima es la
// opacidad DEL ELEMENTO (el `opacity` CSS del `<div>` que ya tiene `background-color:
// var(--sf-velo)`), una SEGUNDA capa de alfa que multiplica al 80% que el token ya hornea
// (`color-mix(in oklab, var(--sf-tinta) 80%, transparent)`, § `app/globals.css`) — el token no se
// toca ni se separa en un segundo color.
//
// `VELO_OPACIDAD_PISO` es el PISO medido, no un número a ojo: contraste WCAG (blanco sobre el velo,
// las MISMAS tres fotos claras de referencia que `HeroMedia.tsx` ya usa — arena rgb(232,222,200),
// casi-blanco rgb(245,245,240), crema rgb(238,230,214)) con densidad efectiva = piso × 0.80 (el
// 80% horneado en el token). En reposo (progreso=0, densidad = 0.75×0.80 = 0.60): 5.98:1 (arena) ·
// **5.25:1 (casi-blanco, el peor caso)** · 5.70:1 (crema) — los tres sobre el piso AA (4.5:1) que
// `HeroMedia.tsx` ya acepta para el mismo texto. 0.70 ya alcanzaba el piso (4.60:1 contra
// casi-blanco) pero sin margen (una fuente de video más clara lo tumbaría); 0.75 deja margen real
// sin volver al velo denso. Al final del recorrido (progreso=1) la densidad vuelve a 0.80 — la
// MISMA de hoy, byte-idéntica en contraste (9.61–11.33:1 contra las tres fotos, § `HeroMedia.tsx`).
export const VELO_OPACIDAD_PISO = 0.75;

// `estatico` (reduced-motion o vista previa) NO puede quedar en el piso semitransparente: no hay
// scroll que lo densifique, así que el texto quedaría permanentemente sobre el velo MÁS DÉBIL en
// vez del más seguro. Rinde la densidad de HOY (1 → efectiva 0.80, la que ya pasaba AA con margen
// amplio en las tres fotos de referencia) — la misma decisión que `transformAcomodo`/
// `transformMarquesinaTarjeta` ya toman: `estatico` gana con el estado FINAL, no un punto intermedio.
export function veloOpacidad(progreso: number, estatico: boolean): number {
  if (estatico) return 1;
  const p = Math.max(0, Math.min(1, progreso));
  return VELO_OPACIDAD_PISO + (1 - VELO_OPACIDAD_PISO) * p;
}

// EL VELO SE VUELVE OPT-IN — § CORTE-HERO-VELO-OFF-Y-TICKER-1 (2026-09-27): esta función SIGUE
// existiendo, sin cambios — la usa cualquier tema con `hero.veloVisible:true` (el default, § el
// docstring de `HeroContent.veloVisible`, site-content-defaults.ts). Lo que cambió es que
// `HeroMediaMarquesina.tsx` ahora puede NO MONTAR el `<motion.div>` del velo en absoluto. El owner,
// sobre el prototipo aplicado: «ese velo verde debemos quitarlo, hace que el video se vea sin
// calidad» — CORTE apaga el toggle (`heroVeloVisible:false`, § themes.ts).
//
// EL CONTRASTE SIN VELO, MEDIDO (no supuesto) contra las MISMAS tres fotos de referencia de arriba
// (blanco `var(--sf-sobre-banda,white)` sobre arena `rgb(232,222,200)`, casi-blanco
// `rgb(245,245,240)`, crema `rgb(238,230,214)`): **1.34:1 · 1.09:1 · 1.24:1** — muy por debajo del
// piso AA (4.5:1) que el velo, encendido, garantizaba incluso en su punto más débil (5.25:1, § arriba).
// Por eso el velo NO se reintroduce para CORTE pese a este número: las tres fotos son un proxy
// CONSERVADOR para un video CLARO (el mismo criterio que ya fundaba `VELO_OPACIDAD_PISO`), no una
// medición del video REAL de CORTE, que es oscuro (§ el comentario de `navTinta` en `themes.ts`: "es
// oscuro y uniforme, sin esquema asignado a 'hero'") — sobre un fondo oscuro, blanco sin velo SÍ
// contrasta. **LA PALANCA DE CONTRASTE PASA A SER EL VIDEO, no el velo**: un tema futuro con un video
// CLARO no puede simplemente copiar `heroVeloVisible:false` de CORTE — necesita su propio velo
// encendido (el default `true` de la sección), o medir su propio video antes de apagarlo.

// ── EL REVELADO DEL TEXTO — CORTE-HERO-MARQUEE-REVELA-1 ───────────────────────────────────────────
//
// EL PEDIDO DEL OWNER, LITERAL, sobre el muestrario de RONDA 2 (arriba) ya aplicado: «el marquee no
// debe salir inicialmente, inicialmente solo el video del hero. Las letras van saliendo hacia arriba,
// en una transición smooth, cuando alguien empiece a hacer scroll». Hasta esta ronda el texto del
// loop era SIEMPRE visible desde `progreso=0` —sólo con desplazamiento horizontal 0px, nunca
// invisible ni entrando—, que es el defecto que esta sección cierra.
//
// REUSA LA GRAMÁTICA DE `fadeUp` (cabecera de este archivo: `opacity 0→1`, `y 24→0`) — la MISMA que
// usan las ~21 animaciones de entrada del storefront (§ `ReducedMotionProvider`) — pero SCRUBBED por
// el progreso de scroll, el mismo tratamiento que `transformAcomodo` ya da a rotate/translateY (un
// `1-t` continuo en vez de un trigger de `whileInView` disparado una vez). No se inventa un
// desplazamiento nuevo: `fadeUp.hidden.y` (24px) es el que ya usa toda la home.
//
// `UMBRAL_REVELADO_TEXTO` acota la ventana a la parte TEMPRANA del progreso — el pedido es "cuando
// alguien EMPIECE a scrollear", no a lo largo de las tres pantallas del recorrido pineado completo.
// Fuera de esta ventana (progreso ≥ 0.2) el texto ya está en su posición final y el resto del
// recorrido lo ocupan el desplazamiento horizontal CONTINUO (`transformMarquesinaTexto`, sobre TODO
// el rango 0..1) y la tarjeta (`transformMarquesinaTarjeta`, recortada a [0.12,0.57]).
export const UMBRAL_REVELADO_TEXTO = { desde: 0, hasta: 0.2 } as const;

function progresoRevelado(progreso: number): number {
  const p = Math.max(0, Math.min(1, progreso));
  const { desde, hasta } = UMBRAL_REVELADO_TEXTO;
  return Math.max(0, Math.min(1, (p - desde) / (hasta - desde)));
}

// `opacidadRevelado`: 0 en reposo —el pedido "inicialmente sólo el video del hero", sin el marquee
// visible— y 1 al completar la ventana. `estatico` (reduced-motion/preview, el MISMO gate que
// `veloOpacidad`/`transformAcomodo`) NUNCA puede dejar el texto invisible: un gate de movimiento
// apaga el DESPLAZAMIENTO, no el CONTENIDO — así que rinde 1 siempre, el estado FINAL, igual que
// `veloOpacidad(…, estatico=true)` rinde la densidad final y `transformAcomodo(…, estatico=true)`
// rinde `'none'` (el acomodo ya hecho) en vez del punto de partida.
export function opacidadRevelado(progreso: number, estatico: boolean): number {
  if (estatico) return 1;
  return progresoRevelado(progreso);
}

// `translateYRevelado`: el desplazamiento en px que se SUMA (nunca reemplaza) al `translateY(-50%)`
// de centrado vertical que ya trae `transformMarquesinaTexto` — dos funciones `translate()`
// sucesivas en un mismo `transform` CSS se combinan por SUMA, así que agregar `translateY(Npx)` al
// final de la cadena desplaza N px ADEMÁS del centrado, sin tocar esa función (compartida con
// `Marquesina.tsx`, fuera de `touches:` de este slice: tocarla habría arreglado este consumidor
// rompiendo el otro, que no necesita ningún revelado). `estatico` rinde 0 — el texto queda en su
// posición final y centrado, nunca a medio camino de una entrada que no va a completarse por scroll.
export function translateYRevelado(progreso: number, estatico: boolean): number {
  if (estatico) return 0;
  return fadeUp.hidden.y * (1 - progresoRevelado(progreso));
}

// ── EL PRESUPUESTO DE SCROLL, PROPORCIONAL A LO QUE HAY PARA MOSTRAR — CORTE-HERO-MARQUEE-REVELA-1 ─
//
// EL TRAMO MUERTO REPORTADO POR EL OWNER («por más que haga scroll demoro en bajar mucho esa
// sección... ahora mismo parece un bug») — MEDIDO, no asumido (§ el spec pedía medirlo antes de
// aceptarlo): `GET https://coffee-template-app-onix.vercel.app/api/catalog` devuelve `[]` — el
// catálogo del muestrario desplegado está VACÍO — y el HTML servido de la sección pineada (entre
// `min-h-[calc(100svh+200vh)]` y su `</section>` de cierre) no contiene el marcado de la tarjeta
// (`aspect-[3/4]`): la página tiene 8 apariciones de esa clase y las 8 caen en Presentaciones/
// BrandStory, CERO dentro de la sección del hero. La hipótesis del spec queda CONFIRMADA por
// ejecución: sin producto que pinear (hide-on-empty, § el docstring de cabecera de
// `HeroMediaMarquesina.tsx`), el ancestro seguía reservando el MISMO presupuesto de 200vh que la
// ventana [0.12,0.57] de `transformMarquesinaTarjeta` necesita para animar una tarjeta que nunca
// aparece — 135vh de scroll (0.45 × 300vh) dedicados a una animación sin nada que mostrar.
//
// `claseAlturaAncestroMarquesina` deriva la altura del mismo hecho que ya decide si la tarjeta se
// muestra (`producto`, hide-on-empty): CON tarjeta, el presupuesto de SIEMPRE (100svh + 200vh,
// medido contra `<xo-parallax class="h:300vh">`, § el docstring de cabecera de
// `HeroMediaMarquesina.tsx`). SIN tarjeta, se le resta EXACTAMENTE la porción que esa ventana ocupaba
// (135vh = 0.45×300vh, la misma ventana [0.12,0.57] de `transformMarquesinaTarjeta`) — lo que queda
// (65vh) alcanza para el reveal temprano del texto (§ `UMBRAL_REVELADO_TEXTO`, arriba) y el arrastre
// continuo del texto/velo, sin arrastrar un tramo que no tiene contenido nuevo que mostrar.
//
// LOOKUP POR LITERAL, NO INTERPOLACIÓN — mismo criterio que `gridColsPresentaciones`
// (`lib/storefront/presentaciones.ts`): Tailwind escanea el TEXTO de los archivos buscando
// substrings de clase COMPLETOS; una clase construida por template literal
// (`` `min-h-[calc(100svh+${n}vh)]` ``) es invisible para el JIT porque el número nunca queda escrito
// literal en el archivo fuente. Las dos ramas son strings completos, ambas presentes en este archivo.
export function claseAlturaAncestroMarquesina(tieneTarjeta: boolean): string {
  return tieneTarjeta ? 'min-h-[calc(100svh+200vh)]' : 'min-h-[calc(100svh+65vh)]';
}

// ── EL TICKER HORIZONTAL — por TIEMPO, no por scroll, § CORTE-HERO-VELO-OFF-Y-TICKER-1 ─────────────
//
// EL PEDIDO DEL OWNER, LITERAL, sobre el gate del prototipo aplicado (2026-09-27): «las letras
// empiezan a salir desde abajo, pero están continuamente desplazándose horizontalmente, como un
// aviso, no estático, cuando salen completas es que ya se empieza a navegar hacia abajo». Hasta este
// slice el desplazamiento HORIZONTAL de `HeroMediaMarquesina` estaba LIGADO al scroll
// (`transformMarquesinaTexto`, arriba) — la decisión EXPLÍCITA del spec original de `MUESTRARIO-HERO-
// MARQUESINA-STICKY-1` ("reusá el motor de scroll de `lib/animation.ts`… no agregues librería"), que
// el owner acaba de revertir con el tema real en la mano: es exactamente lo que ese spec prohibió
// reproducir. Esta sección es el reemplazo — `transformMarquesinaTexto` NO SE TOCA (sigue gobernando
// la X de `Marquesina.tsx`, la banda suelta, que también scrubea por scroll y no cambia con este
// slice); `HeroMediaMarquesina.tsx` deja de llamarla.
//
// EL EJE VERTICAL (el revelado, § `UMBRAL_REVELADO_TEXTO` arriba) SIGUE siendo por SCROLL — son DOS
// EJES, DOS MOTORES, compuestos en DOS ELEMENTOS `motion.*` distintos dentro del componente (el de
// afuera centra/revela por scroll; el de adentro, con las dos copias del texto, corre el ticker por
// tiempo) — nunca un solo `transform` armado a mano con las dos piezas concatenadas, que es como
// vivía antes (`translate(x,-50%) translateY(dy)`).
//
// MEDIDO CONTRA EL JS DEL TEMA REAL, NO SU DOCUMENTACIÓN (el spec lo pide explícito): se leyó
// `xo-webcomponents.min.js` servido por `x-cafeone.myshopify.com/cdn/shop/t/5/assets/`
// (`node --eval "fetch(...)"`, no un navegador). La clase que registra `Names.Marquee = "xo-marquee"`
// calcula la duración de la animación CSS de cada ítem en su método `setDuration()`:
//   `u = this.children[0].offsetWidth` — el ancho de UN ítem del track, en px.
//   `h = clamp(u*nd - (xoSpeed-1)*u, u, Infinity)`, con `nd = 14` (constante del bundle).
// El HTML servido (`GET /`, la sección `hero_banner_marquee`) trae
// `<xo-marquee xo-speed="1" xo-direction="ltr">` — SIN el atributo `xo-pause-on-hover`, así que cae
// al default de la clase (`xoPauseOnHover: false`): NO pausa al pasar el cursor, y esta variante
// tampoco lo implementa. Con `xoSpeed = 1`: `h = u*(14-0) = 14u` ms — la duración escala LINEAL con
// el ancho del ítem, así que la VELOCIDAD EFECTIVA (distancia/tiempo) es CONSTANTE, independiente del
// largo del texto: `u / (14u ms) = 1/14 px/ms = 1000/14 px/s ≈ 71.43 px/s`. Y
// `xo-direction="ltr"` mapea a `--xo-marquee-to:"-100%"` (la rama `"rtl"/"btt"` no aplica) — el
// mismo sentido NEGATIVO en X que ya tenía `transformMarquesinaTexto`, así que el sentido del
// desplazamiento no cambia con este slice.
export const VELOCIDAD_TICKER_PX_S = 1000 / 14;

// `duracionTickerS` — PURA, sin React: dado el ancho medido de UNA COPIA del texto (px, el ancho de
// UNO de los dos `<span>` duplicados) y la velocidad objetivo (px/s), la duración (segundos) de un
// ciclo `x: 0% → -50%` sobre un track con DOS copias idénticas. Trasladar el track la MITAD de su
// ancho total (`-50%`) mueve exactamente el ancho de UNA copia — el punto donde la segunda copia ya
// ocupa la posición inicial de la primera, cerrando el loop sin salto visible en la costura ("cuando
// la primera copia sale, la segunda ya viene", § el spec). `0` con un ancho o una velocidad no
// positivos (SSR, o antes de la primera medición del DOM) — el llamador cae a un fallback en vez de
// animar con `NaN`/`Infinity`.
export function duracionTickerS(anchoUnaCopiaPx: number, velocidadPxS: number): number {
  if (anchoUnaCopiaPx <= 0 || velocidadPxS <= 0) return 0;
  return anchoUnaCopiaPx / velocidadPxS;
}

// Fallback ANTES de la primera medición del DOM — mismo papel que `TRAVEL_FALLBACK_PX`
// (`HeroMediaMarquesina.tsx`): un texto de ancho típico (~800px) a la velocidad medida arriba. Se
// sobrescribe en el primer `useEffect` del componente, así que nunca se ve en pantalla — la
// animación del ticker arranca recién al montar en el cliente, con la medición real ya disponible.
export const DURACION_TICKER_FALLBACK_S = 800 / VELOCIDAD_TICKER_PX_S;

// ── EL CONTADOR — el count-up de la banda ORIGEN, § ORIGEN-BANDA-1 ───────────────────────────────
//
// El prototipo (`docs/prototipos/cafeone/js/home.js:311-332`) anima sus tres estadísticas
// ("1.600 msnm promedio", "12 hectáreas sembradas", "52 años de tradición") con un IntersectionObserver
// que dispara UNA vez al 40% visible y un loop de `requestAnimationFrame` de 1100ms con ease-out
// cúbica. Medido: ORIGEN-BANDA-CENSO-1 — el repo no tenía precedente de esto (cero
// `requestAnimationFrame`/CountUp antes de este slice).
export const DURACION_CONTADOR_MS = 1100;

// `valorContador` reproduce, PURA y sin React, el cálculo de `js/home.js:320-327`
// (`k = min(1,(now-t0)/dur)`, `eased = 1-(1-k)^3`, valor = destino*eased). Separada del hook por el
// MISMO criterio que `transformAcomodo`: poder testearla en `node:test` sin navegador.
export function valorContador(destino: number, progreso: number): number {
  const k = Math.max(0, Math.min(1, progreso));
  const eased = 1 - Math.pow(1 - k, 3);
  return destino * eased;
}

export interface ContadorAnimado {
  ref: RefObject<HTMLElement | null>;
  valor: number;
}

// `useContadorAnimado` — monta `valorContador` sobre un IntersectionObserver (dispara UNA vez, al
// 40% visible, como el prototipo) + un loop de rAF sobre `DURACION_CONTADOR_MS`.
//
// `estatico` es el GATE ÚNICO, decidido por el llamador — MISMO criterio que `estatico` de
// `transformAcomodo`/`BrandStoryCentrada` (`preview || !!useReducedMotion()`): con `estatico=true`
// el valor nace YA en `destino`, sin observer ni rAF. Dos razones lo piden, ninguna nueva en este
// repo: `prefers-reduced-motion` (ni "a medio contar" bajo esa preferencia, un número que salta de
// golpe a su valor final ya ES la lectura correcta — no hay equivalente a "acomodado y quieto" para
// un contador, el número simplemente no cuenta), y la VISTA PREVIA del editor de `/admin/tienda`
// (`useIsPreview`, el patrón que `BrandStory`/`GrindChooser`/`Spotlight` ya siguen): dentro de
// `EscalaDesktop` (`transform:scale`) un `IntersectionObserver` puede no disparar — medido:
// ORIGEN-BANDA-CENSO-1 —, así que el preview no puede depender de él para mostrar un número.
export function useContadorAnimado(destino: number, estatico: boolean): ContadorAnimado {
  const ref = useRef<HTMLElement | null>(null);
  const [valor, setValor] = useState(estatico ? destino : 0);
  const disparado = useRef(false);

  useEffect(() => {
    if (estatico) {
      setValor(destino);
      return;
    }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setValor(destino);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || disparado.current) return;
          disparado.current = true;
          io.unobserve(entry.target);
          const t0 = performance.now();
          const paso = (now: number) => {
            const progreso = (now - t0) / DURACION_CONTADOR_MS;
            setValor(valorContador(destino, progreso));
            if (progreso < 1) requestAnimationFrame(paso);
          };
          requestAnimationFrame(paso);
        });
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destino, estatico]);

  return { ref, valor };
}

// ── EL ÍNDICE CENTRADO DE UN RIEL — item resaltado en scroll horizontal, MUESTRARIO-RIEL-ACTIVO-1 ──
//
// El prototipo resalta la tarjeta CENTRADA del riel de Presentaciones (`.pres-card.is-active`,
// `docs/prototipos/cafeone/js/home.js:113-125`, `centreIndex()`/`markActive()`): sobre el MISMO
// scroll horizontal que ya desplaza el riel, busca qué hijo tiene su centro más cerca del centro
// visible del contenedor, y alterna una clase. Esa capacidad NO tenía dónde vivir:
// `useProgresoScroll`/`useProgresoAcomodo` (arriba) miden el progreso de una SECCIÓN contra el
// VIEWPORT (`useScroll` de framer-motion, con `offset: ["start end", "end start"]"`), no la
// posición de un ITEM dentro de un contenedor con `overflow-x` PROPIO — son ejes distintos
// (vertical-de-página vs horizontal-de-riel) y `useScroll` no resuelve el segundo sin un target por
// item, que es justo la "segunda fuente de estado" que `GrindChooserRiel.tsx` descartaba antes de
// este slice por no tener dónde construirse sin duplicar el scroll.
//
// `indiceCentrado` reproduce, PURA y sin React, el cálculo de `centreIndex()`: dado el
// `scrollLeft`/`clientWidth` del contenedor y la geometría (`offsetLeft`/`offsetWidth`) de sus hijos
// DIRECTOS, devuelve el índice cuyo centro está más cerca del centro visible. `null` con cero
// hijos — sin item no hay "centrado", y forzar un 0 mentiría (el hijo 0 no existe). Separada del
// hook por el MISMO criterio que `transformAcomodo`/`valorContador`: poder testearla en `node:test`
// sin navegador.
export function indiceCentrado(
  scrollLeft: number,
  clientWidth: number,
  hijos: readonly { offsetLeft: number; offsetWidth: number }[],
): number | null {
  if (hijos.length === 0) return null;
  const medio = scrollLeft + clientWidth / 2;
  let mejor = 0;
  let mejorDistancia = Infinity;
  hijos.forEach((hijo, i) => {
    const distancia = Math.abs(hijo.offsetLeft + hijo.offsetWidth / 2 - medio);
    if (distancia < mejorDistancia) {
      mejorDistancia = distancia;
      mejor = i;
    }
  });
  return mejor;
}

// `useIndiceCentrado` — monta `indiceCentrado` sobre el scroll REAL del contenedor: lee
// `scrollLeft`/`clientWidth` del propio `target` y `offsetLeft`/`offsetWidth` de sus HIJOS DIRECTOS
// (`target.children`) en cada evento de scroll y en cada resize — la MISMA fuente que ya desplaza
// el riel (`track.scrollBy`/el `overflow-x-auto` nativo en `GrindChooserRiel.tsx`), nunca un índice
// paralelo. Es DERIVADO, no un estado que alguien más tenga que mantener sincronizado.
//
// Throttled a UN `requestAnimationFrame` por ráfaga de eventos de scroll — el mismo patrón que
// `js/home.js:137-139` (`rail.addEventListener('scroll', () => requestAnimationFrame(markActive))`):
// medir la geometría de cada hijo en CADA evento de scroll (que dispara docenas de veces por
// segundo durante un gesto) es el costo que el comentario retirado de `GrindChooserRiel.tsx` seguía
// señalando; con el throttle, a lo sumo una medición por frame pintado.
//
// `null` mientras no hay `target` montado o mientras no corrió la primera medición (SSR) — el mismo
// "estado seguro, nada prometido todavía" que ya usan `puedeAtras`/`puedeAdelante` en el consumidor:
// no resalta ninguna tarjeta hasta saber cuál está centrada de verdad.
export function useIndiceCentrado(target: RefObject<HTMLElement | null>, cuenta: number): number | null {
  const [indice, setIndice] = useState<number | null>(null);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    const el = target.current;
    if (!el) return;
    function medir() {
      rafId.current = null;
      const t = target.current;
      if (!t) return;
      const hijos = Array.from(t.children) as HTMLElement[];
      setIndice(indiceCentrado(t.scrollLeft, t.clientWidth, hijos));
    }
    function alScrollear() {
      if (rafId.current !== null) return;
      rafId.current = requestAnimationFrame(medir);
    }
    medir();
    el.addEventListener("scroll", alScrollear, { passive: true });
    window.addEventListener("resize", medir);
    return () => {
      el.removeEventListener("scroll", alScrollear);
      window.removeEventListener("resize", medir);
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    };
    // Recalcula si cambia la CUENTA de hijos (borrador del editor agregando/quitando una tarjeta):
    // el ancho del riel puede cambiar sin que el usuario haya scrolleado todavía — mismo motivo que
    // el `[tarjetas.length]` del efecto de `puedeAtras`/`puedeAdelante` en `GrindChooserRiel.tsx`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuenta]);

  return indice;
}

// ── LA DIRECCIÓN DEL SCROLL DEL NAV — CROMO-NAV-DIRECCION-SCROLL-1 ────────────────────────────────
//
// EL PEDIDO DEL OWNER, LITERAL: «el nav debe aparecer/cambiar de color cuando alguien empiece a hacer
// scroll hacia arriba. De hecho en CAFEONE cuando alguien hace scroll hacia abajo el nav de la página
// se oculta». Es un eje del TEMA — sólo CORTE lo declara (§ `NavTratamientoContent.direccion`,
// `site-content-defaults.ts`); todo otro preset, Nayoli incluida, conserva el nav de HOY byte a byte.
//
// MEDIDO CONTRA EL TEMA REAL (`https://x-cafeone.myshopify.com/`, fetched 2026-09-27), NO el
// prototipo local: el prototipo capturado (`docs/prototipos/cafeone/js/app.js:275-286`,
// `initHeader()`) sólo alterna `.is-solid` con `window.scrollY > 80` — NO oculta nada por dirección;
// el prototipo no cubre este comportamiento. El sitio real corre un theme de Shopify OS 2.0 con el
// web component `xo-sticky` (`.../cdn/shop/t/5/assets/xo-webcomponents.min.js`, la clase que define
// `handleStickyTop`), cuyo default es `xoDirection:"up"`:
//   - `c = window.scrollY < this.prevScrollY` — la dirección se recalcula en CADA frame de scroll,
//     comparando sólo contra el frame anterior. SIN mínimo de movimiento: la única guarda que corre
//     antes es `window.scrollY !== this.prevScrollY`, que no filtra por magnitud — 1px hacia arriba
//     ya cuenta como "subiendo". No hay debounce que inventar: el tema real no lo tiene.
//   - el hide/reveal por dirección SÓLO se activa una vez que el scroll pasó la altura PROPIA del
//     header (`e < i - t`, con `t` = alto del header e `i` = 0 para un header suelto sin otros
//     `xo-sticky` apilados encima) — bajo ese umbral el header queda SIEMPRE en su posición normal,
//     visible, sin importar la dirección: es el "arriba del todo manda el tratamiento de hoy" del
//     spec.
//   - SUBIENDO, sobre el umbral: `translate3d(0,0,0)` (visible) de inmediato, sin esperar a volver a
//     cruzar ningún otro punto. BAJANDO, sobre el umbral: `translateY(-(t+i))` (oculto, corrido su
//     propia altura hacia arriba).
//
// `UMBRAL_OCULTAR_NAV` traduce ese umbral medido (la altura del header) a un número fijo: 80px — el
// MISMO valor que ya usa `initHeader()` del prototipo local para su propio corte sólido/transparente
// (`window.scrollY > 80`, arriba), lo que da confianza de que aproxima bien la altura real de este
// header. Se mantiene SEPARADO del umbral de 20px que ya gobierna `scrolled` en `StoreNav.tsx` (el
// color sólido de HOY) — DELIBERADO, no un descuido: la doctrina de este repo (§ CLAUDE.md, "un
// umbral que gobierna DOS comportamientos distintos es la FORMA del bug") pide un número nombrado
// por pregunta, no reciclar uno. Y como 80 > 20, para cuando el nav puede empezar a ocultarse YA
// está en su tratamiento sólido (`scrolled` ya es `true`) — "cambia de tratamiento" (el pedido del
// owner, resuelto "con el sistema de tratamiento que ya existe") sale GRATIS de reusar `scrolled`,
// sin inventar un color literal nuevo.
export const UMBRAL_OCULTAR_NAV = 80;

export type DireccionScroll = 'arriba' | 'abajo';

/** `direccionScroll` — pura, sin DOM: dado el scrollY actual y el del frame de scroll anterior, la
 *  dirección. SIN mínimo de movimiento (medido contra el tema real, arriba): 1px de diferencia ya
 *  cuenta — replica `window.scrollY < this.prevScrollY` del web component real. Un empate (mismo
 *  valor, p. ej. el primer frame) cae a `'abajo'`: no hay evidencia de que el visitante haya subido. */
export function direccionScroll(scrollYActual: number, scrollYAnterior: number): DireccionScroll {
  return scrollYActual < scrollYAnterior ? 'arriba' : 'abajo';
}

/** `navOculto` — ¿debe el encabezado traducirse fuera de vista? `false` SIEMPRE bajo
 *  `UMBRAL_OCULTAR_NAV` (el "arriba del todo" del spec — replica el `e >= i` del tema real: cerca
 *  del tope, sin sticky, sin ocultar, sin importar la dirección). Sobre el umbral, oculta BAJANDO y
 *  muestra SUBIENDO — el mismo `xoDirection:"up"` medido arriba. NO decide sola: el llamador
 *  (`StoreNav.tsx`) además fuerza `false` si el foco del teclado está dentro del nav, o si el drawer
 *  móvil/la búsqueda/el panel desplegable están abiertos — esta función sólo conoce el scroll, no el
 *  resto del estado de la UI (§ el docstring de `StoreNav.tsx` para el porqué de cada gate). */
export function navOculto(scrollY: number, direccion: DireccionScroll): boolean {
  return scrollY >= UMBRAL_OCULTAR_NAV && direccion === 'abajo';
}

// ReducedMotionProvider — STOREFRONT-REDUCED-MOTION-1 (2026-09-12).
//
// EL DEFECTO: las ~21 animaciones de entrada del storefront (censadas en
// TEMAS-P4-MOVIMIENTO-CENSO-1) ignoraban `prefers-reduced-motion`. Se verificaron
// las DOS piezas que parecían cubrirlo y NINGUNA lo hacía:
//   - el guard global de `app/globals.css:247` neutraliza `animation-duration` y
//     `transition-duration` de CSS — framer-motion no anima por ahí, escribe estilos
//     inline vía WAAPI/motion values, así que ese guard lo esquiva por construcción.
//   - `NosotrosGaleria.tsx:31` ya usa `useReducedMotion()`, pero para decidir si
//     REPRODUCE UN VIDEO, no para apagar una animación de entrada — es precedente del
//     HOOK, no de la guarda que faltaba.
//
// LA SALIDA, medida antes de tocar los 12 archivos censados: `<MotionConfig
// reducedMotion="user">` (framer-motion ^12.38.0, instalado 12.40.0). Leído en
// `node_modules/motion-dom/dist/cjs/index.js`: con la preferencia del sistema activa,
// TODA animación de un componente `motion.*` que toque un valor de TRANSFORM (x, y,
// scale, rotate — `positionalKeys`) se fija al target EN EL ACTO (`{ type: false }` →
// `makeAnimationInstant`); los valores que NO son transform (opacity, color…) siguen
// animando con su transición normal. Para `fadeUp` eso es EXACTAMENTE la semántica
// correcta — "aparece sin desplazarse", no "no aparece": el `y: 24 → 0` salta, el
// `opacity: 0 → 1` sigue su fade.
//
// Es el MISMO mecanismo (`animateTarget` → `animateMotionValue`) que usan `whileInView`,
// `initial`/`animate` y `AnimatePresence`, así que el bounce en bucle de la flecha del
// hero (`HeroCurtina.tsx`, `animate={{ y: [0,8,0] }}`) también se apaga: `y` es
// transform, y bajo reduced-motion su transición se reemplaza entera —el `repeat:
// Infinity` incluido— por el salto instantáneo.
//
// LO QUE NO CUBRE, para no declarar un remedio total que es parcial:
//   - `staggerChildren`/`delayChildren` es un RETRASO DE PROGRAMACIÓN entre hijos, no
//     un valor animado — MotionConfig no lo toca. Con la preferencia activa, los hijos
//     de una lista con stagger siguen apareciendo en cascada TEMPORAL (uno tras otro),
//     sólo que cada uno funde su opacidad en vez de deslizarse. No es un desplazamiento
//     espacial, pero sigue siendo una secuencia en el tiempo.
//   - Cualquier animación que NO pase por un componente `motion.*` (una transición CSS
//     de Tailwind, un `<video autoplay>`) sigue siendo del guard de `globals.css` o de
//     su propio guard — no de este provider.
//
// Se monta UNA vez en `app/(storefront)/layout.tsx`, envolviendo todo el árbol del
// storefront: cubre los 21 sitios de hoy y cualquier `motion.*` que se agregue después
// sin que ese componente tenga que acordarse de nada.
export function ReducedMotionProvider({ children }: { children: ReactNode }) {
  return createElement(MotionConfig, { reducedMotion: "user" }, children);
}
