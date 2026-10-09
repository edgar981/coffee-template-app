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

import { useCallback, useRef, type RefObject } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { useIsPreview } from '../PreviewMode';
import { useModoEditorActivo } from '../ModoEditor';
import { motorDisponible, puedeReproducirUnaVez } from '@/lib/movimiento/catalogo';
import { ANIMACIONES_ESENCIALES } from './animaciones';

gsap.registerPlugin(ScrollTrigger, SplitText);

export interface UseMovimientoOpciones {
  /** `false` (§ MOVIMIENTO-EDITOR-EXPOSICION-1, la vista previa del editor junto al ajuste
   *  «Animación»): el motor NO se auto-dispara por scroll — ni siquiera cuando `preview`/`editando`
   *  son `false`, como en la vista previa aislada del editor, que no está detrás de ninguno de esos
   *  dos contextos pero TAMPOCO debe animarse sola apenas se monta. Sólo corre al llamar
   *  `reproducir()`. Default `true`: el comportamiento de siempre, el de la página real. */
  auto?: boolean;
}

export interface UseMovimientoResultado {
  ref: RefObject<HTMLElement | null>;
  /** `true` sólo si HAY un id con motor, `auto` no está apagado, Y ninguno de los tres gates de
   *  siempre lo frena — lo que `Movimiento.tsx` usa para decidir si monta el wrapper con el ref, o
   *  devuelve los children directo (sin wrapper, byte-idéntico a no tener el eje). */
  activo: boolean;
  /** Reproduce la animación UNA VEZ, ahora mismo — ignora ScrollTrigger (nunca espera a que el
   *  elemento cruce el 82% del viewport) y los gates de editor/preview/`auto` (es una orden
   *  EXPLÍCITA, no el motor automático que esos gates protegen). Sigue respetando
   *  `prefers-reduced-motion`, igual que el camino automático. No-op si el id no tiene motor, o si
   *  su clase no es `revelado` (un `scrub`/hover continuo no tiene "una vez" que reproducir). */
  reproducir: () => void;
}

/** `id` vacío/undefined (= «Ninguna», § `MOVIMIENTO_NINGUNA`) es el caso más común — por eso el
 *  hook se puede llamar SIEMPRE, incondicional, sin que el consumidor tenga que decidir antes. */
export function useMovimiento(id: string | undefined, opciones: UseMovimientoOpciones = {}): UseMovimientoResultado {
  const auto = opciones.auto ?? true;
  const preview = useIsPreview();
  const editando = useModoEditorActivo();
  const ref = useRef<HTMLElement | null>(null);
  const disponible = !!id && motorDisponible(id);
  const activo = auto && disponible && !preview && !editando;

  const { context } = useGSAP(() => {
    if (!activo || !ref.current || !id) return;
    const fn = ANIMACIONES_ESENCIALES[id];
    if (!fn) return;
    const raiz = ref.current;

    // § MOVIMIENTO-SCROLL-UMBRAL-1 — `ScrollTrigger` mide `start:'top 82%'` (§ `alEntrar`,
    // `animaciones.ts`) como un píxel ABSOLUTO contra el documento TAL COMO ESTÁ en el instante en
    // que este efecto corre. Si en ese instante el documento es más CORTO que el real —el
    // storefront sirve el par de fuentes por `<link>`/`@import`, SIN `next/font` (§ DUNA-
    // MOVIMIENTO.md, "Las FUENTES son content.tema.fuentePar"), así que el FOUT puede reflowear el
    // texto de ARRIBA después de este efecto; lo mismo aplica a una imagen que todavía no reservó
    // su alto, o cualquier otro contenido que crezca sin disparar `resize`— ese píxel calculado
    // queda por DEBAJO del scroll actual (típicamente 0, recién cargada la página) y `ScrollTrigger`
    // evalúa el umbral como YA CRUZADO: reproduce el tween ENTERO de inmediato, sin que el
    // visitante haya scrolleado un píxel. Un `ScrollTrigger.refresh()` posterior NO lo corrige:
    // `toggleActions:'play none none none'` no tiene acción de vuelta (`leaveBack:'none'`), así que
    // refrescar sólo vuelve a medir, nunca deshace un "play" que ya corrió — medido con un repro
    // aislado de GSAP/ScrollTrigger sin React (`.scratch/repro-scrolltrigger*.html`, fuera de
    // `touches:`, no comiteado). Lo que SÍ lo corrige es MATAR el tween viejo (`.scrollTrigger.
    // kill()` + `.revert()`, que restaura el estilo al de ANTES de animar) y crear uno NUEVO: el
    // nuevo mide el documento como esté EN ESE momento, así que si el layout ya creció, el umbral
    // vuelve a quedar donde corresponde.
    //
    // El disparador de la re-medición es un `ResizeObserver` sobre `<html>` — agnóstico de la
    // CAUSA (fuente, imagen, contenido async): reacciona al EFECTO (el documento cambió de alto),
    // no a una señal específica. Se apaga en el PRIMER scroll real: el defecto que esto corrige
    // sólo existe ANTES de que el visitante scrollee un píxel — una vez que scrolleó, cualquier
    // "play" ya es una reacción a scroll de verdad, y matar/recrear ahí reabriría un segundo
    // defecto (un salto visible a mitad de una reproducción legítima). Por eso NO es un
    // `document.fonts.ready` con timeout: ESE camino se midió y queda BLOQUEADO indefinidamente si
    // la fuente nunca resuelve (red caída, bloqueador de contenido) — un timeout corto reintroduce
    // el bug justo en la red lenta que más lo necesita, y uno largo demora la primera animación de
    // toda visita. El `ResizeObserver` no depende de red: sólo reacciona si algo realmente cambió.
    // `estado.tween` (no un `let` suelto): TS no sigue la reasignación de un `let` dentro de un
    // closure llamado síncronamente (`crear()` abajo) para efectos de ESTRECHAR su tipo en el
    // código que sigue — con un `let` lo ve `null` para siempre y marca el resto como inalcanzable
    // (`never`). Una propiedad de objeto no tiene ese problema: TS no aplica el mismo análisis de
    // flujo a los miembros de un objeto mutado por asignación simple.
    const estado: { tween: gsap.core.Tween | gsap.core.Timeline | null } = { tween: null };
    const crear = () => {
      // Sólo la rama 'no-preference' se registra (§ el docstring de cabecera, gate 2): con
      // 'reduce' no hay callback que correr, y gsap.matchMedia no inventa uno — `estado.tween`
      // queda `null` y el bloque de abajo no instala el `ResizeObserver` (nada que corregir).
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        estado.tween = fn(raiz, false);
      });
    };
    crear();

    // C02 (hover puro, § `animaciones.ts`) no devuelve tween — nada atado a scroll que corregir,
    // y recrear ahí DUPLICARÍA los listeners de `hoverTarjetas` en cada resize. El resto de la
    // clase `scrub`/`revelado` siempre crea un tween con `scrollTrigger` (§ `alEntrar`).
    if (!estado.tween?.scrollTrigger || typeof ResizeObserver === 'undefined') return;

    let corrigiendo = true;
    const recrear = () => {
      if (!corrigiendo) return;
      // `context.add` reabre el contexto de este `useGSAP` para la llamada SÍNCRONA de abajo
      // (`_context = self` mientras corre, § gsap-core `Context.prototype.add`): sin esto, el
      // tween nuevo —creado dentro del callback del `ResizeObserver`, fuera de la pila síncrona
      // del efecto— quedaría SIN registrar en este contexto, y `context.revert()` al desmontar no
      // lo limpiaría.
      context.add(() => {
        estado.tween?.scrollTrigger?.kill();
        estado.tween?.revert();
        crear();
      });
    };
    const ro = new ResizeObserver(recrear);
    ro.observe(document.documentElement);
    const apagar = () => { corrigiendo = false; ro.disconnect(); };
    window.addEventListener('scroll', apagar, { once: true, passive: true });

    return () => {
      apagar();
      window.removeEventListener('scroll', apagar);
    };
  }, { scope: ref as RefObject<HTMLElement>, dependencies: [activo, id] });

  // § MOVIMIENTO-EDITOR-EXPOSICION-1 — «Ver animación». No depende de `activo`: corre aunque
  // `auto=false` sea justo lo que lo frenó, porque esto es la orden explícita que el apagado
  // automático no cubre. El gate por CLASE (`revelado`) vive acá y no en el llamador (el botón del
  // editor también lo consulta para deshabilitarse, pero el hook es la fuente — dos consultas del
  // MISMO criterio divergirían si una cambiara sin la otra).
  const reproducir = useCallback(() => {
    if (!ref.current || !id) return;
    if (!puedeReproducirUnaVez(id)) return;
    const fn = ANIMACIONES_ESENCIALES[id];
    if (!fn) return;
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      fn(ref.current as HTMLElement, true);
    });
  }, [id]);

  return { ref, activo, reproducir };
}
