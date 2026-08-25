// EL GATE de lectura del borrador. ¿La tienda sirve el BORRADOR sin publicar en vez de lo
// PUBLICADO? Sólo si (a) viene la señal `?borrador=1` Y (b) la sesión es de un rol con acceso
// al panel (OWNER/MANAGER). Un visitante sin sesión —o con un rol sin panel— recibe lo
// publicado AUNQUE ponga el parámetro: el borrador NO es alcanzable sin sesión de admin.
//
// Puro (rol + booleano → booleano) para AFIRMARLO en capa 1; el cableado (que la página lea la
// sesión real y elija el loader) se prueba en vivo, que es donde un leak sería grave.
//
// OWNER/MANAGER y no STAFF: es el MISMO conjunto que gatea el panel (proxy.ts + el layout del
// admin). El borrador es contenido de operación, no público.
const ROLES_CON_PANEL = new Set(['OWNER', 'MANAGER']);

export function debeLeerBorrador(role: string | undefined | null, tieneSenal: boolean): boolean {
  return tieneSenal && !!role && ROLES_CON_PANEL.has(role);
}
