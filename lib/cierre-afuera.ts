// lib/cierre-afuera.ts — § NAV-CIERRE-CLICK-AFUERA-1
//
// LA PRIMITIVA COMPARTIDA de "cerrar al tocar afuera", usada por el mega-menú
// (`components/storefront/layout/StoreNav.tsx`) y el panel de búsqueda
// (`components/storefront/layout/NavSearch.tsx`) — los dos paneles del encabezado que hoy sólo
// cerraban con Escape. La decisión es PURA (dado el destino de un evento de puntero y los nodos
// que cuentan como "adentro", ¿corresponde cerrar?); el componente sólo cablea el listener contra
// ella — una sola implementación, no dos copias que puedan divergir (la misma clase de defecto
// que `razonDelServidor`/`cruzoMinimo` ya documentan en este repo).
//
// ─── POR QUÉ NO ALCANZABA CON EL FONDO TRANSPARENTE QUE YA EXISTÍA ──────────────────────────────
// Los dos paneles ya llevaban un fondo `fixed inset-0 z-40` con su propio `onClick` — el patrón
// que el spec de este slice pedía verificar antes de asumir que hacía falta un listener nuevo.
// MEDIDO contra el dev server real (Playwright/Chromium, `.arnes-tooling/playwright`): con el
// encabezado en su estado "flotante" (tope de página, sin scroll) el fondo SÍ cubre el viewport
// entero y SÍ cierra al click. Pero en cuanto el encabezado entra a su estado "sólido"
// (`scrolled`, la clase `backdrop-blur` de `StoreNav.tsx`), el `<header>` —que es el ANCESTRO del
// fondo— pasa a tener `backdrop-filter` computado, y un `backdrop-filter` distinto de `none`
// convierte a ese ancestro en el CONTAINING BLOCK de sus descendientes `position:fixed` (la misma
// regla que ya aplica a `transform`). El fondo, con `inset:0`, deja entonces de resolver contra el
// VIEWPORT y se confina a la caja del propio `<header>`: medido, su `getBoundingClientRect()` pasó
// de `{width:1280, height:900}` (viewport) a `{width:1280, height:72}` (la altura del encabezado)
// al scrollear la página. Un click por debajo de esos 72px —la inmensa mayoría de "afuera"— nunca
// toca el fondo, y su `onClick` nunca corre. Sólo `Escape` seguía funcionando porque es un
// `keydown` en `window`, ajeno a dónde pinta cualquier elemento.
//
// Es la misma familia que el resto de la doctrina de este repo (§ CLAUDE.md, el artefacto rancio,
// el rol de una base, el spec que contradice el terreno): que un elemento PAREZCA cubrir la
// pantalla no prueba que la cubra en todo estado.
//
// ─── LA SALIDA ───────────────────────────────────────────────────────────────────────────────
// Un listener en `document`, en CAPTURA, que decide por CONTENCIÓN DE ÁRBOL (`Node.contains`) —
// una propiedad que no cambia con `transform`/`filter`/scroll/una vista escalada— en vez de por
// dónde pintó el navegador el fondo. El fondo oscuro VISUAL se conserva tal cual (cero cambio de
// píxeles, sigue dimeando/blureando el encabezado); lo que se retira es su `onClick`, que quedaba
// como una segunda fuente de verdad para el mismo cierre y que además demostró ser el que falla.

/** Lo mínimo que un nodo "adentro" necesita saber hacer: decir si CONTIENE a otro. `Node.contains`
 *  ya cumple esta forma — la interfaz existe para que la prueba pura (`cierre-afuera.test.ts`) no
 *  dependa de una clase DOM real (el repo no tiene jsdom, § CLAUDE.md "El glob NO incluye
 *  *.test.tsx"). */
export interface NodoDeCierre {
  contains(otro: unknown): boolean;
}

/**
 * ¿El destino de un evento de puntero cae AFUERA de todos los nodos dados?
 *
 * `nodos` son los que cuentan como "adentro": el panel Y el disparador que lo abrió. Si el
 * disparador contara como afuera, un click en él cerraría el panel y el `onClick` propio del
 * disparador lo volvería a abrir en el MISMO gesto — el disparador es parte de la superficie
 * abierta, no del exterior.
 *
 * Sin destino (`null`/`undefined`, un evento sintético sin `target`) el default es NO cerrar:
 * cerrar sobre un dato que no se tiene sería el mismo error que un fallback que adivina mal
 * (§ CLAUDE.md, "preferir callar a adivinar mal").
 */
export function esClickAfuera(
  destino: unknown,
  nodos: ReadonlyArray<NodoDeCierre | null | undefined>,
): boolean {
  if (destino == null) return false;
  for (const nodo of nodos) {
    if (nodo && nodo.contains(destino)) return false;
  }
  return true;
}
