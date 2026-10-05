import { ADMIN_NAV, DESTINOS_FUERA_DEL_MENU } from '@/constants/admin-nav';

// ─── El título de la pestaña LO DICE EL MENÚ ─────────────────────────────────
//
// Regla de la tanda de identidad (owner, 2026-08-06): **cero vocabulario nuevo**
// — la pestaña dice exactamente lo que dice el sidebar. Por eso los títulos
// de sección no se re-teclean acá: se DERIVAN de `ADMIN_NAV`, que ya es la fuente
// única de la navegación (sidebar rail, peek, drawer móvil y ⌘K).
//
// Que sea una derivación y no una segunda lista es el punto. Con dos listas,
// renombrar "Analítica" en el menú dejaría la pestaña diciendo lo viejo, y nadie
// lo notaría: el título de pestaña es justo el texto que uno no mira hasta que
// está mal.
//
// Las secciones que NO están en `ADMIN_NAV` (se entran por el nombre del negocio o
// por el menú de usuario, § `NegocioMenu`/`UserMenu`) se DERIVAN de
// `DESTINOS_FUERA_DEL_MENU` (§ PANEL-ESTRUCTURA-TIENDA-1) — la misma fuente que
// alimenta el ⌘K, para que las dos superficies no puedan divergir sobre qué título
// usar. "Configuración" dice "Configuración": con el editor del negocio dejó de
// mostrar sólo equipo, así que recupera el nombre del área (era "Equipo y usuarios"
// mientras eso era todo lo que hacía). La subruta vieja `/configuracion/usuarios` ya
// no existe (redirige acá).

/** Lo que sigue al título en cada pestaña del panel. */
export const SUFIJO_PANEL = 'Panel Duna';

/** Secciones fuera de `ADMIN_NAV`, derivadas de `DESTINOS_FUERA_DEL_MENU`. */
const FUERA_DEL_NAV: Record<string, string> = Object.fromEntries(
  DESTINOS_FUERA_DEL_MENU.map(d => [d.path, d.label]),
);

/**
 * El título de una ruta del admin, o `null` si esa ruta no declara ninguno.
 *
 * `null` y no un fallback inventado: una ruta sin título hereda el `default` del
 * layout del grupo ("Panel Duna"), que es correcto y no miente. Fabricar un
 * título desde el path daría cosas como "Ordenes" sin tilde en la pestaña.
 */
export function tituloAdmin(path: string): string | null {
  const nav = ADMIN_NAV.find(item => item.path === path);
  if (nav) return nav.label;
  return FUERA_DEL_NAV[path] ?? null;
}
