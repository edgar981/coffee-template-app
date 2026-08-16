import { LOW_STOCK_PARAM, LOW_STOCK_VALUE } from '@duna/core/metrics/inventory-filters';
import { RUTA_REPONER } from '@/lib/productos/filtros';

// ─── EL REDIRECT DE INVENTARIO ───────────────────────────────────────────────
//
// La pantalla vieja de Inventario se retiró y la nueva —que vivía en
// `/admin/inventario-v2` mientras convivían, encogida a vista de AUDITORÍA— se
// quedó con `/admin/inventario`. Esta función atiende a dos poblaciones.
//
// ── ES DISTINTO A LOS OTROS TRES RETIROS EN UN PUNTO ────────────────────────
//
// Los otros redirigían DENTRO de su misma sección (renombrando params). Acá una
// parte se va a OTRA sección: el `?stock=bajo-minimo` de la Inventario vieja era su
// cola de reposición, y esa cola se mudó al carril "Por reponer" de Productos
// cuando Inventario se encogió a auditoría. La auditoría no puede filtrar por
// bajo-mínimo —es otra pregunta—, así que mandar ese enlace a la auditoría sin
// filtro sería caer al conjunto equivocado. Va a su hogar real: `RUTA_REPONER`.
//
// Eso lo alimentan dos poblaciones congeladas: las `Notification.href` de
// `stock_bajo` (3 medidas en dev, `/admin/inventario?stock=bajo-minimo`) y los
// `admin:cmdk-recents` que algún operador tenga a mano. Las fuentes VIVAS ya
// apuntan directo a `RUTA_REPONER` (§ commit de migración); este redirect es sólo
// para lo congelado.
//
// ── EL DOBLE SALTO, Y POR QUÉ NO ES UN LOOP ─────────────────────────────────
//
// Es la primera vez en los cuatro retiros que un redirect emite un destino de OTRA
// sección (`/admin/productos?f=reponer`) que OTRO redirect de la cadena podría, en
// principio, capturar. No lo hace: ese destino es la ruta PELADA de Productos con
// un query que la pantalla ya entiende, así que `destinoDesdeProductos` lo deja
// pasar en `null`. La cadena converge en dos pasadas —la segunda es `null`—, sin
// loop. Afirmado explícitamente en el test contra la cadena COMPLETA, no sólo por
// disjunción de matchers.

/** La ruta que la pantalla nueva heredó. Es destino, y también origen. */
export const RUTA_INVENTARIO = '/admin/inventario';

/** La ruta de convivencia, que muere con el retiro. */
export const RUTA_INVENTARIO_V2 = '/admin/inventario-v2';

/**
 * Traduce el query de la ruta de convivencia (`-v2`) al de la heredada. El
 * vocabulario de la AUDITORÍA —`producto`, `tipo`, `desde`, `hasta`— es el que la
 * pantalla ya habla, así que viaja TAL CUAL; se filtra a esas claves para no
 * arrastrar basura de un enlace viejo. Devuelve el `search` armado (sin `?`), o
 * `''` cuando no queda nada. (No traduce `stock`: la v2 nunca lo emitió.)
 */
export function traducirQueryDeAuditoria(entrada: URLSearchParams): string {
  const salida = new URLSearchParams();
  for (const clave of ['producto', 'tipo', 'desde', 'hasta'] as const) {
    const valor = entrada.get(clave);
    if (valor) salida.set(clave, valor);
  }
  return salida.toString();
}

/**
 * La URL de destino, o `null` si esta petición no hay que redirigirla.
 *
 * ── LAS TRAMPAS DE ESTE MAPEO ───────────────────────────────────────────────
 *
 * 1. **`/admin/inventario-v2` EMPIEZA por `/admin/inventario`.** Un `startsWith` a
 *    secas trataría a `-v2` como subruta de la heredada y no lo redirigiría. Por
 *    eso `-v2` es su propio caso, comparado por SEGMENTO (`=== RUTA_V2` o `RUTA_V2/`)
 *    y evaluado PRIMERO. Mismo bug de caracteres-contra-segmentos que ya mordió en
 *    Clientes, Productos y el rail.
 *
 * 2. **`/admin/inventario` pelado NO se redirige: ES el destino** (la auditoría).
 *    Devolver una URL para él sería un BUCLE. Sus params de auditoría
 *    (`?producto=`, etc.) también pasan derecho: la pantalla los entiende. SÓLO el
 *    `?stock=bajo-minimo` legacy sale de la sección, a Productos.
 *
 * 3. **El destino `/admin/productos?f=reponer` es de OTRA sección** — ver la nota
 *    del doble salto arriba. No lo captura ningún otro redirect (pasa en `null`).
 */
export function destinoDesdeInventario(pathname: string, search: URLSearchParams): string | null {
  // ── La ruta de convivencia, y cualquier cosa colgando de ella (trampa 1).
  if (pathname === RUTA_INVENTARIO_V2 || pathname.startsWith(`${RUTA_INVENTARIO_V2}/`)) {
    const query = traducirQueryDeAuditoria(search);
    return query ? `${RUTA_INVENTARIO}?${query}` : RUTA_INVENTARIO;
  }

  // ── El param legacy de stock bajo → su hogar real, la cola de Productos.
  if (pathname === RUTA_INVENTARIO && search.get(LOW_STOCK_PARAM) === LOW_STOCK_VALUE) {
    return RUTA_REPONER;
  }

  // ── Todo lo demás —incluida la ruta heredada con sus params de auditoría— pasa
  //    derecho (trampa 2).
  return null;
}
