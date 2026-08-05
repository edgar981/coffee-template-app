// ─── El mensaje del servidor, cuando lo trae ─────────────────────────────────
// Los endpoints del admin responden `{ error: '…' }` con una frase que dice qué
// corregir: "Aparece en 3 órdenes; desactívalo en lugar de eliminarlo", "Deja al
// menos una molienda disponible", "Stock insuficiente para esta salida". Un
// `throw new Error('Error al guardar')` genérico borra exactamente esa frase, y
// deja al operador con la única información que no sirve para nada.
//
// Vivía como una función local en `lib/api/products.ts` (tanda del editor de
// moliendas). Se sube acá porque la auditoría de errores inline encontró tres
// mutaciones que seguían tragándose el mensaje —`createCustomer`,
// `updateCustomer`, `updateOrder`— y dos definiciones del mismo helper es cómo
// vuelve a pasar.

/**
 * Convierte una respuesta fallida en el `Error` que hay que lanzar, con el
 * mensaje del servidor si lo mandó y el `fallback` si no.
 *
 * El `.catch(() => null)` cubre el caso real de un 500 que devuelve HTML en vez
 * de JSON: ahí no hay `{ error }` que leer y el fallback es lo correcto.
 */
export async function razonDelServidor(res: Response, fallback: string): Promise<Error> {
  const msg = await res.json().then((d) => d?.error).catch(() => null);
  return new Error(typeof msg === 'string' && msg ? msg : fallback);
}
