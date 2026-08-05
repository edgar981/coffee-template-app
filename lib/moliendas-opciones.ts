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

// ─── El EDITOR del admin ─────────────────────────────────────────────────────
// Las tres funciones de arriba LEEN el dato; estas dos gobiernan quién puede
// ESCRIBIRLO. Viven en el mismo módulo a propósito: editar `moliendasOpciones` no
// es llenar un campo más de la ficha, es operar la tienda —la cardinalidad de lo
// disponible decide si la card del catálogo agrega directo o manda al detalle— y
// la regla que valida la escritura tiene que estar al lado de la que interpreta
// la lectura. Puras y client-safe como el resto del archivo: las corren el
// formulario (aviso temprano) y el POST/PATCH (la que manda).

/**
 * Forma exacta que se persiste, a partir de lo que mande un formulario o un body.
 * Recorta espacios y descarta lo que no sea un objeto.
 *
 * A diferencia de `sanitizeGaleria`, NO descarta las filas con nombre vacío: eso
 * es trabajo de `validarOpciones`, que las REPORTA. Tirarlas en silencio haría
 * que una fila a medias desapareciera al guardar sin que nadie lo dijera, y el
 * operador la daría por creada. Una lista de opciones no es una lista de URLs:
 * cada fila es una decisión, no un adjunto.
 */
export function sanitizeOpciones(valor: unknown): MoliendaOpcion[] {
  if (!Array.isArray(valor)) return [];
  const salida: MoliendaOpcion[] = [];
  for (const item of valor) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    salida.push({
      nombre:     typeof o.nombre === 'string' ? o.nombre.trim() : '',
      metodo:     typeof o.metodo === 'string' ? o.metodo.trim() : '',
      disponible: Boolean(o.disponible),
    });
  }
  return salida;
}

/** Un problema del conjunto de opciones, con el texto ÚNICO que ven cliente y servidor. */
export interface ProblemaOpciones {
  codigo: 'nombre_vacio' | 'nombre_duplicado' | 'ninguna_disponible';
  /** Lo que se le dice al operador. Mismo string en el aviso del modal y en el 400. */
  mensaje: string;
  /** Filas señaladas. Vacío cuando el problema es del CONJUNTO, no de una fila. */
  indices: number[];
}

/**
 * Las tres reglas de una lista de opciones válida. Devuelve la lista de problemas
 * en el orden en que el operador los encuentra en el formulario; vacío = se puede
 * guardar. El servidor toma el primero para el 400; el cliente los pinta todos y
 * usa `indices` para marcar las filas.
 *
 * Una lista VACÍA es válida y es el caso más común: un producto sin opciones no
 * pide molienda y su card agrega directo. Las reglas solo aplican a partir de la
 * primera fila.
 *
 * 1. **Nombre no vacío** — es lo que se guarda en `OrderItem.moliendaSeleccionada`
 *    y lo que el cliente ve en el chip. Sin nombre no hay opción.
 * 2. **Único por producto**, comparando sin mayúsculas ni espacios: "Media" y
 *    "media " son la misma opción para quien la lee, y como el chequeo del
 *    servidor (`moliendaAceptada`) busca por nombre EXACTO, dos filas
 *    indistinguibles a la vista se comportarían distinto — una compraría y la otra
 *    daría 400.
 * 3. **Al menos una disponible** — la que impide la trampa: siete opciones con
 *    cero disponibles deja al producto en `agotada`, o sea sin poder agregarse
 *    desde la card NI comprarse desde el detalle (`moliendaAceptada` rechaza
 *    todas). El producto queda vivo en el catálogo y es incompraable, que es
 *    exactamente el bug de go-live que este módulo existe para no repetir. Para
 *    dejar de vender un producto está `activo`, no una lista de opciones muertas.
 */
export function validarOpciones(opciones: readonly MoliendaOpcion[]): ProblemaOpciones[] {
  const problemas: ProblemaOpciones[] = [];
  if (opciones.length === 0) return problemas;

  const clave = (nombre: string) => nombre.trim().toLowerCase();

  const vacios = opciones.flatMap((o, i) => (clave(o?.nombre ?? '') ? [] : [i]));
  if (vacios.length > 0) {
    problemas.push({
      codigo:  'nombre_vacio',
      mensaje: vacios.length === 1
        ? 'Hay una molienda sin nombre.'
        : `Hay ${vacios.length} moliendas sin nombre.`,
      indices: vacios,
    });
  }

  // Se señalan TODAS las filas de un nombre repetido, no solo la segunda: cuál de
  // las dos sobra es decisión del operador, y marcar una sola sugiere que la otra
  // está bien.
  const porClave = new Map<string, number[]>();
  opciones.forEach((o, i) => {
    const k = clave(o?.nombre ?? '');
    if (!k) return;                       // los vacíos ya tienen su problema
    porClave.set(k, [...(porClave.get(k) ?? []), i]);
  });
  const repetidos = [...porClave.entries()].filter(([, is]) => is.length > 1);
  if (repetidos.length > 0) {
    const nombres = repetidos.map(([, is]) => opciones[is[0]].nombre.trim());
    problemas.push({
      codigo:  'nombre_duplicado',
      mensaje: `Hay nombres repetidos: ${nombres.join(', ')}. Cada molienda debe llamarse distinto.`,
      indices: repetidos.flatMap(([, is]) => is),
    });
  }

  if (!opciones.some(o => o?.disponible)) {
    problemas.push({
      codigo:  'ninguna_disponible',
      mensaje: 'Deja al menos una molienda disponible: con todas apagadas el producto no se puede comprar. Para dejar de venderlo, desactívalo.',
      indices: [],
    });
  }

  return problemas;
}

/**
 * Las opciones que SOBREVIVEN al guardado: la lista sin las filas que el operador
 * marcó para quitar. Quitar es deshacible hasta guardar, así que las marcadas
 * siguen en la lista que se pinta pero no en la que se valida ni se manda.
 */
export function opcionesVivas(
  opciones: readonly MoliendaOpcion[],
  quitadas: ReadonlySet<number>,
): MoliendaOpcion[] {
  return opciones.filter((_, i) => !quitadas.has(i));
}

/**
 * Lo que el modal necesita saber de una edición en curso: qué se va a guardar y
 * qué está mal, con los problemas numerados sobre la lista COMPLETA.
 *
 * El remapeo es la razón de que esto sea una función y no tres líneas sueltas en
 * el componente: `validarOpciones` numera sobre las vivas y el editor pinta la
 * lista entera, así que sin traducir los índices el borde rojo cae en la fila de
 * al lado apenas hay una marcada por encima. Es un off-by-one que no rompe nada
 * —se guarda bien igual— y que por eso mismo nadie ve hasta que confunde a un
 * operador.
 *
 * Una fila marcada NO puede bloquear el guardado: ni por estar sin nombre, ni
 * contando para la regla de "al menos una disponible".
 */
export function revisarEdicion(
  opciones: readonly MoliendaOpcion[],
  quitadas: ReadonlySet<number>,
): { vivas: MoliendaOpcion[]; problemas: ProblemaOpciones[] } {
  const indicesVivos = opciones.map((_, i) => i).filter(i => !quitadas.has(i));
  const vivas        = indicesVivos.map(i => opciones[i]);

  return {
    vivas,
    problemas: validarOpciones(vivas).map(p => ({
      ...p,
      indices: p.indices.map(i => indicesVivos[i]),
    })),
  };
}
