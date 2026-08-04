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

/** ¿Falta alguno de los obligatorios? Un valor de solo espacios cuenta como vacío. */
export function faltanObligatorios(form: CamposObligatorios): boolean {
  return CAMPOS_OBLIGATORIOS_PRODUCTO.some(campo => !String(form[campo] ?? '').trim());
}

/**
 * Predicado del botón Guardar. `guardando` cubre las dos etapas del envío
 * (subida y escritura), no solo la subida.
 */
export function puedeGuardarProducto(form: CamposObligatorios, guardando: boolean): boolean {
  return !guardando && !faltanObligatorios(form);
}
