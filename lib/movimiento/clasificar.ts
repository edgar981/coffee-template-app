// lib/movimiento/clasificar.ts — § ARNES-CENSO-MOVIMIENTO-1
//
// LA MITAD PURA DEL ARNÉS DE CENSO DE MOVIMIENTO (`scripts/censar-movimiento.ts` es la mitad
// impura: abre el navegador, scrollea, muestrea). Acá no hay DOM, no hay Playwright, no hay
// tiempo real — sólo la CLASIFICACIÓN de una traza de muestras ya capturada, para poder afirmarla
// en `node:test` con datos sintéticos (el mismo criterio de siempre en este repo: se extrae lo que
// tiene la decisión para poder afirmarlo, § `transformAcomodo`/`valorContador` en `lib/animation.ts`).
//
// EL VOCABULARIO (documentado con más detalle y ejemplos del repo en `DUNA-MOVIMIENTO.md`):
//   - `ticker`  — el elemento cambia CON EL TIEMPO a scroll fijo (una animación que corre sola,
//     como `transformMarquesinaTexto`/`VELOCIDAD_TICKER_PX_S` en `lib/animation.ts`).
//   - `scrub`   — el elemento cambia CON EL SCROLL, y es estable en el tiempo a scroll fijo (como
//     `useProgresoScroll`/`transformAcomodo`).
//   - `revelado`— el elemento cambia UNA VEZ, en una ventana angosta del recorrido (de scroll, o
//     de tiempo dentro de una misma posición de scroll — un contador que cuenta una vez al entrar
//     al viewport, § `useContadorAnimado`), y después queda ESTABLE para el resto del recorrido.
//   - `estatico`— no cambia en ninguna muestra.
//
// UN ELEMENTO PUEDE SER MÁS DE UNA CLASE A LA VEZ — no es un enum excluyente. El propio marquee del
// hero de este repo compone DOS motores en el mismo `transform` (§ CORTE-HERO-VELO-OFF-Y-TICKER-1 +
// CORTE-HERO-MARQUEE-REVELA-1: el eje horizontal es un ticker por tiempo, el eje vertical/opacidad
// es un revelado por scroll temprano) — `clasificarElemento` devuelve TODAS las clases que aplican,
// nunca fuerza una sola. El spec de este slice lo pide explícito: "reportá las dos".
//
// LÍMITE DECLARADO: `hover` queda FUERA de alcance (exige simular puntero, que este muestreo no
// hace) — un elemento cuyo único movimiento es por `:hover` se clasificará `estatico` acá, no
// porque el arnés se equivoque sino porque no lo ejercita. Documentado en `docs/movimiento/README.md`.
//
// ─── POR QUÉ LA CLASIFICACIÓN ES POR-COMPONENTE, NO POR EL `transform` ENTERO — MEDIDO, no de
// diseño original ─────────────────────────────────────────────────────────────────────────────────
// El primer censo real (contra `xo-marquee`, cafeone.myshopify.com, § ARNES-CENSO-MOVIMIENTO-1)
// reportó ~170 elementos como "ticker + scrub (scrollY 0–19093)" — el rango de scroll ENTERO. La
// causa: comparar el `transform` COMO UN VECTOR (con una sola magnitud "el mayor delta de
// cualquiera de sus números") mezcla ejes que se mueven por razones DISTINTAS. Un elemento con un
// eje que TICKEA (avanza por tiempo, sin detenerse mientras el arnés scrollea a la posición
// siguiente) y otro eje que no se mueve en absoluto seguía viendo su valor "representativo"
// avanzar de grupo a grupo — no porque el scroll lo moviera, sino porque pasó tiempo real entre una
// posición y la siguiente. Resuelto tratando cada NÚMERO de la matriz (más la opacidad) como su
// propio eje independiente: el ticker se detecta y se descuenta EJE POR EJE, así que un eje mudo
// nunca hereda el ruido de un eje vecino que sí tickea, y un eje que sí scrubea (como el ejemplo del
// marquee: X tickea, Y/opacidad scrubea) no queda enmascarado por la magnitud del otro.

/** Una lectura del estado computado de un elemento en un instante `t` (ms transcurridos desde el
 *  PRIMER instante de su grupo de scroll — no un reloj absoluto), a una posición de scroll fija. */
export interface MuestraTiempo {
  t: number;
  /** `getComputedStyle(el).transform` — "none" o una matriz ("matrix(...)"/"matrix3d(...)"). */
  transform: string;
  /** `getComputedStyle(el).opacity`, ya como número (0..1). */
  opacity: number;
  /** El elemento intersecta el viewport en este instante. Ayuda a interpretar un `revelado`, pero
   *  la clasificación NO depende de este campo — sólo de `transform`/`opacity`. */
  enViewport: boolean;
}

/** Todas las muestras tomadas con el documento scrolleado a `scrollY`, en varios instantes. */
export interface GrupoScroll {
  scrollY: number;
  /** Al menos una muestra. Si hay ≥2, permiten detectar cambio POR TIEMPO a este scroll fijo. */
  muestras: MuestraTiempo[];
  /** Marca de tiempo REAL (cualquier época consistente entre grupos — p. ej. `Date.now()` del
   *  arnés) de la ÚLTIMA muestra de este grupo. OPCIONAL: sin ella, un TICKER cuya velocidad se
   *  midió sobre una ventana CORTA (el intervalo entre instantes dentro de un grupo) no puede
   *  extrapolarse correctamente sobre la ventana MÁS LARGA entre dos grupos (el tiempo real de
   *  scrollear + asentar) — y esa ventana más larga es precisamente donde el drift de un ticker
   *  lineal se vuelve visible. Con la marca, la corrección por ticker (§ el docstring de cabecera)
   *  usa el tiempo real transcurrido en vez de asumirlo. */
  tAbsolutoUltimaMuestraMs?: number;
}

export type ClaseMovimiento = "ticker" | "scrub" | "revelado" | "estatico";

export interface ClasificacionTicker {
  clase: "ticker";
  /** Unidades/segundo aproximadas del eje con mayor velocidad detectada (px/s si ese eje es un
   *  translate; la unidad exacta depende de qué componente de la matriz cambió). `null` si no se
   *  pudo derivar (p. ej. todas las duraciones medidas dieron 0). */
  velocidadAproxPorSegundo: number | null;
}

export interface ClasificacionScrub {
  clase: "scrub";
  /** El tramo de scroll (en las mismas unidades que `GrupoScroll.scrollY`, típicamente px) donde
   *  se observó el cambio, en CUALQUIERA de los ejes. */
  ventanaScrollY: { desde: number; hasta: number };
}

export interface ClasificacionRevelado {
  clase: "revelado";
  /** Magnitud aproximada del cambio entre el estado ANTES de revelarse y el estado YA asentado
   *  (mezcla de delta numérico de `transform` y de `opacity`, sin unidad única — es un tamaño de
   *  cambio, no una distancia física exacta). `null` si no se pudo derivar. */
  desplazamientoAprox: number | null;
  /** Si el asentamiento ocurrió DENTRO de una misma posición de scroll (es decir, se detectó un
   *  cambio por tiempo justo en el grupo donde el revelado se completó — el caso del contador que
   *  cuenta durante ~1100ms sin que el visitante siga scrolleando), los ms que tardó. `null` si el
   *  revelado fue puramente function del scroll (no se detectó variación temporal en ese grupo). */
  duracionMs: number | null;
}

export interface ClasificacionEstatico {
  clase: "estatico";
}

export type ClaseResultado =
  | ClasificacionTicker
  | ClasificacionScrub
  | ClasificacionRevelado
  | ClasificacionEstatico;

export interface ResultadoClasificacion {
  clases: ClaseResultado[];
}

// ─── Extracción numérica de `transform` ────────────────────────────────────────────────────────────
//
// `getComputedStyle(...).transform` resuelve SIEMPRE a "none" o a una matriz ("matrix(a,b,c,d,e,f)"
// en 2D, "matrix3d(...)" con 16 componentes si hay transform 3D) — nunca a `translate()`/`rotate()`
// literal. Extraer los números por posición y tratar cada posición como su propio EJE es robusto Y
// genérico — no hace falta decodificar semánticamente qué representa cada componente de la matriz
// para saber que UNO de ellos cambió.
function numerosDeTransform(transform: string): number[] {
  const encontrados = transform.match(/-?\d+(\.\d+)?/g);
  return encontrados ? encontrados.map(Number) : [];
}

function difieren(a: MuestraTiempo, b: MuestraTiempo): boolean {
  if (Math.abs(a.opacity - b.opacity) > EPS_OPACIDAD) return true;
  const na = numerosDeTransform(a.transform);
  const nb = numerosDeTransform(b.transform);
  // Distinta CANTIDAD de números es un cambio de FORMA de la matriz ("none" → "matrix(...)", o
  // 2D → 3D) — siempre un cambio, sin ambigüedad de a qué componente comparar.
  if (na.length !== nb.length) return true;
  for (let i = 0; i < na.length; i++) {
    if (Math.abs(na[i] - nb[i]) > EPS_TRANSFORM) return true;
  }
  return false;
}

/** Magnitud aproximada del cambio entre dos muestras — el mayor delta numérico de `transform`, o
 *  el delta de `opacity` escalado a una magnitud comparable (×100, para que un fade completo
 *  (opacity 0→1) no se lea como "casi nada" al lado de un translate de decenas de px). SÓLO se usa
 *  para reportar un tamaño legible de `revelado` (`desplazamientoAprox`) — la detección misma es
 *  por-eje (§ abajo), nunca sobre esta magnitud combinada. */
function magnitudCambio(a: MuestraTiempo, b: MuestraTiempo): number {
  const na = numerosDeTransform(a.transform);
  const nb = numerosDeTransform(b.transform);
  const deltaOpacidad = Math.abs(a.opacity - b.opacity) * 100;
  if (na.length !== nb.length || na.length === 0) return deltaOpacidad;
  const deltaTransform = Math.max(...na.map((v, i) => Math.abs(v - nb[i])));
  return Math.max(deltaTransform, deltaOpacidad);
}

// UN SOLO EPSILON PARA `translate` Y PARA `scale`/`rotate` — MEDIDO, no arbitrario. Una posición de
// la matriz 2D (`matrix(a,b,c,d,e,f)`) puede llevar un TRANSLATE (decenas/cientos de px, e/f) o un
// SCALE/ROTATE (típicamente 0..2, a/b/c/d) — no hay forma barata de saber por POSICIÓN qué semántica
// tiene sin asumir de antemano la forma de la matriz (y una `matrix3d` ni siquiera comparte esas
// posiciones). Un epsilon calibrado para "unos pocos px de translate" (0.5) es DEMASIADO GRUESO para
// un `scale` real: MEDIDO, el segundo defecto del primer censo (§ el docstring de cabecera) tenía un
// `<div>` cuyo `transform` era `matrix(v, 0, 0, v, 0, 0)` con `v` en el rango 0.02–0.85 (un pulso de
// escala) — con epsilon 0.5, ese eje NUNCA se detectaba como ticker (sus deltas internos, ~0.1–0.3,
// quedaban por debajo del umbral) pero SÍ pasaba el umbral al comparar entre grupos (deltas
// ~0.3–0.8), colándose como scrub sin el descuento de ticker que ese mismo eje debería haber
// activado. Un epsilon chico (0.01, el mismo que ya usa `opacity`, que vive en el mismo rango 0..1)
// resuelve los dos casos: sigue de sobra por encima del ruido de punto flotante de un valor
// realmente estático, y ya no es ciego a un `scale` que se mueve poco en términos absolutos.
const EPS_TRANSFORM = 0.01;
const EPS_OPACIDAD = 0.01;

// El margen sobre el cambio PREDICHO por el propio ticker que un cambio observado debe superar
// para contar como "por scroll" en ESE eje — no 1.0 exacto: la velocidad del ticker es un PROMEDIO
// y el `dtMs` real entre dos grupos puede variar un poco por el overhead de cada `evaluate()` del
// arnés; un margen del 50% separa ruido de medición de una señal real.
const FACTOR_TOLERANCIA_TICKER = 1.5;
// Un ticker verdadero no depende de la posición de scroll: si se muestrearon varios instantes en
// UNA posición, debería moverse igual que en cualquier otra. Por eso el criterio exige DOS cosas:
// (a) que la MAYORÍA de los grupos con ≥2 muestras muestren cambio por tiempo EN ESE EJE, y (b) que
// haya AL MENOS DOS grupos así — con uno solo no hay forma de distinguir "esto se mueve siempre" de
// "esto se asentó UNA vez, justo en la posición que resultó tener más de una muestra" (un revelado
// con componente temporal, § `useContadorAnimado`).
const UMBRAL_MAYORIA_TICKER = 0.5;
const MINIMO_GRUPOS_PARA_TICKER = 2;
// Si sólo una MINORÍA de las transiciones muestrales muestra cambio, es un REVELADO — un evento que
// ocurre una vez (dondequiera que caiga en el recorrido) y deja el resto quieto. Si la MAYORÍA de
// las transiciones cambian, el elemento se mueve a lo largo de casi todo el recorrido: es un SCRUB
// continuo. MEDIDO, no de diseño original: la primera versión medía "¿el ÚLTIMO cambio ocurre
// temprano?" (posición absoluta en el recorrido) en vez de "¿CUÁNTAS transiciones cambiaron?"
// (proporción) — y clasificó mal un fade-in real de `xo-marquee` en cafeone.myshopify.com que
// entra a mitad de documento (una sola transición cambia, en la posición 3 de 5, 60% del recorrido)
// como `scrub`, porque "60% del recorrido" no es "temprano" aunque sea UN SOLO evento. El criterio
// por PROPORCIÓN no le importa DÓNDE cae el evento — sólo cuántas transiciones lo evidencian —, que
// es lo que la propia palabra "revelado" (un evento, no una posición) pide.
const UMBRAL_FRACCION_REVELADO = 0.4;

/** El análisis de UN eje (un número de posición fija de la matriz, o la opacidad) a través de
 *  todos los grupos de un elemento. */
interface AnalisisEje {
  ticker: { velocidad: number } | null;
  /** Índices (1-based, como en `grupos`) de las transiciones scroll→scroll donde ESTE eje cambió
   *  por razones que el propio ticker de este eje NO explica. */
  indicesConCambio: number[];
}

function analizarEje(
  grupos: GrupoScroll[],
  valorDe: (m: MuestraTiempo) => number,
  epsilon: number,
): AnalisisEje {
  const gruposConVarios = grupos.filter((g) => g.muestras.length >= 2);

  // ── ¿Este eje tickea? ──
  let velocidadTicker: number | null = null;
  if (gruposConVarios.length >= MINIMO_GRUPOS_PARA_TICKER) {
    const gruposQueCambian = gruposConVarios.filter(
      (g) => Math.abs(valorDe(g.muestras[g.muestras.length - 1]) - valorDe(g.muestras[0])) > epsilon,
    );
    if (gruposQueCambian.length / gruposConVarios.length >= UMBRAL_MAYORIA_TICKER) {
      const velocidades: number[] = [];
      for (const g of gruposQueCambian) {
        const dt = g.muestras[g.muestras.length - 1].t - g.muestras[0].t;
        if (dt <= 0) continue;
        velocidades.push((Math.abs(valorDe(g.muestras[g.muestras.length - 1]) - valorDe(g.muestras[0])) / dt) * 1000);
      }
      velocidadTicker = velocidades.length > 0 ? velocidades.reduce((a, b) => a + b, 0) / velocidades.length : null;
    }
  }

  // La amplitud MÁXIMA observada de este eje DENTRO de un único grupo (el rango entre su muestra
  // mínima y máxima) — cubre el caso en que el ticker no es un avance LINEAL sino una oscilación
  // acotada (un pulso/parpadeo): ahí `velocidad × dt` subestima brutalmente el cambio posible entre
  // dos grupos separados por más tiempo que un ciclo de la oscilación, porque la oscilación no
  // "sigue creciendo" — vuelve sobre el mismo rango. MEDIDO: el censo real encontró exactamente este
  // patrón (un `div` cuya opacidad/escala salta entre ~0.02 y ~0.85 dentro de un mismo grupo).
  let amplitudMaximaDentroDeGrupo = 0;
  for (const g of gruposConVarios) {
    const valores = g.muestras.map(valorDe);
    amplitudMaximaDentroDeGrupo = Math.max(amplitudMaximaDentroDeGrupo, Math.max(...valores) - Math.min(...valores));
  }

  // ── ¿Este eje cambia por SCROLL, más allá de lo que su propio ticker (si lo hay) explica? ──
  const representativos = grupos.map((g) => valorDe(g.muestras[g.muestras.length - 1]));
  const marcasDeTiempo = grupos.map((g) => g.tAbsolutoUltimaMuestraMs);
  const indicesConCambio: number[] = [];
  for (let i = 1; i < representativos.length; i++) {
    const observado = Math.abs(representativos[i] - representativos[i - 1]);
    if (observado <= epsilon) continue;

    if (velocidadTicker != null) {
      const tA = marcasDeTiempo[i - 1];
      const tB = marcasDeTiempo[i];
      const dtMs = tA !== undefined && tB !== undefined ? tB - tA : undefined;
      // Se toma el MAYOR de dos predictores: la extrapolación lineal por tiempo real transcurrido
      // (para un ticker que avanza sin detenerse, tipo marquee) y la amplitud ya observada dentro
      // de un grupo (para un ticker oscilante/acotado, tipo pulso) — cualquiera de los dos "explica"
      // el cambio observado.
      const porRitmo = dtMs !== undefined && dtMs > 0 ? (velocidadTicker * dtMs) / 1000 : 0;
      const esperadoPorTicker = Math.max(porRitmo, amplitudMaximaDentroDeGrupo);
      if (observado <= esperadoPorTicker * FACTOR_TOLERANCIA_TICKER) continue;
    }

    indicesConCambio.push(i);
  }

  return { ticker: velocidadTicker != null ? { velocidad: velocidadTicker } : null, indicesConCambio };
}

// ─── Ejes de un elemento — un número por posición de la matriz, más la opacidad ────────────────────
//
// Requiere que TODAS las muestras del elemento (todos los grupos, todos los instantes) tengan
// `transform` con la MISMA cantidad de números — si la forma cambia alguna vez ("none" ↔
// "matrix(...)", o 2D ↔ 3D), no hay ejes estables que trackear por posición, y se cae a la
// comparación MONOLÍTICA (`difieren`/`magnitudCambio`, sin descuento de ticker por eje — caso raro
// y ya cubierto por el criterio "cambio de forma siempre cuenta").
function formaConsistente(grupos: GrupoScroll[]): number | null {
  let referencia: number | null = null;
  for (const g of grupos) {
    for (const m of g.muestras) {
      const n = numerosDeTransform(m.transform).length;
      if (referencia === null) referencia = n;
      else if (referencia !== n) return null;
    }
  }
  return referencia;
}

function clasificarPorEjes(grupos: GrupoScroll[], nComponentesTransform: number): ResultadoClasificacion {
  const accesores: Array<{ valorDe: (m: MuestraTiempo) => number; epsilon: number }> = [];
  for (let i = 0; i < nComponentesTransform; i++) {
    accesores.push({ valorDe: (m) => numerosDeTransform(m.transform)[i], epsilon: EPS_TRANSFORM });
  }
  accesores.push({ valorDe: (m) => m.opacity, epsilon: EPS_OPACIDAD });

  const analisis = accesores.map((a) => analizarEje(grupos, a.valorDe, a.epsilon));

  const ejesTicker = analisis.filter((a) => a.ticker);
  const ticker: ClasificacionTicker | null =
    ejesTicker.length > 0
      ? { clase: "ticker", velocidadAproxPorSegundo: Math.max(...ejesTicker.map((a) => a.ticker!.velocidad)) }
      : null;

  const indicesUnion = new Set<number>();
  for (const a of analisis) for (const idx of a.indicesConCambio) indicesUnion.add(idx);
  const indices = [...indicesUnion].sort((x, y) => x - y);

  const clases: ClaseResultado[] = [];
  if (ticker) clases.push(ticker);
  if (indices.length > 0) clases.push(clasificarVentana(grupos, indices));
  if (clases.length === 0) clases.push({ clase: "estatico" });
  return { clases };
}

/** Dados los índices de transición con cambio-por-scroll ya confirmado (post-descuento de ticker),
 *  decide si el patrón es `scrub` (cambia en la MAYORÍA de las transiciones) o `revelado` (cambia
 *  en una MINORÍA — un evento, no importa dónde caiga), y arma sus parámetros. */
function clasificarVentana(grupos: GrupoScroll[], indices: number[]): ClasificacionScrub | ClasificacionRevelado {
  const primerIndice = Math.min(...indices);
  const ultimoIndice = Math.max(...indices);
  const totalTransiciones = grupos.length - 1;
  const esRevelado = indices.length / totalTransiciones <= UMBRAL_FRACCION_REVELADO;

  if (!esRevelado) {
    return {
      clase: "scrub",
      ventanaScrollY: { desde: grupos[primerIndice - 1].scrollY, hasta: grupos[ultimoIndice].scrollY },
    };
  }

  const reps = grupos.map((g) => g.muestras[g.muestras.length - 1]);
  const desplazamientoAprox = magnitudCambio(reps[primerIndice - 1], reps[ultimoIndice]);

  // ¿El asentamiento final ocurrió DENTRO de una posición de scroll (por tiempo)? Si el grupo donde
  // se completó el revelado tiene ≥2 muestras y ESAS muestras difieren entre sí, el revelado tuvo
  // una componente temporal medible (el contador de `useContadorAnimado`, no un revelado puramente
  // atado a la posición de scroll).
  const grupoFinal = grupos[ultimoIndice];
  let duracionMs: number | null = null;
  if (
    grupoFinal.muestras.length >= 2 &&
    difieren(grupoFinal.muestras[0], grupoFinal.muestras[grupoFinal.muestras.length - 1])
  ) {
    duracionMs = grupoFinal.muestras[grupoFinal.muestras.length - 1].t - grupoFinal.muestras[0].t;
  }

  return { clase: "revelado", desplazamientoAprox, duracionMs };
}

/** Fallback para forma INCONSISTENTE (§ `formaConsistente`) — el elemento en algún momento cambió
 *  la CANTIDAD de números de su `transform` ("none" ↔ una matriz, o 2D ↔ 3D). Sin ejes estables por
 *  posición, se usa la comparación monolítica de siempre, sin descuento de ticker: es un caso raro
 *  (un elemento que aparece/desaparece del layout de transform, no que se mueva dentro de él), y
 *  arriesgar un falso negativo por no aplicar el descuento es preferible a inventar una forma de
 *  trackear un eje que no existe todavía en algunas muestras. */
function clasificarMonolitico(grupos: GrupoScroll[]): ResultadoClasificacion {
  const gruposConVarios = grupos.filter((g) => g.muestras.length >= 2);
  let ticker: ClasificacionTicker | null = null;
  if (gruposConVarios.length >= MINIMO_GRUPOS_PARA_TICKER) {
    const gruposQueCambian = gruposConVarios.filter((g) => difieren(g.muestras[0], g.muestras[g.muestras.length - 1]));
    if (gruposQueCambian.length / gruposConVarios.length >= UMBRAL_MAYORIA_TICKER) {
      const velocidades: number[] = [];
      for (const g of gruposQueCambian) {
        const dt = g.muestras[g.muestras.length - 1].t - g.muestras[0].t;
        if (dt <= 0) continue;
        velocidades.push((magnitudCambio(g.muestras[0], g.muestras[g.muestras.length - 1]) / dt) * 1000);
      }
      ticker = {
        clase: "ticker",
        velocidadAproxPorSegundo: velocidades.length > 0 ? velocidades.reduce((a, b) => a + b, 0) / velocidades.length : null,
      };
    }
  }

  const reps = grupos.map((g) => g.muestras[g.muestras.length - 1]);
  const indices: number[] = [];
  for (let i = 1; i < reps.length; i++) {
    if (difieren(reps[i - 1], reps[i])) indices.push(i);
  }

  const clases: ClaseResultado[] = [];
  if (ticker) clases.push(ticker);
  if (indices.length > 0) clases.push(clasificarVentana(grupos, indices));
  if (clases.length === 0) clases.push({ clase: "estatico" });
  return { clases };
}

/** Clasifica la traza de UN elemento. Puede devolver varias clases a la vez (§ el docstring de
 *  cabecera — un elemento puede scrubear en un eje Y tickear en otro, simultáneamente).
 *  `estatico` sólo aparece SOLO, cuando ninguna otra clase aplicó — nunca junto a otra. */
export function clasificarElemento(grupos: GrupoScroll[]): ResultadoClasificacion {
  if (grupos.length === 0 || grupos.every((g) => g.muestras.length === 0)) {
    return { clases: [{ clase: "estatico" }] };
  }
  const n = formaConsistente(grupos);
  if (n === null) return clasificarMonolitico(grupos);
  return clasificarPorEjes(grupos, n);
}
