// ─── El HORIZONTE ondulante de las pantallas PRE-AUTH — geometría PURA ─────────
//
// Reemplaza a la cresta única con el sol viajero (§ DunaPie.tsx, versión anterior)
// por un horizonte de VARIAS líneas paralelas que ondulan sin parar — la forma que
// el owner señaló en la pieza de marca de Duna (PANEL-LOGIN-HORIZONTE-ONDULANTE-1).
// Sin React, sin DOM: dada una configuración (cuántas líneas, cuántas de acento),
// devuelve el `d` de cada trazo y sus parámetros de movimiento. `DunaPie.tsx`
// SOLO consume esto y pinta; toda decisión de forma vive acá, testeada en
// `duna-horizonte.test.ts`.
//
// LA GRAMÁTICA (adaptada, no copiada píxel a píxel — ver el asiento de
// `DECISIONS.md`, PANEL-LOGIN-HORIZONTE-ONDULANTE-1, sobre por qué no se pudo leer
// el archivo de referencia en esta sesión):
//   · Cada línea es la SUMA DE DOS ONDAS senoidales de distinta frecuencia (la
//     principal + un segundo armónico de período MITAD y menor amplitud) — así
//     una sola línea ya ondula de forma orgánica, no como un seno puro.
//   · Las líneas se SEPARAN verticalmente (`yBaseDeLinea`) y se DESFASAN entre sí
//     en x (`faseDeLinea`), para que no luzcan como copias calcadas unas de otras.
//   · La VELOCIDAD (distinta por línea, `duracionDeLinea`) es lo que las hace
//     "cruzarse" con el tiempo — la ondulación colectiva no sale de animar la
//     forma cuadro a cuadro, sino de trasladar cada línea a su propio ritmo.
//   · La OPACIDAD decae hacia atrás: la línea más lejana (índice 0) es la más
//     tenue: se funde con el fondo; la más cercana es la más marcada.
//   · Algunas líneas (las más al FRENTE, `esAcento`) son de ACENTO — se pintan en
//     el ámbar de marca; el resto son NEUTRAS.
//
// EL LOOP SIN COSTURA es la propiedad que hace válida la animación por CSS
// `transform: translateX`: cada línea es analíticamente PERIÓDICA en su propio
// `periodoPx` (`alturaOnda(x) === alturaOnda(x + periodoPx)`, afirmado en el
// test), así que trasladar el trazo exactamente un período dibuja, en cada
// instante, la MISMA curva que al principio — no hay salto visible en el punto
// donde el ciclo se repite. Por eso cada trazo se dibuja MÁS ANCHO que el
// viewBox (un período de más a cada lado, como ya hacía la cresta única con sus
// "colas"), para que el tramo visible nunca se quede sin geometría dibujada
// mientras se desplaza.

export const HORIZONTE_ANCHO = 1440; // viewBox width — el mismo que usaba la cresta única
export const HORIZONTE_ALTO = 240; // viewBox height — sin cambio

export const HORIZONTE_NUM_LINEAS = 6;
/** Las últimas N líneas (las más al FRENTE) son de acento (ámbar); el resto, neutras. */
export const HORIZONTE_NUM_AMBAR = 2;

// Baseline vertical: de la más lejana (arriba) a la más cercana (abajo).
const Y_ATRAS = 95;
const Y_FRENTE = 205;

// Amplitud de la onda principal y del segundo armónico (período mitad).
const AMPLITUD_1 = 9;
const AMPLITUD_2 = AMPLITUD_1 * 0.35;

// Longitud de onda: crece con el índice, para que ninguna línea sea un clon
// reescalado de la anterior.
const PERIODO_BASE = 420;
const PERIODO_PASO = 55;

// Opacidad: decae hacia el fondo. 0.5 en el frente es EL MISMO valor que llevaba
// la cresta única (§ DunaPie histórico), para no perder de golpe la firma visual.
const OPACIDAD_MIN = 0.12;
const OPACIDAD_MAX = 0.5;

// Duración del ciclo de traslación: la línea más lejana es la más LENTA; la más
// cercana, la más RÁPIDA. Es lo que hace que se "crucen" con el tiempo.
const DURACION_BASE_S = 26;
const DURACION_PASO_S = -3;
const DURACION_MIN_S = 6;

// Puntos por período antes de suavizar a Bézier — suficiente para que la curva
// se lea lisa a cualquier ancho de pantalla real.
const MUESTRAS_POR_PERIODO = 24;

export function periodoDeLinea(indice: number): number {
  return PERIODO_BASE + indice * PERIODO_PASO;
}

function yBaseDeLinea(indice: number, total: number): number {
  if (total <= 1) return (Y_ATRAS + Y_FRENTE) / 2;
  return Y_ATRAS + ((Y_FRENTE - Y_ATRAS) * indice) / (total - 1);
}

/** Decae hacia el fondo: índice 0 (más lejos) es el más tenue. */
export function opacidadDeLinea(indice: number, total: number): number {
  if (total <= 1) return OPACIDAD_MAX;
  return OPACIDAD_MIN + (OPACIDAD_MAX - OPACIDAD_MIN) * (indice / (total - 1));
}

function duracionDeLinea(indice: number): number {
  return Math.max(DURACION_MIN_S, DURACION_BASE_S + indice * DURACION_PASO_S);
}

/** Las últimas `numAcento` líneas (las más al frente) llevan el ámbar de marca. */
export function esAcento(indice: number, total: number, numAcento: number): boolean {
  const n = Math.max(0, Math.min(numAcento, total));
  return indice >= total - n;
}

/** El desfase en x de cada línea, para que no arranquen "en fase" unas con otras. */
export function faseDeLinea(indice: number, periodo: number): number {
  return indice * periodo * 0.37;
}

// La altura de la onda en x: SUMA de dos senoidales de distinta frecuencia (la
// principal, período `periodo`; el segundo armónico, período `periodo/2` — EXACTAMENTE
// la mitad, a propósito: así la SUMA sigue siendo periódica en `periodo`, que es la
// condición del loop sin costura de arriba).
export function alturaOnda(x: number, periodo: number, faseLinea: number): number {
  const periodoArmonico = periodo / 2;
  const t = x + faseLinea;
  return (
    AMPLITUD_1 * Math.sin((2 * Math.PI * t) / periodo) +
    AMPLITUD_2 * Math.sin((2 * Math.PI * t) / periodoArmonico + 1.1)
  );
}

type Punto = { x: number; y: number };

/**
 * Catmull-Rom → Bézier cúbica — la MISMA técnica que ya usan las curvas de datos
 * del panel (`PagosCurva`, `CurvaPedidosHoy`; ver CLAUDE.md, § Pagos — la FRASE y
 * la CURVA), aplicada acá a una curva SIN datos: es identidad de marca, no un
 * gráfico. Pasa POR cada punto muestreado, así que la curva no se "atasca" en los
 * picos como pasaría con Béziers control-point-a-mano.
 */
function catmullRomABezier(puntos: Punto[]): string {
  if (puntos.length === 0) return '';
  if (puntos.length === 1) return `M ${puntos[0].x.toFixed(2)} ${puntos[0].y.toFixed(2)}`;

  let d = `M ${puntos[0].x.toFixed(2)} ${puntos[0].y.toFixed(2)}`;
  for (let i = 0; i < puntos.length - 1; i++) {
    const p0 = puntos[i - 1] ?? puntos[i];
    const p1 = puntos[i];
    const p2 = puntos[i + 1];
    const p3 = puntos[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

function pathDeLinea(x0: number, x1: number, y: number, periodo: number, faseLinea: number): string {
  const paso = periodo / MUESTRAS_POR_PERIODO;
  const puntos: Punto[] = [];
  for (let x = x0; x <= x1 + paso / 2; x += paso) {
    puntos.push({ x, y: y + alturaOnda(x, periodo, faseLinea) });
  }
  return catmullRomABezier(puntos);
}

export type LineaHorizonte = {
  /** 0 = la más lejana/tenue; NUM_LINEAS-1 = la más cercana/opaca. */
  indice: number;
  /** true → línea de ACENTO (ámbar de marca); false → NEUTRA (tinta/crema, según tema). */
  acento: boolean;
  /** El trazo, MÁS ANCHO que `HORIZONTE_ANCHO` (un período de más a cada lado). */
  d: string;
  /** Extensión horizontal del trazo — la traslación de un `periodoPx` lo recorre entero. */
  x0: number;
  x1: number;
  /** Baseline vertical de esta línea (antes de la onda). */
  y: number;
  /** Opacidad del trazo — decae hacia el fondo (índice bajo, más tenue). */
  opacidad: number;
  /** Longitud (px, en unidades del viewBox) que hay que trasladar para un loop exacto. */
  periodoPx: number;
  /** Duración del ciclo de traslación — cada línea a su propia velocidad. */
  duracionS: number;
  /** Sentido de traslación: alternado, para que las líneas se CRUCEN entre sí. */
  direccion: 1 | -1;
};

/**
 * Construye las `numLineas` líneas del horizonte. Determinista — sin `Math.random`,
 * así que no hace falta resolverlo en el cliente (a diferencia del sol viajero que
 * reemplaza, § DunaPie histórico): el mismo render en servidor y en cliente.
 */
export function construirHorizonte(
  numLineas: number = HORIZONTE_NUM_LINEAS,
  numAmbar: number = HORIZONTE_NUM_AMBAR,
  ancho: number = HORIZONTE_ANCHO,
): LineaHorizonte[] {
  const lineas: LineaHorizonte[] = [];
  for (let indice = 0; indice < numLineas; indice++) {
    const periodo = periodoDeLinea(indice);
    const y = yBaseDeLinea(indice, numLineas);
    const x0 = -periodo;
    const x1 = ancho + periodo;
    const fase = faseDeLinea(indice, periodo);
    lineas.push({
      indice,
      acento: esAcento(indice, numLineas, numAmbar),
      d: pathDeLinea(x0, x1, y, periodo, fase),
      x0,
      x1,
      y,
      opacidad: opacidadDeLinea(indice, numLineas),
      periodoPx: periodo,
      duracionS: duracionDeLinea(indice),
      direccion: indice % 2 === 0 ? 1 : -1,
    });
  }
  return lineas;
}

/**
 * El lavado (wash) bajo el horizonte, cerrado hasta el borde inferior del
 * viewBox — gemelo de `D_RELLENO` en la versión anterior de `DunaPie`, ahora
 * apoyado en la línea más al FRENTE (la más prominente). Devuelve `''` si no hay
 * líneas (caso degenerado, no se renderiza nada).
 */
export function rellenoBajoHorizonte(lineas: LineaHorizonte[], alto: number = HORIZONTE_ALTO): string {
  const frente = lineas[lineas.length - 1];
  if (!frente) return '';
  return `${frente.d} L ${frente.x1.toFixed(2)} ${alto} L ${frente.x0.toFixed(2)} ${alto} Z`;
}

// ── LA BANDA QUE EL CHASIS RESERVA (§ PreAuthShell) ─────────────────────────
//
// El SVG se ancla `bottom:0` con `width:100%; height:auto` (aspecto fijo), así que
// su alto renderizado es proporcional al ANCHO del contenedor. El contenido (card
// + pie) tiene que quedar por encima del punto MÁS ALTO que cualquier línea pueda
// alcanzar, para que el horizonte nunca lo cruce.
//
// La desviación máxima de una línea es la suma de las dos amplitudes (si las dos
// ondas caen en fase); el punto más alto de TODO el horizonte es el de la línea
// más lejana (`Y_ATRAS`, la de baseline más chica) menos esa desviación.
export const HORIZONTE_AMPLITUD_MAX = AMPLITUD_1 + AMPLITUD_2;
export const HORIZONTE_TOPE_Y = Y_ATRAS - HORIZONTE_AMPLITUD_MAX;

/**
 * Fracción del ANCHO del viewport a reservar como banda inferior — misma cuenta
 * que ya hacía la cresta única (distancia del punto más alto al borde inferior
 * del viewBox, como fracción del ancho, porque el SVG escala `width:100%,
 * height:auto`). Con los valores de hoy: (240 − 82.85) / 1440 ≈ 0.1091 → el
 * consumidor la redondea hacia ARRIBA (nunca hacia abajo: cruzar contenido es
 * peor que sobrar aire) — ver `PreAuthShell`.
 */
export const HORIZONTE_BANDA_FRACCION = (HORIZONTE_ALTO - HORIZONTE_TOPE_Y) / HORIZONTE_ANCHO;
