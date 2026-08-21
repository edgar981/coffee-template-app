import { RUTA_DESTINO } from '@/lib/redirect-ordenes';

// ─── EL REDIRECT DE /admin/entregas ──────────────────────────────────────────
//
// `/admin/entregas` se retiró. Su eje —el fulfillment— vive ahora en Pedidos: el
// estado se ve por fila (columna Entrega) y la cola por-despachar es un carril
// ("Listas para despachar"). El board de flota dejó de existir.
//
// ── ES EL REDIRECT MÁS SIMPLE DE LOS CINCO, y por una razón concreta ─────────
//
// La vieja Entregas filtraba con `useState`, NUNCA con query params. Así que la
// población congelada es sólo el string PELADO `/admin/entregas` —sin nada que
// traducir—. Y como el href no lleva la orden, no se puede afinar el destino: va al
// listado PELADO `/admin/pedidos` (sin filtro, nunca 404). Es una población MIXTA
// —envíos estancados + entregas fallidas escribieron el mismo `/admin/entregas`—,
// así que un carril serviría a una mitad y no a la otra; el pelado es lo honesto.
//
// Lo alimentan dos poblaciones congeladas: los `Notification.href` de `envio_estancado`
// y `entrega_fallida` (2 medidas en dev) y los `admin:cmdk-recents` de quien abrió la
// pantalla. Las fuentes VIVAS ya reapuntaron al PEDIDO (§ commit 1/4); este redirect es
// sólo para lo congelado.
//
// ── POR QUÉ NO HAY BUCLE ────────────────────────────────────────────────────
//
// El destino `/admin/pedidos` es de OTRA sección: `destinoDesdeEntregas` sólo captura
// `/admin/entregas`, así que el destino pasa en `null` por esta función y por toda la
// cadena. Afirmado en el test contra la cadena COMPLETA, no por disjunción de matchers.

/** La ruta retirada. Es SÓLO origen —a diferencia de Inventario, no hay página viva acá. */
export const RUTA_ENTREGAS = '/admin/entregas';

/**
 * La URL de destino, o `null` si esta petición no hay que redirigirla.
 *
 * TRAMPA (la de siempre): comparación POR SEGMENTO, no `startsWith` a secas —
 * `/admin/entregas-foo` NO es subruta de `/admin/entregas` y no debe capturarse—.
 * `=== RUTA` cubre la pelada; `startsWith(RUTA + '/')` cubre las subrutas, y el `/`
 * final es lo que excluye a `-foo`.
 *
 * El `search` se DESCARTA a propósito: la vieja pantalla nunca emitió query params, y
 * arrastrar basura de un enlace manual sólo ensuciaría el destino. Sin filtro, nunca 404.
 */
export function destinoDesdeEntregas(pathname: string, _search: URLSearchParams): string | null {
  if (pathname === RUTA_ENTREGAS || pathname.startsWith(`${RUTA_ENTREGAS}/`)) {
    return RUTA_DESTINO;
  }
  return null;
}
