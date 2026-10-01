import type { PaginaKey, SeccionVista } from '@/components/admin/tienda-secciones';

// LA PIEZA PURA del iframe de /admin/tienda (§ EDITOR-TIENDA-IFRAME-VISTA-1, slice 2 del plan de
// `docs/editor-tienda/DISENO.md`). Tres responsabilidades sin DOM ni red, testeadas en capa 1: qué
// URL real corresponde a cada pestaña de página, qué selector ubica el marcador de una sección
// dentro del documento del iframe, y cómo normalizar un scrollY guardado antes de un reload. El
// componente (`VistaTiendaIframe.tsx`) es la mitad impura que USA esto.

/** La ruta REAL del storefront para cada pestaña del editor (`PaginaKey`, § tienda-secciones.ts). */
export function urlDePagina(pagina: PaginaKey): string {
  return pagina === 'home' ? '/' : `/${pagina}`;
}

/**
 * El marcador `data-editor-seccion` que el storefront emite para esta sección, EN MODO EDITOR
 * (§ EDITOR-TIENDA-IFRAME-VISTA-1). Home y Nosotros: un marcador por BANDA (el mismo id que
 * `BandaId`/`BandaNosotrosId` de `site-content-defaults.ts`), con la única excepción de
 * `spotlight` — variante de la banda estructural `featured`, sin `bandaId` propio (§ su docstring
 * en `tienda-secciones.ts`) — que comparte el marcador de esa banda.
 *
 * Suscripciones es DISTINTA: sus tres secciones (`suscripcionPlanes`/`suscripcionPasos`/
 * `suscripcionFaq`) viven DENTRO de `app/(storefront)/suscripciones/Contenido.tsx`, un archivo
 * FUERA de `touches:` de este slice — no hay forma de marcar cada una por separado sin tocarlo.
 * Comparten un marcador ÚNICO de PÁGINA (`'suscripciones'`, el wrapper que
 * `app/(storefront)/suscripciones/page.tsx` agrega sobre `<SuscripcionesContenido />` sólo en modo
 * editor): "ir a la sección" en esas tres sólo lleva al TOPE de /suscripciones, nunca al bloque
 * exacto. Limitación conocida, documentada en `DECISIONS.md` (`EDITOR-TIENDA-IFRAME-VISTA-1`) — se
 * cierra si/cuando `Contenido.tsx` entre a `touches:` de un slice futuro (p. ej. el de selección en
 * contexto, `EDITOR-TIENDA-SELECCION-1`).
 */
export function marcadorDeSeccion(seccion: SeccionVista): string {
  if (seccion === 'spotlight') return 'featured';
  if (seccion === 'suscripcionPlanes' || seccion === 'suscripcionPasos' || seccion === 'suscripcionFaq') {
    return 'suscripciones';
  }
  return seccion;
}

/** El selector CSS para `querySelector` dentro del documento (mismo origen) del iframe. */
export function selectorDeSeccion(seccion: SeccionVista): string {
  return `[data-editor-seccion="${marcadorDeSeccion(seccion)}"]`;
}

/**
 * Normaliza un scrollY guardado antes de recargar: nunca negativo, nunca NaN/Infinity (un valor
 * leído de una ventana todavía sin layout, o un `contentWindow` momentáneamente inaccesible, no
 * debe mandar el scroll restaurado a un lugar imposible). Redondea: `scrollTo` con decimales no
 * aporta nada y complica comparar en un test.
 */
export function scrollSeguro(y: number): number {
  return Number.isFinite(y) && y > 0 ? Math.round(y) : 0;
}
