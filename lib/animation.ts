"use client";

import { createElement, type ReactNode, type RefObject } from "react";
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
