/**
 * EL BREAKPOINT, del lado de JS.
 *
 * ── Por qué existe un gemelo, y por qué no se puede evitar ──────────────────
 *
 * El número vive en dos sitios y ninguno de los dos puede leer al otro:
 *
 *   • una media query NO puede leer una custom property
 *     (`@media (max-width: var(--x))` es CSS inválido), así que el literal de
 *     `primitives.css` no puede salir de un token;
 *   • y el CSS no puede decidir DÓNDE se renderiza un nodo. Debajo del
 *     breakpoint el detalle no se esconde: se monta en otro sitio (un sheet
 *     portaleado a <body>). Eso es una decisión de árbol, no de estilo, y sólo
 *     la puede tomar quien construye el árbol.
 *
 * Se evaluó resolverlo con un elemento centinela cuyo `display` cambia en el
 * breakpoint, leído con un ResizeObserver: deja UNA fuente, pero cambia un valor
 * legible por un mecanismo que hay que descifrar. Un gemelo declarado se
 * mantiene; un truco no se entiende.
 *
 * ── LA REGLA: SE MUEVEN JUNTOS ─────────────────────────────────────────────
 *
 * Si este archivo y el `@media` de `primitives.css` discrepan, el síntoma NO es
 * que algo se vea corrido. Es una franja de anchos donde el panel ya apiló y el
 * sheet todavía no monta —el detalle queda inalcanzable— o donde los dos están a
 * la vez y el detalle se duplica en el árbol de accesibilidad. Ninguno de los dos
 * se ve como un breakpoint desalineado.
 *
 * El valor y su derivación están en `primitives.css`, sobre `.duna-split`. Acá no
 * se repite el porqué a propósito: dos explicaciones del mismo número es cómo
 * empiezan a decir cosas distintas.
 */
// Nombrado por ROL —"¿el detalle cabe al lado?"—, no por dispositivo. El chrome
// (rail, barra inferior) tiene su PROPIO breakpoint y su propia pregunta ("¿es una
// pantalla táctil de una mano?"); no son el mismo número por casualidad, y no
// deben quedar soldados. Hoy los dos valen 960; el umbral del split se derivará
// del piso del panel (`--duna-panel-min`) en su commit.
export const DUNA_BP_DETALLE_AL_LADO = 960;

/**
 * La consulta lista para `matchMedia`, DERIVADA de la constante — dentro de este
 * archivo hay un solo número.
 *
 * El `- 0.02` es el mismo corte sub-píxel que usan las media queries del CSS, y
 * está por la misma razón: el otro lado del breakpoint se expresa con
 * `min-width: 960px`, así que un `max-width: 960px` se SOLAPARÍA con él a
 * exactamente 960 — las dos mitades activas a la vez. Los anchos pueden ser
 * fraccionarios (zoom, densidad), de ahí `.98` y no `959`.
 *
 * El umbral es 960 y el criterio es el mismo en los tres sitios: DEBAJO de 960 es
 * angosto; 960 exacto ya es ancho.
 */
export const DUNA_MQ_DETALLE_AL_LADO = `(max-width: ${DUNA_BP_DETALLE_AL_LADO - 0.02}px)`;
