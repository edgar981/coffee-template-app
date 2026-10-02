// lib/storefront/revelado-bloque.ts — § SECCIONES-ENTRAN-VIVAS-1
//
// EL PEDIDO DEL OWNER (2026-10-01), LITERAL: «revisa homeburgers.com... el ingreso a cada sección se
// siente como vivo; en el demo de las Chamisas o en Onix las secciones tienen los textos estáticos a
// excepción de cuando entramos al origen y suscripción». Y después, aclarando el alcance: «agrega el
// ajuste... a Nayoli, es la página más estática de las 3» y «aplicar la misma entrada a todas no tan
// literal, la entrada que tiene suscripciones y el origen en chamisas y onix está perfecta».
//
// EL DIAGNÓSTICO (medido por el orquestador contra homeburgers.com con Playwright, § el spec de este
// slice): nuestro `fadeUp` (lib/animation.ts) dispara con `whileInView` + `viewport:{once:true}` SIN
// margen — la intersección cuenta apenas UN píxel del bloque asoma por el borde inferior del
// viewport. Para un bloque que entra scrolleando hacia arriba, eso significa que la animación (una
// `duration` corta, sin curva declarada en la mayoría de los casos) YA TERMINÓ antes de que el
// visitante llegue a mirarlo — se ve "ya puesto", nunca "entrando". Es la misma clase de defecto que
// ya cerró `ORIGEN-FOTOS-REVELADO-Y-CONTEO-1`/`SUSCRIPCION-TITULO-Y-RECARGA-1` para sus dos
// secciones: estas CIFRAS son la generalización de ESE patrón al resto de la home.
//
// ESTA PRIMITIVA NO REEMPLAZA `fadeUp`/`REVELADO_GRUPO_*`/`CASCADA_BLOQUE_*` (lib/animation.ts): esos
// tokens siguen siendo de "El origen" y "Suscripción" (variante `linea`), que el spec de este slice
// deja EXPLÍCITAMENTE sin tocar — su entrada YA está al nivel pedido. `RevelarBloque`
// (components/storefront/RevelarBloque.tsx) es la primitiva NUEVA para el RESTO de los bloques de
// texto/media de la home (incluida Nayoli, pedido explícito del owner: "deja de ser byte-idéntica en
// la entrada de sus secciones").
//
// LAS CIFRAS SON LAS QUE EL ORQUESTADOR DECIDIÓ (`cifras-decision: 50, 0.8, 0.1` del spec), no
// inventadas por este slice: 50px de recorrido, 0.8s de duración, 0.1s de paso entre hermanos — las
// tres calcan §0 del spec ("sube... 50px... dura ~0.8s... escalonado ~0.1s").
export const REVELA_BLOQUE_DISTANCIA_PX = 50;
export const REVELA_BLOQUE_DURACION_S = 0.8;
export const REVELA_BLOQUE_PASO_S = 0.1;

// `cubic-bezier(0.22, 1, 0.36, 1)` — la curva que §0 del spec describe («a los ~85ms ya recorrió un
// tercio; a los ~185ms, cerca del 60%» — una salida FUERTE, con el pico de velocidad al principio del
// recorrido). Es la MISMA familia que `REVELADO_GRUPO_EASE`/`TRANSICION_DESTACADO_EASE`
// (`[0.22,0.61,0.36,1]`, lib/animation.ts) pero NO la misma curva: el segundo punto de control sube de
// 0.61 a 1 — eso es justo lo que hace la salida más abrupta al arranque (un `ease-out` más fuerte).
// Reusar la curva vieja habría sido la MISMA confusión que ya advierte `lib/animation.ts` para
// `fadeUp` vs. el marquee del hero: "se diseñó para OTRO disparador, no se reusa sin medir".
export const REVELA_BLOQUE_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// LA VENTANA DE DISPARO TARDÍO — el margen que `viewport.margin` de framer-motion pasa DIRECTO como
// `rootMargin` del `IntersectionObserver` nativo (verificado contra la fuente instalada,
// `node_modules/framer-motion/dist/es/render/dom/viewport/index.mjs`: `margin: rootMargin` sin
// transformación). Un margen NEGATIVO encoge la caja efectiva del viewport desde ese borde — con
// `-20%` en el FONDO, sólo el 80% superior de la pantalla cuenta como "visible" para el observer en
// esa dirección, así que un bloque no dispara al asomar por el borde inferior: tiene que haber
// scrolleado bien adentro de la pantalla primero (§0 del spec: "un título con su borde superior al
// 80% del alto de la ventana todavía NO había arrancado").
//
// SÓLO EL FONDO SE ENCOGE — ASIMÉTRICO A PROPÓSITO. CORRIGE `SECCIONES-ENTRAN-VIVAS-1`
// (`SECCIONES-ENTRAN-UNA-VEZ-1`, 2026-10-01): aquel slice encogía TAMBIÉN el tope (`-20%` arriba),
// razonando que la salida temprana simétrica era "la otra mitad de 'se repite'" en la referencia. Era
// un ERROR DE MEDICIÓN DEL ORQUESTADOR, no un hecho de homeburgers.com (§ el spec de este slice, §0):
// re-medido, un bloque de la referencia entra UNA VEZ y queda en opacidad 1 para siempre — al pasar
// arriba, al salir por arriba, al volver a bajar y al volver a entrar desde abajo. Con el tope
// también encogido Y `once:false` (abajo), un bloque que ya cruzó la mitad de la pantalla hacia
// arriba salía de la caja efectiva (el 20% superior real quedaba fuera de ella) y el observer dejaba
// de reportarlo "intersecting": `whileInView` revertía a `hidden` y el bloque se desvanecía MIENTRAS
// el visitante todavía lo estaba leyendo (medido en iPhone: el título del destacado a ~36px del
// borde superior ya estaba al 60% de opacidad). Dejar el TOPE en `0px` quita esa frontera: desde que
// un bloque entra hasta que sale enteramente por arriba del viewport real, sigue "intersecting" — y
// por tanto `visible` —, que es justo el punto en que ya no queda nada que desvanecer porque no se ve.
//
// EL VALOR EXACTO (20% en el fondo) SIGUE SIENDO EL MISMO QUE MIDIÓ `SECCIONES-ENTRAN-VIVAS-1`, NO
// UNA CIFRA NUEVA: el defecto no estaba en LA MAGNITUD del disparo tardío (medida contra el gate
// visual de aquel slice, 1440 e iPhone, 8/8 arrancando entre 71%–79% del alto de ventana) — estaba en
// haber aplicado la misma magnitud también a la SALIDA. `cifras-decision` del spec de aquel slice
// tampoco daba un número para el margen; éste lo sigue sin dar.
export const REVELA_BLOQUE_MARGEN = '0px 0px -20% 0px' as const;

// `hidden`/`visible` — igual forma que `fadeUp` (opacity + y), otra magnitud. `y` numérico es px por
// defecto en framer-motion (sin unidad, a diferencia de `fadeUpCascadaBloque.y:"30%"`, que es un
// PORCENTAJE de la propia caja): el spec pide un recorrido fijo en píxeles ("sube... 50px a 0"), no
// relativo al tamaño del bloque — a diferencia del marquee display del hero, acá no hay un solo
// tamaño de letra dominante que un recorrido fijo pudiera "vencer" (§ el docstring de
// `transformRevelaTextoDisplay`, lib/animation.ts): estos bloques son títulos de sección, párrafos,
// CTAs y media, de tamaños dispares entre sí.
export const variantesRevelaBloque = {
  hidden: { opacity: 0, y: REVELA_BLOQUE_DISTANCIA_PX },
  visible: { opacity: 1, y: 0 },
};

export interface TransicionRevelaBloque {
  duration: number;
  ease: [number, number, number, number];
  delay: number;
}

// `indice` es la posición del bloque DENTRO de su grupo de hermanos (0-based, en orden de lectura) —
// el escalonado de §0 ("los bloques hermanos arrancan ~0.1s uno detrás del otro"). Un índice negativo
// o fraccionario no es un caso real (todo llamador pasa un entero ≥0, literal o de un `.map`), pero se
// acota con `Math.max(0, …)` para que un 0 por defecto en un llamador sin índice explícito nunca
// produzca un retraso negativo.
export function transicionRevelaBloque(indice: number = 0): TransicionRevelaBloque {
  return {
    duration: REVELA_BLOQUE_DURACION_S,
    ease: REVELA_BLOQUE_EASE,
    delay: Math.max(0, indice) * REVELA_BLOQUE_PASO_S,
  };
}
