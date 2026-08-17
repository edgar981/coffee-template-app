/**
 * LOS BREAKPOINTS DE LAYOUT, del lado de JS — y son DOS, por ROL, no por
 * dispositivo. La distinción es la que ordena todo lo de abajo:
 *
 *   • DETALLE_AL_LADO (1080) — "¿caben dos columnas?". Decide si el detalle es el
 *     panel del split (al lado) o sube como sheet. Se DERIVA del piso del panel
 *     (`--duna-panel-min`, 320): con la lista en `--duna-list-w` (400), el gap, el
 *     rail y el padding del shell, el split sólo cabe con el panel ≥ 320 a partir
 *     de ~1080 (aritmética, no número redondo).
 *   • SHEET_ABAJO (960) — "¿es una pantalla táctil de una mano?". Cuando el detalle
 *     YA es sheet (debajo de 1080), decide de qué borde sale: `--abajo` en el
 *     chrome móvil (<960: barra inferior, safe-area, ancho completo) o `--lado`
 *     junto al rail (960–1080). Es el MISMO umbral que el chrome (rail/barra), y
 *     por eso comparte su número.
 *
 * No son el mismo número por casualidad y NO deben quedar soldados: nombrar el
 * primero "móvil" fue el error que este rename cerró.
 *
 * ── Por qué existe un gemelo en JS, y por qué no se puede evitar ─────────────
 *
 *   • una media query NO puede leer una custom property (`@media (max-width:
 *     var(--x))` es CSS inválido), así que el literal de `primitives.css` no puede
 *     salir de un token;
 *   • y el CSS no puede decidir DÓNDE se renderiza un nodo. Debajo del umbral el
 *     detalle no se esconde: se monta en otro sitio (un sheet portaleado). Eso es
 *     una decisión de árbol, no de estilo, y sólo la puede tomar quien lo construye.
 *
 * ── LA REGLA: CADA UMBRAL SE MUEVE CON SU GEMELO CSS ────────────────────────
 *
 * `DUNA_MQ_DETALLE_AL_LADO` ↔ el `@media` del colapso de `.duna-split`
 * (primitives.css). `DUNA_MQ_SHEET_ABAJO` ↔ el `@media` del swap de chrome
 * (`.duna-nav-*`) y la variante `duna:` (960). Si un par discrepa, el síntoma NO
 * es que algo se vea corrido: es una franja donde el panel ya apiló y el sheet no
 * monta —el detalle inalcanzable—, o donde los dos están a la vez y el detalle se
 * duplica en el árbol de accesibilidad. Ninguno se ve como un breakpoint
 * desalineado. El `- 0.02` es el corte sub-píxel de siempre (el otro lado se
 * expresa con `min-width`, y a un píxel exacto se solaparían).
 */
export const DUNA_BP_DETALLE_AL_LADO = 1080;
export const DUNA_MQ_DETALLE_AL_LADO = `(max-width: ${DUNA_BP_DETALLE_AL_LADO - 0.02}px)`;

export const DUNA_BP_SHEET_ABAJO = 960;
export const DUNA_MQ_SHEET_ABAJO = `(max-width: ${DUNA_BP_SHEET_ABAJO - 0.02}px)`;
