'use client';

// EL HOOK (§ MOVIMIENTO-MARCO-GSAP-1) — decide SI una animación corre y, si corre, la arma con
// `useGSAP` (`@gsap/react`). Tres gates, cualquiera de los tres apaga el motor y deja el contenido
// FINAL tal cual (nunca oculto, § el docstring de `Movimiento.tsx`):
//
//  1. **El editor** (`useIsPreview()` O `useModoEditorActivo()`, § GSAP-MARCO-CENSO-1,
//     "editor-convivencia-dos-señales-de-preview-distintas" — son DOS señales independientes, las
//     DOS apagan): la vista previa en vivo escala con `transform:scale` (`EscalaDesktop.tsx`) y
//     ahí ni `ScrollTrigger` ni un `IntersectionObserver` disparan de forma fiable (posición
//     visual ≠ posición de layout, documentado en `lib/animation.ts:1560-1568` para
//     framer-motion — la MISMA causa aplica a GSAP, § el censo). El modo edición inline tiene el
//     mismo problema de fondo Y, además, el `CampoEditable`/overlay de `EditorPuenteVivo.tsx` mide
//     con `getBoundingClientRect()` SIN listener de scroll — un `ScrollTrigger` con pin desalinearía
//     ese overlay del nodo real en cuanto el visitante siga scrolleando (§ el censo,
//     "editor-convivencia-campoeditable-overlay-sin-listener-de-scroll-riesgo-de-pin"). Las
//     ESENCIALES de este slice no pinean nada, pero el gate es del MOTOR, no por animación: una
//     animación `scrub`/`ticker` futura con pin hereda la misma protección sin que nadie la repita.
//  2. **`prefers-reduced-motion: reduce`** (`gsap.matchMedia`, § abajo): sólo se registra el
//     callback de `'(prefers-reduced-motion: no-preference)'` — sin la rama `reduce`, el
//     navegador en ese modo nunca ejecuta nada de GSAP, y el contenido queda en su posición FINAL
//     por construcción (ningún `gsap.set` oculta nada de entrada; lo oculto, cuando existe, lo
//     pone `gsap.from()` al EJECUTARSE — nunca una clase CSS estática, § `DUNA-MOVIMIENTO.md`,
//     "revelado nunca puede quedar invisible").
//  3. **Sin motor** (`motorDisponible(id)` falso: `id` ausente/«Ninguna», basura, o un id del
//     catálogo sin implementación — § `lib/movimiento/catalogo.ts`): no hay nada que registrar.
//
// REGISTRO DE PLUGINS EN UN SOLO SITIO (nunca en `animaciones.ts`, § su docstring de cabecera):
// `gsap.registerPlugin` es idempotente (GSAP lo ignora si el plugin ya está registrado), así que
// llamarlo en cada montaje de `<Movimiento>` no duplica nada — pero se llama UNA sola vez por
// import de este módulo (nivel de módulo, no dentro del hook) para que el costo sea de PARSEO, no
// de cada render.

import { useRef, type RefObject } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { useIsPreview } from '../PreviewMode';
import { useModoEditorActivo } from '../ModoEditor';
import { motorDisponible } from '@/lib/movimiento/catalogo';
import { ANIMACIONES_ESENCIALES } from './animaciones';

gsap.registerPlugin(ScrollTrigger, SplitText);

export interface UseMovimientoResultado {
  ref: RefObject<HTMLElement | null>;
  /** `true` sólo si HAY un id con motor Y ninguno de los tres gates lo apaga — lo que
   *  `Movimiento.tsx` usa para decidir si monta el wrapper con el ref, o devuelve los children
   *  directo (sin wrapper, byte-idéntico a no tener el eje). */
  activo: boolean;
}

/** `id` vacío/undefined (= «Ninguna», § `MOVIMIENTO_NINGUNA`) es el caso más común — por eso el
 *  hook se puede llamar SIEMPRE, incondicional, sin que el consumidor tenga que decidir antes. */
export function useMovimiento(id: string | undefined): UseMovimientoResultado {
  const preview = useIsPreview();
  const editando = useModoEditorActivo();
  const ref = useRef<HTMLElement | null>(null);
  const disponible = !!id && motorDisponible(id);
  const activo = disponible && !preview && !editando;

  useGSAP(() => {
    if (!activo || !ref.current || !id) return;
    const fn = ANIMACIONES_ESENCIALES[id];
    if (!fn) return;
    // Sólo la rama 'no-preference' se registra (§ el docstring de cabecera, gate 2): con
    // 'reduce' no hay callback que correr, y gsap.matchMedia no inventa uno.
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      fn(ref.current as HTMLElement);
    });
  }, { scope: ref as RefObject<HTMLElement>, dependencies: [activo, id] });

  return { ref, activo };
}
