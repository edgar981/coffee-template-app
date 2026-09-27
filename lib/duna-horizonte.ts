// ─── El HORIZONTE ondulante de las pantallas PRE-AUTH — geometría PURA ─────────
//
// PANEL-LOGIN-HORIZONTE-FAMILIA-1: corrige el defecto que el slice anterior
// (PANEL-LOGIN-HORIZONTE-ONDULANTE-1) introdujo A PROPÓSITO — las líneas se
// CRUZABAN entre sí (velocidad distinta por línea, longitud de onda creciente,
// sentido alternado), y el owner comparó la pantalla real contra la pieza de
// marca y señaló que ahí las líneas NO se cruzan: comparten una sola onda y se
// desplazan JUNTAS, así que se leen como UNA superficie, no como trazos
// independientes compitiendo.
//
// LA LEY DE LA REFERENCIA (vendorizada en `docs/marca/horizonte-referencia.md`,
// que documenta su procedencia): para la línea `i`, con `u` la posición
// horizontal normalizada y `t` el tiempo,
//
//   y(i,u,t) = BASE + i·SEP
//            + sin(u·5.2 + t·1.2 + i·0.30) · (A1 + i·1.5)
//            + sin(u·11.0 − t·0.80 + i·0.50) · A2
//
// Léase: las DOS frecuencias (5.2, 11.0) NO dependen de `i` — todas las líneas
// tienen la MISMA onda —; lo único que varía por línea es un desfase CHICO y
// una amplitud que crece apenas; y la "ondulación viva" nace de que las DOS
// ondas del segundo término viajan en SENTIDOS OPUESTOS a distinta velocidad,
// no de que cada línea vaya a su propio ritmo.
//
// LO QUE ESTE SLICE NO PUDO PRESERVAR, Y POR QUÉ (ver DECISIONS.md,
// PANEL-LOGIN-HORIZONTE-FAMILIA-1, para el razonamiento completo): la SEGUNDA
// onda de la ley de arriba viaja en sentido CONTRARIO a la primera, a otra
// velocidad — eso es un patrón que se DEFORMA con el tiempo (las dos ondas se
// deslizan una respecto de la otra), no un patrón que se TRASLADA. Una forma
// que se deforma cuadro a cuadro exige recalcular geometría en JS, que es
// exactamente lo que esta pantalla —donde se teclea una contraseña— no puede
// pagar (§ DunaPie.tsx, la misma restricción que ya obligaba al `<animateMotion>`
// del sol que el slice anterior reemplazó). La salida que el propio spec
// autoriza: UNA sola onda viajera (rígida — toda la familia se traslada JUNTA,
// a la MISMA velocidad y el MISMO sentido), con el desfase y el crecimiento de
// amplitud por línea que la ley pide. Se pierde la segunda onda; se conserva el
// hilo principal (100% CSS `transform`, cero JS por cuadro).
//
// `DunaPie.tsx` SOLO consume esto y pinta; toda decisión de forma vive acá,
// testeada en `duna-horizonte.test.ts` — incluido el INVARIANTE que este slice
// existe para imponer: ningún par de líneas se cruza jamás.

export const HORIZONTE_ANCHO = 1440; // viewBox width — sin cambio
export const HORIZONTE_ALTO = 240; // viewBox height — sin cambio

export const HORIZONTE_NUM_LINEAS = 8;
/** Las últimas N líneas (las más al FRENTE) son de acento (ámbar); el resto, neutras.
 *  Subió de 2 a 3 (§ la referencia: "el ámbar ocupa una BANDA, no un par de trazos").
 *  Constante nombrada y junto a `HORIZONTE_NUM_LINEAS` A PROPÓSITO: el owner las va
 *  a mover al mirar el resultado, y tiene que ser un cambio de una línea. */
export const HORIZONTE_NUM_AMBAR = 3;

// Baseline vertical de la línea más ATRÁS (índice 0); las demás se derivan sumando
// la SEPARACIÓN (ver `separacionVertical`, abajo) — ya no hay un `Y_FRENTE` fijo:
// la posición de la línea más al frente es lo que RESULTA de correr N líneas con
// esa separación, no un segundo número que pudiera divergir del primero.
const Y_BASE_ATRAS = 40;

// Amplitud de la ONDA ÚNICA (§ arriba, "se pierde la segunda onda"): la línea más
// atrás lleva `AMPLITUD_BASE`; cada línea hacia el frente crece "apenas"
// (`AMPLITUD_PASO`) — análogo al `+i·1.5` de la ley de referencia, escalado a
// nuestras unidades de viewBox (that `1.5` no es directamente nuestro píxel: la
// referencia no fija una escala común, así que el paso se eligió PEQUEÑO respecto
// de la base, que es la propiedad que la ley pide ("crece apenas"), no el número
// exacto).
const AMPLITUD_BASE = 6;
const AMPLITUD_PASO = 0.5;

// Longitud de onda: la MISMA para TODAS las líneas (§ la ley: "las frecuencias no
// dependen de i") — a diferencia de la versión anterior, que la hacía crecer con
// el índice a propósito para que las líneas "no lucieran como copias calcadas".
// Acá la variación viene del desfase y la amplitud, no del período.
const PERIODO_PX = 420;

// El desfase de cada línea, en RADIANES sobre el argumento de la onda (no en
// fracción de período): `i · FASE_PASO_RAD`, tomado directo del primer término de
// la ley de referencia (`i·0.30`) -- el término que SÍ se conserva, ya que el
// segundo (`i·0.50`) pertenecía a la onda que se pierde (§ arriba).
const FASE_PASO_RAD = 0.30;

// Separación vertical extra, POR ENCIMA de la mínima matemáticamente necesaria
// (`separacionMinima`, abajo) -- para que las líneas queden VISIBLEMENTE
// distintas, no apenas sin tocarse. Es aire, no parte de la prueba del invariante.
const MARGEN_SEPARACION = 3;

// Opacidad: decae hacia el fondo. 0.5 en el frente es EL MISMO valor que llevaba
// la cresta única (§ DunaPie histórico) y que llevaba la línea más al frente en
// la versión anterior de este archivo — se conserva, no se re-litiga (§4 del
// spec: "tokens, modo claro/oscuro... como quedaron").
const OPACIDAD_MIN = 0.12;
const OPACIDAD_MAX = 0.5;

// LA VELOCIDAD Y EL SENTIDO SON COMPARTIDOS POR TODA LA FAMILIA — es lo que hace
// que se lean como UNA superficie que se desliza, no como trazos independientes
// (§ la ley: "el tiempo entra con el mismo signo y la misma velocidad para
// todas"). Antes eran POR LÍNEA (`duracionDeLinea`, `direccion: indice % 2`); acá
// son constantes ÚNICAS, exportadas para que `DunaPie.tsx` las aplique IGUAL a
// cada trazo -- estructuralmente imposible reintroducir una velocidad o un
// sentido distinto por línea sin tocar estos dos nombres.
export const HORIZONTE_DURACION_S = 20;
export const HORIZONTE_DIRECCION: 1 | -1 = 1;

// Puntos por período antes de suavizar a Bézier — suficiente para que la curva
// se lea lisa a cualquier ancho de pantalla real.
const MUESTRAS_POR_PERIODO = 24;

/** La amplitud de la línea `indice` -- crece apenas hacia el frente (§ arriba). */
export function amplitudDeLinea(indice: number): number {
  return AMPLITUD_BASE + indice * AMPLITUD_PASO;
}

/**
 * La separación MÍNIMA entre baselines VECINAS para que dos líneas nunca se
 * crucen, cualquiera sea su fase relativa -- EL INVARIANTE DE ESTE SLICE,
 * DERIVADO, no elegido a ojo.
 *
 * Dos senoidales de la MISMA frecuencia, amplitudes A y A', con cualquier
 * desfase entre sí, cumplen por desigualdad triangular:
 *
 *   |A·sin(θ+φ) − A'·sin(θ+φ')| ≤ A·|sin(θ+φ)| + A'·|sin(θ+φ')| ≤ A + A'
 *
 * para TODO θ, φ, φ' (cada |sin| ≤ 1). O sea que la diferencia entre dos
 * líneas vecinas nunca baja de `−(A+A')`, así que basta con que la separación
 * de baseline SUPERE la suma de sus amplitudes para blindar ese par -- sin
 * necesitar saber en qué fase relativa están.
 *
 * Como la amplitud CRECE con el índice (`amplitudDeLinea`), el par más exigente
 * es el de las DOS líneas más al frente (mayor amplitud); usar el DOBLE de la
 * amplitud MÁXIMA como separación cubre ese par -- y por monotonía, cubre
 * también a todos los pares menos exigentes detrás. Es MÁS separación de la
 * estrictamente necesaria para los pares traseros, pero una separación
 * CONSTANTE (no creciente por par) es más simple de razonar y de testear, y el
 * costo es sólo unos pocos px de aire de más en la parte trasera.
 */
function separacionMinima(numLineas: number): number {
  if (numLineas <= 1) return 0;
  const amplitudMax = amplitudDeLinea(numLineas - 1);
  return 2 * amplitudMax;
}

function separacionVertical(numLineas: number): number {
  return separacionMinima(numLineas) + MARGEN_SEPARACION;
}

function yBaseDeLinea(indice: number, numLineas: number): number {
  return Y_BASE_ATRAS + indice * separacionVertical(numLineas);
}

/** Decae hacia el fondo: índice 0 (más lejos) es el más tenue. */
export function opacidadDeLinea(indice: number, total: number): number {
  if (total <= 1) return OPACIDAD_MAX;
  return OPACIDAD_MIN + (OPACIDAD_MAX - OPACIDAD_MIN) * (indice / (total - 1));
}

/** Las últimas `numAcento` líneas (las más al frente) llevan el ámbar de marca. */
export function esAcento(indice: number, total: number, numAcento: number): boolean {
  const n = Math.max(0, Math.min(numAcento, total));
  return indice >= total - n;
}

/** El desfase (en unidades de x del viewBox) del término de fase en RADIANES de
 *  la línea `indice` -- convierte `indice · FASE_PASO_RAD` (radianes) a píxeles
 *  sobre el argumento `2π·x/periodo` de `alturaOnda`. */
export function faseDeLinea(indice: number, periodo: number): number {
  return ((indice * FASE_PASO_RAD) / (2 * Math.PI)) * periodo;
}

/**
 * La altura de la ONDA ÚNICA en x (§ arriba: se perdió el segundo armónico de la
 * versión anterior al perderse la segunda onda de la ley de referencia). Un seno
 * puro, parametrizado por su propia amplitud -- ya no hay un `AMPLITUD_1`/
 * `AMPLITUD_2` compartido por todas las líneas: cada línea trae la suya
 * (`amplitudDeLinea`).
 */
export function alturaOnda(x: number, periodo: number, faseLinea: number, amplitud: number): number {
  return amplitud * Math.sin((2 * Math.PI * (x + faseLinea)) / periodo);
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

function pathDeLinea(x0: number, x1: number, y: number, periodo: number, faseLinea: number, amplitud: number): string {
  const paso = periodo / MUESTRAS_POR_PERIODO;
  const puntos: Punto[] = [];
  for (let x = x0; x <= x1 + paso / 2; x += paso) {
    puntos.push({ x, y: y + alturaOnda(x, periodo, faseLinea, amplitud) });
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
  /** Longitud (px, en unidades del viewBox) que hay que trasladar para un loop exacto
   *  -- LA MISMA para toda la familia (§ `PERIODO_PX`), repetida acá sólo porque
   *  cada `<path>` necesita su propio valor de `--h-periodo` en `style`. */
  periodoPx: number;
};

/**
 * Construye las `numLineas` líneas del horizonte. Determinista — sin `Math.random`,
 * así que no hace falta resolverlo en el cliente: el mismo render en servidor y en
 * cliente.
 */
export function construirHorizonte(
  numLineas: number = HORIZONTE_NUM_LINEAS,
  numAmbar: number = HORIZONTE_NUM_AMBAR,
  ancho: number = HORIZONTE_ANCHO,
): LineaHorizonte[] {
  const lineas: LineaHorizonte[] = [];
  for (let indice = 0; indice < numLineas; indice++) {
    const y = yBaseDeLinea(indice, numLineas);
    const x0 = -PERIODO_PX;
    const x1 = ancho + PERIODO_PX;
    const fase = faseDeLinea(indice, PERIODO_PX);
    const amplitud = amplitudDeLinea(indice);
    lineas.push({
      indice,
      acento: esAcento(indice, numLineas, numAmbar),
      d: pathDeLinea(x0, x1, y, PERIODO_PX, fase, amplitud),
      x0,
      x1,
      y,
      opacidad: opacidadDeLinea(indice, numLineas),
      periodoPx: PERIODO_PX,
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
// El punto más alto de TODO el horizonte es el de la línea más ATRÁS (índice 0):
// su "top reach" es `yBaseDeLinea(i) − amplitudDeLinea(i) = (Y_BASE_ATRAS −
// AMPLITUD_BASE) + i·(SEP − AMPLITUD_PASO)`, y como `SEP` (≈22, § arriba) es MUCHO
// mayor que `AMPLITUD_PASO` (0.5), ese coeficiente de `i` es positivo -- el "top
// reach" CRECE con el índice, así que el mínimo (el punto más alto) se da en
// i=0. Por eso alcanza con la amplitud de la línea trasera, no con la máxima.
export const HORIZONTE_AMPLITUD_MAX = amplitudDeLinea(HORIZONTE_NUM_LINEAS - 1);
export const HORIZONTE_TOPE_Y = Y_BASE_ATRAS - amplitudDeLinea(0);

/**
 * Fracción del ANCHO del viewport a reservar como banda inferior — misma cuenta
 * que ya hacía la versión anterior (distancia del punto más alto al borde
 * inferior del viewBox, como fracción del ancho, porque el SVG escala
 * `width:100%, height:auto`). El consumidor la redondea hacia ARRIBA (nunca hacia
 * abajo: cruzar contenido es peor que sobrar aire) — ver `PreAuthShell`.
 */
export const HORIZONTE_BANDA_FRACCION = (HORIZONTE_ALTO - HORIZONTE_TOPE_Y) / HORIZONTE_ANCHO;
