import type { BrandStoryContent } from '../config/site-content-defaults';

// «Ficha de finca» (§ HISTORIA-FICHA-DE-FINCA-1) — la TERCERA composición de `brandStory` ("Nuestra
// Historia"). Lógica PURA de qué filas se muestran y cómo se posiciona/rotula la ilustración de
// montañas — nada de esto toca el DOM ni requiere montar un componente, así que se afirma en capa 1
// sin renderizar. El componente (`BrandStoryFichaDeFinca.tsx`) sólo CONSUME lo que este módulo
// calcula.

// ─── LAS FILAS DE LA FICHA (2 a 6 slots, campos PLANOS) ──────────────────────────────────────────

export interface FichaFila {
  rotulo: string;
  valor: string;
  /** Línea chica debajo del valor (p. ej. "Supatá, Cundinamarca" bajo "Providencia"). Opcional: una
   *  fila sin ella simplemente no la pinta. */
  subLinea: string;
}

/**
 * Las filas PRESENTES de la ficha, en orden, compactando huecos.
 *
 * Una fila se muestra sólo si TIENE rótulo Y valor — AND, no OR (a diferencia de
 * `tarjetasDePresentaciones`, § su docstring): ahí el OR deja aparecer una tarjeta a medio llenar
 * como pista visible de que falta la foto. Acá una fila con sólo rótulo ("Finca:" sin nada
 * delante) o sólo valor ("Nayoli" sin decir qué es) no es una pista de que falta algo — es un dato
 * roto, y el criterio existe para no mostrarlo. `subLinea` no participa del criterio: una fila
 * completa sin sub-línea sigue siendo una fila completa.
 */
export function filasFicha(b: BrandStoryContent): FichaFila[] {
  const slots: FichaFila[] = [
    { rotulo: b.fila1Rotulo, valor: b.fila1Valor, subLinea: b.fila1SubLinea },
    { rotulo: b.fila2Rotulo, valor: b.fila2Valor, subLinea: b.fila2SubLinea },
    { rotulo: b.fila3Rotulo, valor: b.fila3Valor, subLinea: b.fila3SubLinea },
    { rotulo: b.fila4Rotulo, valor: b.fila4Valor, subLinea: b.fila4SubLinea },
    { rotulo: b.fila5Rotulo, valor: b.fila5Valor, subLinea: b.fila5SubLinea },
    { rotulo: b.fila6Rotulo, valor: b.fila6Valor, subLinea: b.fila6SubLinea },
  ];
  return slots.filter((s) => s.rotulo.trim() !== '' && s.valor.trim() !== '');
}

// ─── LA ILUSTRACIÓN — geometría FIJA (540×675, el 4:5 de la maqueta aprobada), sólo las ETIQUETAS y
// la PRESENCIA de la franja dependen del dato ───────────────────────────────────────────────────

/** El viewBox de la ilustración — el MISMO 4:5 que la foto (`Foto usa imagen1, 4:5`, § el spec), así
 *  que elegir entre Ilustración y Foto no cambia la proporción de la celda. */
export const FICHA_VIEWBOX_W = 540;
export const FICHA_VIEWBOX_H = 675;

/** Posición horizontal FIJA del punto de la finca — la de la maqueta aprobada (`transform(214 300)`). */
export const PUNTO_FINCA_X = 214;

/** Y del punto CON franja activa: dentro de la banda, en una posición FIJA (no proporcional al
 *  rango) — no hay un tercer dato (la altitud EXACTA de la finca) que la ubique con precisión dentro
 *  del rango min-max, así que se posiciona como la maqueta aprobada, estéticamente centrada en la
 *  banda. */
const PUNTO_FINCA_Y_EN_FRANJA = 300;

/** Y del punto SIN franja: "el punto queda en la cresta" (§ el spec) — una posición FIJA cerca de la
 *  silueta más alta de las tres crestas decorativas. Aproximada a propósito: seguir la curva exacta
 *  del trazo en ese X exigiría parsear la geometría del path por una ganancia puramente estética. */
const PUNTO_FINCA_Y_EN_CRESTA = 180;

export interface FranjaAltitud {
  /** Y de la cota SUPERIOR (altitud máxima) — fija, la de la maqueta aprobada. */
  yTop: number;
  /** Y de la cota INFERIOR (altitud mínima) — fija, la de la maqueta aprobada. */
  yBottom: number;
  /** "{max} {unidad}", para la cota de arriba. Sin unidad, es sólo el número. */
  etiquetaMax: string;
  /** "{min} {unidad}", para la cota de abajo. */
  etiquetaMin: string;
}

const FRANJA_Y_SUPERIOR = 236;
const FRANJA_Y_INFERIOR = 406;

/**
 * La franja de altitud — o `null` si el rango no está completo.
 *
 * "Sin rango, no hay franja ni cotas" (§ el spec): un rango es MIN Y MAX juntos — con sólo uno de
 * los dos, no hay par que mostrar, así que cuenta como ausente. La UNIDAD es independiente: vacía,
 * la etiqueta es sólo el número ("1.650"), nunca un número con un hueco raro donde iría la unidad.
 *
 * Las posiciones (`yTop`/`yBottom`) son FIJAS — la banda ocupa siempre la misma región de la
 * ilustración, sea cual sea la magnitud real del rango (una finca entre 0-100 msnm y una entre
 * 1.000-4.000 msnm dibujan la MISMA franja, con etiquetas distintas): es una ilustración
 * estilizada, no un gráfico de elevación a escala.
 */
export function franjaAltitud(min: string, max: string, unidad: string): FranjaAltitud | null {
  const minT = min.trim();
  const maxT = max.trim();
  if (!minT || !maxT) return null;
  const u = unidad.trim();
  return {
    yTop: FRANJA_Y_SUPERIOR,
    yBottom: FRANJA_Y_INFERIOR,
    etiquetaMax: u ? `${maxT} ${u}` : maxT,
    etiquetaMin: u ? `${minT} ${u}` : minT,
  };
}

/** La posición del punto de la finca — dentro de la franja si hay una activa, o en la cresta si no. */
export function puntoFinca(franja: FranjaAltitud | null): { x: number; y: number } {
  return { x: PUNTO_FINCA_X, y: franja ? PUNTO_FINCA_Y_EN_FRANJA : PUNTO_FINCA_Y_EN_CRESTA };
}

// ─── LOS DOS RÓTULOS DE TEXTO DE LA ILUSTRACIÓN ──────────────────────────────────────────────────

/**
 * El rótulo superior ("✦ SUPATÁ · CUNDINAMARCA ✦" en la maqueta) — `null` si `lugar` está vacío, y
 * el componente simplemente no lo dibuja (opcional → se omite, § la doctrina de defaults).
 */
export function rotuloSuperior(lugar: string): string | null {
  const t = lugar.trim();
  return t ? `✦ ${t} ✦` : null;
}

/**
 * El pie DIBUJADO DENTRO del SVG ("CASTILLO · LAVADO" en la maqueta) — DISTINTO del `<figcaption>`
 * de la figura entera (`pieMedio`, que vive en el componente, no acá: es texto plano fuera del SVG,
 * sin posición que calcular). `null` si está vacío.
 */
export function pieSvgIlustracion(pie: string): string | null {
  const t = pie.trim();
  return t || null;
}
