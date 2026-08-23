// ─── EL REDIRECT DE /admin/configuracion/usuarios ────────────────────────────
//
// La pantalla de equipo dejó de vivir en la subruta `/configuracion/usuarios` y
// pasó a SER `/admin/configuracion` (el hub de tarjetas desapareció — cinco de
// ellas eran "Próximamente"). La subruta vieja redirige a la ruta que ahora la
// hospeda.
//
// ── ES EL REDIRECT MÁS SIMPLE DE TODOS ──────────────────────────────────────
//
// A diferencia de los otros cinco (Ordenes, Clientes, Productos, Inventario,
// Entregas), acá NO hay traducción de query: `/configuracion/usuarios` nunca usó
// query params, así que es un redirect de path plano. Sigue teniendo su módulo y
// su test por la misma razón que los otros: el redirect es la deuda del retiro y
// se afirma como unidad, no se confía a una línea suelta en el middleware.
//
// ── POR QUÉ NO HAY BUCLE ────────────────────────────────────────────────────
//
// El destino `/admin/configuracion` NO es `=== RUTA_USUARIOS` ni empieza por
// `RUTA_USUARIOS + '/'`, así que pasa en `null` por esta función y por la cadena
// entera. Afirmado en el test contra la cadena COMPLETA, no por disjunción de
// matchers.

/** La subruta retirada. Es SÓLO origen: la pantalla se muda a la ruta padre. */
export const RUTA_USUARIOS = '/admin/configuracion/usuarios';

/** La ruta que ahora hospeda el equipo — el destino. */
export const RUTA_CONFIG = '/admin/configuracion';

/**
 * La URL de destino, o `null` si esta petición no hay que redirigirla.
 *
 * Comparación POR SEGMENTO, no `startsWith` a secas: `=== RUTA_USUARIOS` cubre la
 * pelada; `startsWith(RUTA_USUARIOS + '/')` cubriría cualquier sub-subruta (hoy no
 * hay ninguna), y el `/` final es lo que excluye a un hipotético
 * `/configuracion/usuarios-x`. `_search` se descarta: no había query que arrastrar.
 */
export function destinoDesdeConfig(pathname: string, _search: URLSearchParams): string | null {
  if (pathname === RUTA_USUARIOS || pathname.startsWith(`${RUTA_USUARIOS}/`)) {
    return RUTA_CONFIG;
  }
  return null;
}
