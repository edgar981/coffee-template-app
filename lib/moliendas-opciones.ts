// LA regla de `Product.moliendasOpciones`, una sola vez, para los TRES
// consumidores: la card del catálogo, la página de detalle y la validación del
// servidor.
//
// OJO — son DOS campos distintos y este módulo gobierna UNO SOLO:
//   `Product.moliendasOpciones` (Json) → las opciones que el CLIENTE elige en la
//     página de producto. Es lo único que se decide acá.
//   `Product.molienda` (String) → ficha técnica de la variante ("esta bolsa es
//     molienda Media"). Texto descriptivo del producto; NO se lee ni se escribe
//     desde acá, y no debe fusionarse con el anterior.
// El archivo se llamó `lib/molienda.ts` un rato y el nombre invitaba justo a esa
// confusión; de ahí el plural.
//
// Existe por un bug concreto: había dos formas de construir una línea de carrito.
// La página de detalle preseleccionaba la primera molienda disponible y la
// mandaba; la card llamaba `addItem(product, 1)` sin opciones, así que el checkout
// enviaba `molienda: null` y el servidor —que exige una molienda válida cuando el
// producto declara opciones— devolvía 400 "Molienda no disponible" en el último
// paso del pago. Todos los productos del catálogo declaran opciones, así que
// cualquier cosa agregada desde la vitrina era incompraable.
//
// Que el arreglo sea "un módulo" y no "un `if` en la card" es el punto: el fallo
// no fue que la card estuviera mal, fue que la regla vivía en dos cabezas. El
// próximo punto de agregar (una quick-add, un "volver a pedir", una landing) tiene
// que heredar la regla, no reinventarla.
//
// PURO Y CLIENT-SAFE: sin Prisma, sin `server-only`, sin next/headers — lo importa
// tanto un componente cliente como `resolveOrderLines` del lado servidor.

/** Forma de `Product.moliendasOpciones` (columna Json en Prisma). */
export interface MoliendaOpcion {
  nombre: string;
  metodo: string;
  disponible: boolean;
}

/**
 * Normaliza la columna Json a una lista utilizable. Cualquier cosa que no sea un
 * array —null, un objeto, un dato viejo— se trata como "sin opciones declaradas",
 * que es el caso permisivo: un producto que no pide molienda no puede bloquear una
 * venta por un dato mal formado.
 */
export function normalizarOpciones(raw: unknown): MoliendaOpcion[] {
  return Array.isArray(raw) ? (raw as MoliendaOpcion[]).filter(Boolean) : [];
}

/** Las que el cliente puede elegir de verdad. */
export function moliendasDisponibles(raw: unknown): MoliendaOpcion[] {
  return normalizarOpciones(raw).filter(o => Boolean(o?.disponible));
}

/**
 * La decisión del CLIENTE, por cardinalidad de lo disponible. Es lo que separa
 * "agregar directo desde la card" de "mandar al detalle a elegir".
 *
 *   `ninguna`    → el producto no declara opciones: se agrega sin molienda.
 *   `automatica` → hay exactamente UNA disponible: no hay nada que preguntar, se
 *                  preselecciona y se agrega directo. Un desplegable de un solo
 *                  ítem es fricción disfrazada de elección.
 *   `eleccion`   → hay VARIAS: la elección es real y se toma en el detalle, donde
 *                  cada opción muestra su método ("Prensa francesa", "V60").
 *   `agotada`    → declara opciones y ninguna está disponible: tampoco se agrega
 *                  desde la card. Se manda al detalle, que es donde el cliente ve
 *                  cuáles están deshabilitadas y por qué.
 */
export type DecisionMolienda =
  | { modo: 'ninguna' }
  | { modo: 'automatica'; nombre: string }
  | { modo: 'eleccion' }
  | { modo: 'agotada' };

export function decidirMolienda(raw: unknown): DecisionMolienda {
  if (normalizarOpciones(raw).length === 0) return { modo: 'ninguna' };

  const disponibles = moliendasDisponibles(raw);
  if (disponibles.length === 0) return { modo: 'agotada' };
  if (disponibles.length === 1) return { modo: 'automatica', nombre: disponibles[0].nombre };
  return { modo: 'eleccion' };
}

/** ¿Se puede agregar al carrito sin salir de la card? */
export function agregableDirecto(raw: unknown): boolean {
  const d = decidirMolienda(raw);
  return d.modo === 'ninguna' || d.modo === 'automatica';
}

/**
 * La molienda con la que nace una línea desde la card: el nombre cuando se resuelve
 * sola, `null` cuando el producto no declara opciones. No se llama en los modos que
 * exigen ir al detalle.
 */
export function moliendaPorDefecto(raw: unknown): string | null {
  const d = decidirMolienda(raw);
  return d.modo === 'automatica' ? d.nombre : null;
}

/**
 * La regla del SERVIDOR, sin cambios respecto de la que ya aplicaba
 * `resolveOrderLines` — se extrajo aquí para poder testearla y para que el
 * cliente no pueda alejarse de ella, NO para relajarla. Sigue siendo el servidor
 * quien manda: el cliente propone la molienda, esto decide si la línea es legal.
 *
 * Un producto sin opciones declaradas acepta cualquier cosa (incluida `null`);
 * uno que sí declara exige una que exista Y esté disponible. `null` no significa
 * "grano entero" en ninguna parte del sistema — el grano tiene su opción con
 * nombre propio, y la pantalla nunca renderiza una molienda ausente como texto.
 */
export function moliendaAceptada(raw: unknown, molienda: string | null | undefined): boolean {
  const opciones = normalizarOpciones(raw);
  if (opciones.length === 0) return true;
  if (!molienda) return false;
  const opcion = opciones.find(o => o?.nombre === molienda);
  return Boolean(opcion && opcion.disponible);
}
