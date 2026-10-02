// lib/storefront/destacado-cruce.ts — § DESTACADO-CRUCE-SIN-PARPADEO-1
//
// Gate del owner, con captura: "the transition between images at 'El destacado' is not quite
// good yet, I feel like a blink and not something smooth." El fundido cruzado de la foto
// (`Spotlight.tsx`, § DESTACADO-NOMBRE-GRUPO-Y-TRANSICION-1) corría `AnimatePresence` en modo
// SYNC (el default): la foto SALIENTE iba de opacidad 1→0 mientras la ENTRANTE iba 0→1, A LA VEZ.
// A mitad de camino las DOS están a ~0.5 de opacidad, y como las dos son `position:absolute`
// dentro del MISMO tile (fondo `--sf-superficie`), ese fondo se filtra a través de las dos — ESE
// bajón de brillo es el parpadeo que el owner reportó, no una animación lenta ni una curva mala.
//
// LA CURA: que la capa de ABAJO ('fija') se quede OPACA, SIN ANIMAR, hasta que la de ARRIBA
// ('entrando') termine de fundir a opacidad 1 — nunca las dos translúcidas a la vez, así que el
// fondo nunca puede asomar. Matemáticamente: si `fija` siempre pinta a opacidad 1, el píxel
// compuesto en cualquier instante es `a·entrando + (1-a)·fija` — una combinación CONVEXA de las
// DOS FOTOS reales, nunca del fondo — así que su luminancia queda SIEMPRE entre la de las dos
// fotos, nunca por debajo de la menor (el invariante que el arnés de este slice mide cuadro a
// cuadro).
//
// "SÓLO CUANDO ESTÁ LISTA" (§ el spec: "si la carga tarda, la saliente sigue visible, nunca un
// hueco"): el fundido de `entrando` no debe EMPEZAR hasta que esa foto cargó y decodificó — si
// arranca antes, el navegador no tiene bytes que pintar y la capa de encima estaría fundiendo
// hacia algo transparente. Por eso el estado separa "hay un objetivo nuevo" (`entrando` seteado)
// de "ya se puede animar hacia él" (`entrandoListo`): mientras no esté listo, `entrando` existe
// pero su opacidad objetivo se queda en 0 — invisible, montado (descargando), y `fija` sigue de
// pie, opaca, exactamente como antes del clic.
//
// ESTE ARCHIVO SÓLO DECIDE EL ESTADO Y EL ORDEN DE PINTADO — nunca toca el DOM, `next/image` ni
// `requestAnimationFrame`/`decode()`. `Spotlight.tsx` (el componente `FotoCruceDestacado`) es el
// único llamador: dispara `cruceConNuevoObjetivo` cuando el visitante elige otra foto (molienda,
// presentación o tamaño — cualquiera que cambie `vistaActual.imagen`), `cruceConEntrandoListo`
// cuando el `<Image>` de la capa `entrando` confirma carga+decodificación, y
// `cruceConFundidoCompleto` cuando framer-motion reporta que esa capa llegó a opacidad 1.

export interface EstadoCruceDestacado {
  /** La foto que se ve OPACA y SIN ANIMAR — la base del cruce. `capasDeCruceDestacado` la pinta
   *  SIEMPRE primero (abajo), para que nunca quede expuesta por debajo de una capa translúcida. */
  readonly visible: string;
  /** La foto que está entrando ENCIMA de `visible`, o `null` si no hay cruce en curso. */
  readonly entrando: string | null;
  /** `entrando` ya cargó y decodificó. Mientras sea `false`, `capasDeCruceDestacado` mantiene su
   *  opacidad objetivo en 0 — el fundido no arranca sobre una foto a medio descargar. */
  readonly entrandoListo: boolean;
}

/** El estado al montar: una sola foto, opaca, sin ningún cruce en curso. */
export function cruceInicial(src: string): EstadoCruceDestacado {
  return { visible: src, entrando: null, entrandoListo: false };
}

/**
 * El visitante eligió otra foto (otra molienda, presentación o tamaño). Tres casos:
 *
 *  - `objetivo` es la que YA está `visible` → cancela cualquier fundido a medio camino hacia
 *    OTRA foto (el visitante volvió atrás antes de que esa otra terminara de cargar o fundir).
 *  - `objetivo` es la que YA está `entrando` → no-op: mismo objetivo, no hay nada que reiniciar
 *    (evita resetear `entrandoListo` a `false` en cada re-render mientras el visitante no cambia
 *    de elección).
 *  - Cualquier otro objetivo → arranca (o REEMPLAZA) el fundido hacia él, con `entrandoListo` en
 *    `false` — aunque esa foto ya estuviera precargada (§ `fotosDelGrupo`, `Spotlight.tsx`), la
 *    decodificación real la confirma el DOM, no esta función. Reemplazar descarta sin más lo que
 *    estuviera entrando antes: si el visitante clickeó dos veces seguidas, la primera elección
 *    nunca llega a promoverse a `visible`, y eso es correcto — nadie la vio completarse.
 */
export function cruceConNuevoObjetivo(estado: EstadoCruceDestacado, objetivo: string): EstadoCruceDestacado {
  if (objetivo === estado.visible) {
    return estado.entrando === null ? estado : { visible: estado.visible, entrando: null, entrandoListo: false };
  }
  if (objetivo === estado.entrando) return estado;
  return { visible: estado.visible, entrando: objetivo, entrandoListo: false };
}

/**
 * La foto `entrando` confirmó carga+decodificación. Ignora una confirmación RANCIA — una que ya
 * no corresponde al objetivo vigente (el visitante cambió de elección mientras esa foto cargaba)
 * — y es idempotente si ya estaba lista (una segunda confirmación no reinicia nada).
 */
export function cruceConEntrandoListo(estado: EstadoCruceDestacado, src: string): EstadoCruceDestacado {
  if (estado.entrando !== src || estado.entrandoListo) return estado;
  return { visible: estado.visible, entrando: estado.entrando, entrandoListo: true };
}

/**
 * El fundido 0→1 de `entrando` llegó a destino: se PROMUEVE a `visible` (ahora ella es la base
 * opaca) y el cruce se cierra. Ignora una confirmación RANCIA (el objetivo cambió mientras
 * fundía, o nunca llegó a marcarse lista — no debería poder completar sin estarlo, pero la guarda
 * no confía en que el llamador lo garantice).
 */
export function cruceConFundidoCompleto(estado: EstadoCruceDestacado, completado: string): EstadoCruceDestacado {
  if (estado.entrando !== completado || !estado.entrandoListo) return estado;
  return { visible: completado, entrando: null, entrandoListo: false };
}

export interface CapaCruceDestacado {
  readonly src: string;
  /** 'fija' pinta PRIMERO (abajo, opaca, sin animar); 'entrando' pinta SEGUNDO (encima, fundiendo
   *  — o quieta en 0 mientras no esté lista). El ORDEN es el invariante que este archivo existe
   *  para fijar: nunca al revés, nunca las dos con opacidad objetivo < 1 a la vez. */
  readonly rol: 'fija' | 'entrando';
  readonly opacidadObjetivo: 0 | 1;
}

/**
 * Las capas a pintar, EN ORDEN — `fija` siempre en el índice 0, `entrando` (si existe y es
 * distinta de `visible`) siempre en el índice 1. Es la función que `Spotlight.tsx` recorre con un
 * `.map()`: el orden del array ES el orden de pintado (DOM: el hermano posterior pinta encima),
 * así que invertir estos dos índices invertiría el cruce — dejaría la foto NUEVA debajo,
 * tapada por la VIEJA, en vez de revelarse encima de ella.
 */
export function capasDeCruceDestacado(estado: EstadoCruceDestacado): readonly CapaCruceDestacado[] {
  const capas: CapaCruceDestacado[] = [{ src: estado.visible, rol: 'fija', opacidadObjetivo: 1 }];
  if (estado.entrando !== null && estado.entrando !== estado.visible) {
    capas.push({ src: estado.entrando, rol: 'entrando', opacidadObjetivo: estado.entrandoListo ? 1 : 0 });
  }
  return capas;
}
