import { ADMIN_NAV } from '@/constants/admin-nav';

// ─── El título de la pestaña LO DICE EL MENÚ ─────────────────────────────────
//
// Regla de la tanda de identidad (owner, 2026-08-06): **cero vocabulario nuevo**
// — la pestaña dice exactamente lo que dice el sidebar. Por eso los nueve títulos
// de sección no se re-teclean acá: se DERIVAN de `ADMIN_NAV`, que ya es la fuente
// única de la navegación (sidebar rail, peek, drawer móvil y ⌘K).
//
// Que sea una derivación y no una segunda lista es el punto. Con dos listas,
// renombrar "Analítica" en el menú dejaría la pestaña diciendo lo viejo, y nadie
// lo notaría: el título de pestaña es justo el texto que uno no mira hasta que
// está mal.
//
// Las tres secciones que NO están en `ADMIN_NAV` (viven en el menú de cuenta o
// son subsecciones) se declaran abajo, con el texto que ya usa su propia
// pantalla. `usuarios` hereda "Configuración" a propósito: es una subsección, y
// su encabezado ("Equipo") es un tercer nombre que no vale la pena meter en la
// pestaña.

/** Lo que sigue al título en cada pestaña del panel. */
export const SUFIJO_PANEL = 'Panel Duna';

/** Secciones fuera de `ADMIN_NAV`: menú de cuenta y subsecciones. */
const FUERA_DEL_NAV: Record<string, string> = {
  '/admin/configuracion':          'Configuración',
  '/admin/configuracion/usuarios': 'Configuración',
  '/admin/perfil':                 'Mi perfil',
};

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
