// ─── EL REDIRECT DE PRODUCTOS ────────────────────────────────────────────────
//
// La pantalla vieja de Productos se retiró y la nueva —que vivía en
// `/admin/productos-v2` mientras convivían— se quedó con `/admin/productos`. Esta
// función atiende a quien tenga guardada la ruta de convivencia.
//
// ── ES EL MÁS SIMPLE DE LOS TRES RETIROS, Y CONVIENE DECIR POR QUÉ ──────────
//
// Órdenes necesitó su redirect por `Notification.href` (enlaces congelados en la
// base) y Clientes por el perfil `/admin/clientes/<id>` (una ruta de path). Acá
// no hay ninguna de las dos:
//
//   · `Notification.href`: no hay nada que TRADUCIR. (Ojo: esto cambió con el
//     retiro de Inventario — `AUTOMATION_HREF.stockBajo` ahora apunta a
//     `/admin/productos?f=reponer`, así que sí hay hrefs de producto en la base.
//     Pero ese destino es la ruta PELADA con un query que la pantalla ya entiende,
//     así que `destinoDesdeProductos` lo deja pasar en `null` —es su destino, no un
//     origen a redirigir—. La afirmación vieja "cero hrefs de producto" ya no vale;
//     la que importa —"ninguno hay que traducir"— sigue en pie.)
//   · No hay ruta de detalle: la vieja abría el detalle con `?producto=<id>`, un
//     QUERY, no un segmento de path. Nunca existió `/admin/productos/<id>`.
//
// Y el ⌘K —la población de `admin:cmdk-recents` en el navegador— YA guardaba
// `/admin/productos?producto=<id>`, la ruta canónica, no `-v2`
// (`components/admin/CommandPalette.tsx`). O sea que sus recientes navegan bien
// solos: la ruta se conserva. Lo único que cambia para ellos es el SIGNIFICADO de
// `?producto=` (antes abría el modal de editar, ahora selecciona) — y eso ningún
// redirect lo atiende, porque la ruta y el parámetro son los mismos. Es un cambio
// aceptado y documentado, no algo que traducir.
//
// Así que la única población que este redirect necesita es quien haya marcado o
// tenga en su historial `/admin/productos-v2` a mano. Existe igual, y sin él la
// ruta muere en 404 el día que se borra el directorio.
//
// ── NUNCA 404 ────────────────────────────────────────────────────────────────
//
// Lo que no se sabe traducir cae a la lista sin filtro: el que llega venía de un
// enlace que funcionaba, y una lista de más se vuelve a filtrar mientras que un
// 404 lo deja sin nada.

/** La ruta que la pantalla nueva heredó. Es destino, y también origen. */
export const RUTA_PRODUCTOS = '/admin/productos';

/** La ruta de convivencia, que muere con el retiro. */
export const RUTA_V2 = '/admin/productos-v2';

/**
 * Traduce el query de la ruta vieja al de la nueva.
 *
 * No hay NADA que traducir de verdad: `f` (carril), `cat` (categoría) y `producto`
 * (selección) son el vocabulario que la pantalla nueva ya habla, así que viajan
 * TAL CUAL. La función existe igual —en vez de pasar el `search` crudo— para
 * filtrar a esas tres claves conocidas y no arrastrar basura de un enlace viejo.
 *
 * Devuelve el `search` armado (sin `?`), o `''` cuando no queda nada.
 */
export function traducirQueryDeProductos(entrada: URLSearchParams): string {
  const salida = new URLSearchParams();
  for (const clave of ['f', 'cat', 'producto'] as const) {
    const valor = entrada.get(clave);
    if (valor) salida.set(clave, valor);
  }
  return salida.toString();
}

/**
 * La URL de destino, o `null` si esta petición no hay que redirigirla.
 *
 * ── LAS TRES TRAMPAS DE ESTE MAPEO ──────────────────────────────────────────
 *
 * 1. **`/admin/productos-v2` EMPIEZA por `/admin/productos`.** Un `startsWith` a
 *    secas lo trataría como subruta de productos y lo dejaría pasar sin
 *    redirigir. Por eso `-v2` es su propio caso, comparado por SEGMENTO y
 *    evaluado PRIMERO. Es el mismo bug de caracteres-contra-segmentos que ya
 *    mordió en Clientes y en el rail.
 *
 * 2. **`/admin/productos` pelado NO se redirige: ES el destino.** Devolver una
 *    URL para él sería un BUCLE — el middleware corre en cada request, incluido
 *    el que él mismo provoca. Y acá no hay excepción "con query viejo" como en
 *    Clientes: la vieja no tenía ningún query que traducir (sólo `?producto=`,
 *    que la nueva ya entiende). Así que la ruta pelada, con o sin query, siempre
 *    devuelve `null`.
 *
 * 3. **Prefijos disjuntos con órdenes y clientes.** Ninguna ruta puede matchear
 *    los tres, así que el orden en que `proxy.ts` los llama no importa. Afirmado
 *    en el test.
 */
export function destinoDesdeProductos(pathname: string, search: URLSearchParams): string | null {
  // ── La ruta de convivencia, y cualquier cosa colgando de ella (trampa 1).
  if (pathname === RUTA_V2 || pathname.startsWith(`${RUTA_V2}/`)) {
    const query = traducirQueryDeProductos(search);
    return query ? `${RUTA_PRODUCTOS}?${query}` : RUTA_PRODUCTOS;
  }

  // ── Todo lo demás —incluida la ruta ya heredada— no se toca (trampa 2).
  return null;
}
