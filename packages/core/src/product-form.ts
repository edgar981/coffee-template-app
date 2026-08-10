import type { ProductForm } from '@/types/product';

// ─── Habilitación del guardado del formulario de producto ────────────────────
// Vive acá, pura y testeada, y NO como una expresión suelta dentro del JSX del
// botón: mientras fue una condición inline nadie podía cubrirla, y basta con que
// un campo nuevo se cuele en ella para bloquear el alta sin que ningún test se
// entere. El path CREAR es el frágil — EDITAR llega con todos los campos ya
// poblados desde el producto, así que enmascara cualquier requisito de más.

/**
 * Campos que el formulario exige para poder guardar. Son EXACTAMENTE los tres
 * marcados con `*` en la UI.
 *
 * `imagen` NO está y no debe estarlo: el endpoint no la exige (`POST
 * /api/products` hace `imagen: body.imagen || ''`, sin validación), un producto
 * puede vivir sin portada, y meterla acá rompería solo el alta —al editar
 * siempre viene una— que es justo el modo de falla difícil de ver. Lo mismo para
 * la galería: es opcional por definición.
 */
export const CAMPOS_OBLIGATORIOS_PRODUCTO = ['nombre', 'categoria', 'precio'] as const;

type CamposObligatorios = Pick<ProductForm, (typeof CAMPOS_OBLIGATORIOS_PRODUCTO)[number]>;

/** Etiqueta con la que cada obligatorio se nombra al operador. */
export const ETIQUETA_OBLIGATORIO: Record<(typeof CAMPOS_OBLIGATORIOS_PRODUCTO)[number], string> = {
  nombre:    'nombre',
  categoria: 'categoría',
  precio:    'precio',
};

/** ¿Falta alguno de los obligatorios? Un valor de solo espacios cuenta como vacío. */
export function faltanObligatorios(form: CamposObligatorios): boolean {
  return obligatoriosFaltantes(form).length > 0;
}

/**
 * Nombres de los obligatorios vacíos, en el orden en que aparecen en el
 * formulario. Alimenta el aviso bajo el botón: un botón deshabilitado sin
 * explicación no dice si falta algo o si la app está rota — fue exactamente lo
 * que convirtió un campo vacío en un reporte de bug bloqueante.
 */
export function obligatoriosFaltantes(form: CamposObligatorios): string[] {
  return CAMPOS_OBLIGATORIOS_PRODUCTO
    .filter(campo => !String(form[campo] ?? '').trim())
    .map(campo => ETIQUETA_OBLIGATORIO[campo]);
}

/**
 * Predicado del botón Guardar. `guardando` cubre las dos etapas del envío
 * (subida y escritura), no solo la subida.
 */
export function puedeGuardarProducto(form: CamposObligatorios, guardando: boolean): boolean {
  return !guardando && !faltanObligatorios(form);
}

// ─── La acción de estado del diálogo de borrado ──────────────────────────────
// El diálogo de eliminar ofrece, al lado de Cancelar, la alternativa NO
// destructiva. Durante un tiempo esa alternativa existió en una sola dirección:
// se ofrecía "Desactivar" cuando el producto estaba activo y NADA cuando estaba
// inactivo. El modal tampoco tiene control de `activo` —lo lleva invisible y lo
// reescribe tal como vino—, así que un producto desactivado quedaba ATRAPADO: la
// única salida era la base.
//
// Lo encontró el owner el 2026-08-04, desactivando un producto para probar el
// PATCH parcial y descubriendo que no podía devolverlo. Un botón que desactiva
// sin su inverso no es una acción, es una trampa.
//
// Es una función y no un ternario en el JSX por el mismo motivo que
// `puedeGuardarProducto`: lo que hay que garantizar es que la acción ofrecida sea
// SIEMPRE el inverso del estado actual, y esa es justo la clase de condición que
// nadie puede cubrir mientras vive inline. La forma la impone el tipo — un
// booleano `activo` y su verbo — así que ofrecer el estado en el que ya se está
// deja de ser expresable.
//
// DÓNDE SE OFRECE CADA DIRECCIÓN (y por qué no es la misma puerta): activar vive
// en el badge "Inactivo" de la card, y desactivar sigue viviendo en el flujo de
// eliminar. El primer intento puso las dos detrás del ícono de basura, y eso
// viola la regla del repo de que un affordance promete su acción — la misma que
// hace que `CustomerLink` renderice texto plano cuando no hay perfil al que ir:
// "no dead link, no cursor-pointer promising a navigation that won't happen".
// Una basura que además activa es el caso simétrico: promete eliminar y esconde
// lo contrario.

export interface AccionEstadoProducto {
  /** Verbo del botón: el INVERSO de lo que el producto es ahora. */
  label: string;
  /** Lo que se manda en el PATCH. Siempre `!activo`. */
  activo: boolean;
  /** Toast al resolver. */
  successMessage: string;
}

/**
 * La acción de estado que le corresponde a un producto: el INVERSO de lo que es
 * ahora. Activo → "Desactivar"; inactivo → "Activar". Sin producto no hay acción.
 *
 * Es la resolución de verbo y copy para las DOS superficies; cuál se muestra en
 * cada una lo decide quien la consume (ver `alternativaAlEliminar`).
 */
export function accionEstadoProducto(
  producto: { activo: boolean } | null | undefined,
): AccionEstadoProducto | undefined {
  if (!producto) return undefined;
  return producto.activo
    ? { label: 'Desactivar', activo: false, successMessage: 'Producto desactivado' }
    : { label: 'Activar',    activo: true,  successMessage: 'Producto activado' };
}

/**
 * Lo que el diálogo de ELIMINAR ofrece "en su lugar": desactivar, y sólo eso.
 *
 * **Nunca activa.** Se deriva de `accionEstadoProducto` filtrando por dirección
 * en vez de repetir la condición, así que no hay dos definiciones del par que
 * puedan desincronizarse — y el invariante ("de acá no sale una activación") es
 * una propiedad del filtro, no una convención que haya que recordar.
 *
 * Para un producto ya inactivo devuelve `undefined` y el diálogo se queda sin
 * alternativa, que es lo correcto: ahí no hay nada no-destructivo que ofrecer, el
 * 409 del servidor explica por qué no se puede eliminar, y la manija de activar
 * vive en el badge "Inactivo" de la card.
 */
export function alternativaAlEliminar(
  producto: { activo: boolean } | null | undefined,
): AccionEstadoProducto | undefined {
  const accion = accionEstadoProducto(producto);
  return accion && !accion.activo ? accion : undefined;
}
