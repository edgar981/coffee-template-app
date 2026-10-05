// ─── CONTROLES genéricos de formulario del panel ─────────────────────────────
//
// Utilidades PURAS, sin DOM, para controles que varias pantallas del admin
// necesitan y que no son parte de ningún dominio concreto (no son de pedidos, ni
// de productos, ni de pagos). El primer consumidor es el editor de "Mensajes al
// cliente" (§ PEDIDOS-WHATSAPP-MENSAJES-EDITABLES-1): un botón que inserta un
// hueco (`{nombre}`, `{pedido}`…) en la posición del CURSOR de un textarea, no al
// final — así el dueño puede insertar un hueco a mitad de frase sin perder el
// punto donde estaba escribiendo.

/**
 * Inserta `texto` en la posición del cursor de un campo —o reemplaza la
 * selección activa, si había una— y devuelve el valor resultante junto con la
 * posición donde debe quedar el cursor DESPUÉS, para que quien dispara la
 * inserción (un botón, no el propio campo) pueda devolverle el foco al campo en
 * el lugar correcto en vez de dejarlo saltar al final.
 *
 * `selectionStart`/`selectionEnd` se acotan a los límites del valor actual: un
 * botón que lee `textarea.selectionStart` de un campo que todavía no tuvo foco
 * (o cuyo valor cambió por fuera, p. ej. "Restaurar el texto por defecto") puede
 * traer un índice fuera de rango, y escribir ahí partiría el string con un
 * `slice` que no corresponde a nada visible.
 */
export function insertarEnCursor(
  valorActual: string,
  selectionStart: number,
  selectionEnd: number,
  texto: string,
): { valor: string; cursor: number } {
  const inicio = Math.max(0, Math.min(selectionStart, valorActual.length));
  const fin = Math.max(inicio, Math.min(selectionEnd, valorActual.length));
  const valor = valorActual.slice(0, inicio) + texto + valorActual.slice(fin);
  return { valor, cursor: inicio + texto.length };
}
