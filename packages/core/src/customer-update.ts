import type { Prisma } from '@duna/core';
import { normalizeCustomerPhone } from '@duna/core/whatsapp-link';
import { trae } from '@duna/core/product-update';

// ─── Qué escribe un PATCH de cliente ──────────────────────────────────────────
// Un PATCH es PARCIAL por definición: escribe los campos que el body TRAE y no
// toca los demás. El endpoint NO lo hacía — escribía los ocho campos sin
// condición, con un fallback sobre cada clave (`body.email || null`,
// `canal || 'directo'`, `activo ?? true`). Un fallback sobre una clave AUSENTE no
// es un default, es un borrado. Es el gemelo exacto del defecto que en Productos
// vació descripciones, precios y SKU (§ El PATCH de producto es PARCIAL de verdad).
//
// Acá era una MINA, no una herida: el único control que llama a este PATCH hoy
// —el modal de cliente— manda el formulario COMPLETO, así que ningún campo se
// perdía. Pero el día que exista un control que mande un campo suelto —el caso
// obvio es un TOGGLE de `activo` para desactivar un cliente, la salida-A del
// backlog #8— ese `{ activo: false }` vaciaría correo, teléfono, ciudad,
// dirección y notas, y pondría el origen en `directo`. Este arreglo desarma esa
// mina ANTES de que el toggle exista: cuando llegue, no vaciará el cliente.
//
// Reusa `trae` de `product-update` —presencia de la clave, no verdad del valor—
// en vez de inventar un segundo chequeo de presencia: dos definiciones del mismo
// helper es cómo divergen. Vive acá y no en el route handler por el criterio de
// siempre: el carril no monta HTTP, así que la única forma de afirmar esta
// decisión contra una base real es que sea una función
// (§ `tests/integracion/patch-cliente-parcial.test.ts`).

/**
 * Los campos que este PATCH debe escribir, ya normalizados. El manejo de cada
 * valor PRESENTE es idéntico al que tenía el endpoint —esta tanda arregla la
 * ausencia, no cambia la semántica de lo que sí llega—:
 *
 * - `'' → null` en los opcionales (vaciar un correo o una ciudad es legítimo);
 * - `canal` cae a `'directo'` sólo cuando viene presente-pero-vacío;
 * - el teléfono se canoniza con el mismo normalizador que el matching de órdenes;
 * - `activo` respeta `false` (es un booleano, no un opcional vacío).
 */
export function datosDelPatch(body: Record<string, unknown>): Prisma.CustomerUncheckedUpdateInput {
  const data: Prisma.CustomerUncheckedUpdateInput = {};
  const hay = (campo: string) => trae(body, campo);

  if (hay('nombre'))    data.nombre    = body.nombre as string;
  if (hay('email'))     data.email     = (body.email as string) || null;
  // Canonicalize on write — same normalizer as order matching (raw fallback for
  // non-mobile numbers).
  if (hay('telefono'))  data.telefono  = normalizeCustomerPhone(body.telefono as string) ?? ((body.telefono as string) || null);
  if (hay('ciudad'))    data.ciudad    = (body.ciudad as string) || null;
  if (hay('direccion')) data.direccion = (body.direccion as string) || null;
  if (hay('canal'))     data.canal     = (body.canal as string) || 'directo';
  if (hay('notas'))     data.notas     = (body.notas as string) || null;
  if (hay('activo'))    data.activo    = (body.activo as boolean) ?? true;

  return data;
}
