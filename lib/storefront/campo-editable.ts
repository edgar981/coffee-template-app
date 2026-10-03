// LA LÓGICA PURA del campo editable (§ EDITOR-TIENDA-CAMPO-EDITABLE-1, docs/editor-tienda/
// EDICION-INLINE.md § 2 — "el campo flotante"). Sin `window`/DOM/React: rutas de campo y la fusión
// que produce el PARCIAL que `TiendaSeccionEditor.cambiar()` ya consume. Dos consumidores:
//   - `components/storefront/EditorPuenteVivo.tsx` (el iframe) — parsea la ruta COMPLETA que
//     `CampoEditable` marca en el DOM (`data-editor-campo="hero.titulo"`) para saber a qué SECCIÓN
//     avisar y qué CAMPO relativo manda en el mensaje.
//   - `components/admin/TiendaSeccionEditor.tsx` (el panel) — aplica `fusionCampoEditable` sobre su
//     `form` EN MEMORIA para construir el mismo parcial que ya produce `cambiar()` manual, sin
//     reimplementar la fusión de un repeater a mano en dos lugares.
//
// MISMO criterio que `editor-puente.ts`: puro, testeado sin DOM — el componente impuro hace el
// `getBoundingClientRect`/`getComputedStyle`/`postMessage` y llama a esto.

export interface RutaCampo {
  /** La sección del REGISTRY (`site-content-defaults.ts`), p. ej. 'hero'. */
  seccion: string;
  /** El campo DENTRO de esa sección — plano ('titulo') o de ítem de repeater ('items.0.text'). */
  campo: string;
}

// ─── EL MARCADOR DE IMAGEN/VIDEO (§ EDITOR-TIENDA-CAMPO-EDITABLE-IMAGEN-1) ─────────────────────────
//
// Un clic en una imagen/video marcado NUNCA abre el overlay de texto — abre el selector de archivos
// REAL del panel (§ EDICION-INLINE.md § 4). Por eso lleva su PROPIO atributo DOM, distinto de
// `ATRIBUTO_EDITOR_CAMPO` (el de texto, `lib/admin/editor-iframe.ts`): los dos marcadores nunca
// compiten por el mismo nodo, y `EditorPuenteVivo.tsx` decide el comportamiento mirando CUÁL de los
// dos matchea, sin tener que consultar el REGISTRY (`site-content-defaults.ts`) en cada clic.
//
// Vive ACÁ y no junto a `ATRIBUTO_EDITOR_CAMPO` en `lib/admin/editor-iframe.ts` porque ese archivo
// no está en `touches:` de este slice; los dos comparten la MISMA convención de nombre
// (`data-editor-campo*`), no el mismo módulo — ambos son leídos por `CampoEditable.tsx` (quien los
// escribe) y `EditorPuenteVivo.tsx` (quien los lee), los dos SÍ en `touches:`.
export const ATRIBUTO_EDITOR_CAMPO_IMAGEN = 'data-editor-campo-imagen';

/**
 * Parsea la ruta COMPLETA que `CampoEditable` declara (`campo="hero.titulo"` o
 * `campo="testimonials.items.0.text"`) en su sección y su campo relativo — el primer punto separa
 * las dos mitades, el resto (si lo hay, para la forma de ítem) queda del lado del campo.
 *
 * `null` si la ruta no tiene un punto con algo de los DOS lados: una ruta sin sección ("titulo"),
 * sin campo ("hero.") o vacía no debe producir una sección/campo vacíos que alguien interprete
 * como válidos más abajo — preferir CALLAR a adivinar (§ CLAUDE.md, "preferir callar a afirmar sin
 * base").
 */
export function parsearRutaCampo(ruta: string): RutaCampo | null {
  const i = ruta.indexOf('.');
  if (i <= 0 || i === ruta.length - 1) return null;
  return { seccion: ruta.slice(0, i), campo: ruta.slice(i + 1) };
}

/**
 * El PARCIAL que `TiendaSeccionEditor.cambiar()` espera (un objeto que se mezcla por encima del
 * `form` actual de la sección), dado el campo RELATIVO (ya sin la sección — `parsearRutaCampo` la
 * separó) y el `valor` tecleado. Dos formas, las DOS que `CampoEditable` puede marcar (§ EDICION-
 * INLINE.md § 2.3):
 *
 *  - PLANO ('titulo') → `{ titulo: valor }`, igual que cualquier `set(name)` de la lista.
 *  - DE ÍTEM DE REPEATER ('items.N.subcampo') → relee el array `items` del `formActual` (lo
 *    necesita para no pisar los demás ítems ni los demás campos del MISMO ítem — el mensaje sólo
 *    trae el valor de UN campo) y devuelve `{ items: nuevoArray }` con SÓLO ese ítem reemplazado
 *    por una copia con el subcampo nuevo. El array y el ítem se COPIAN (nunca se muta el original):
 *    mismo criterio de inmutabilidad que ya usa `cambiar`/`RepeaterEditor`.
 *
 * `null` si la ruta no se puede aplicar con seguridad — un índice fuera de rango, un `items` que no
 * es array todavía (la sección no cargó, o no es un repeater), un ítem que no es un objeto, o
 * cualquier forma que no sea ni "plano" ni "items.N.subcampo" (dos puntos exactos). Preferir callar
 * a escribir un parcial que corrompa el form: el próximo mensaje (la próxima tecla) lo reintenta
 * igual, así que perder uno no pierde el tecleo.
 */
export function fusionCampoEditable(
  formActual: Record<string, unknown>,
  campo: string,
  valor: string,
): Record<string, unknown> | null {
  const partes = campo.split('.');

  if (partes.length === 1) {
    const [nombre] = partes;
    if (!nombre) return null;
    return { [nombre]: valor };
  }

  if (partes.length !== 3 || partes[0] !== 'items') return null;
  const indice = Number(partes[1]);
  const subcampo = partes[2];
  if (!Number.isInteger(indice) || indice < 0 || !subcampo) return null;

  const items = formActual.items;
  if (!Array.isArray(items) || indice >= items.length) return null;
  const item = items[indice];
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;

  const nuevoItem = { ...(item as Record<string, unknown>), [subcampo]: valor };
  const nuevosItems = items.slice();
  nuevosItems[indice] = nuevoItem;
  return { items: nuevosItems };
}

// ─── EL CAMPO FLOTANTE — geometría y tipografía, formateadas sin DOM ──────────────────────────────
//
// `EditorPuenteVivo.tsx` LEE el nodo real (`getBoundingClientRect`/`getComputedStyle`, impuro) y le
// pasa el resultado acá para construir el `style` del overlay — así la FORMA del objeto de estilo
// (qué propiedades, cómo se combinan) queda afirmable en un test sin montar nada en un navegador.

/** Lo que `getBoundingClientRect()` ya da en coordenadas de VIEWPORT — las mismas que usa
 *  `position: fixed`, así que no hace falta sumar `scrollX`/`scrollY`. */
export interface GeometriaCampo {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** El subconjunto de `getComputedStyle(nodo)` que hace que el overlay se vea "visualmente
 *  indistinguible del texto que tapa" (§ EDICION-INLINE.md § 2.2) — tipografía, color y el padding
 *  que ya tuviera el nodo real (un título con padding propio no debe perder su caja). Claves ya en
 *  camelCase de CSSProperties, para poder spread-earlas directo en el `style` de React. */
export interface TipografiaCampo {
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  fontStyle: string;
  lineHeight: string;
  letterSpacing: string;
  textAlign: string;
  textTransform: string;
  color: string;
  padding: string;
}

/**
 * El `style` del `<input>`/`<textarea>` flotante: geometría `position: fixed` (coincide con
 * `getBoundingClientRect`, sin traducir nada — mismo origen, mismo documento, § EDICION-INLINE.md
 * § 2.2 "ese costo desaparece porque el overlay vive DENTRO del MISMO documento"), tipografía
 * calcada del nodo real, y lo que hace falta para que un `<input>`/`<textarea>` NATIVO deje de
 * parecerlo (sin borde, sin fondo propio, sin resize de usuario, `box-sizing: border-box` para que
 * el padding copiado no agrande la caja medida).
 *
 * `zIndex` al máximo de un entero de 32 bits: el overlay tiene que quedar SIEMPRE por encima de
 * cualquier contenido de la página (el storefront no declara z-index propios por encima de ningún
 * chrome fijo conocido), sin tener que auditar la pila de capas de cada sección.
 */
export function estiloCampoFlotante(
  geometria: GeometriaCampo,
  tipografia: TipografiaCampo,
): Record<string, string | number> {
  return {
    position: 'fixed',
    top: geometria.top,
    left: geometria.left,
    width: geometria.width,
    height: geometria.height,
    margin: 0,
    border: 'none',
    outline: 'none',
    boxSizing: 'border-box',
    background: 'transparent',
    resize: 'none',
    ...tipografia,
    zIndex: 2147483647,
  };
}
