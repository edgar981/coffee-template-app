"use client";

import { createElement, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";

// fadeUp — la variante compartida de entrada (opacity 0→1, y 24→0) que usan las
// animaciones de scroll-in del storefront (`whileInView`/`initial+animate` + `variants`).
export const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } };

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
