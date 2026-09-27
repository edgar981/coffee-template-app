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
