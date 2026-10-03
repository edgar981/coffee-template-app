import type { PaginaKey, SeccionVista } from '@/components/admin/tienda-secciones';

// LA PIEZA PURA del iframe de /admin/tienda (§ EDITOR-TIENDA-IFRAME-VISTA-1, slice 2 del plan de
// `docs/editor-tienda/DISENO.md`). Responsabilidades sin DOM ni red, testeadas en capa 1: qué URL
// real corresponde a cada pestaña de página (con y sin el marcador de modo editor), qué selector
// ubica el marcador de una sección dentro del documento del iframe, y cómo normalizar un scrollY
// guardado antes de un reload. El componente (`VistaTiendaIframe.tsx`) es la mitad impura que USA
// esto.

/**
 * EL CONTRATO entre `proxy.ts`, `lib/config/modo-editor-gate.ts` y `VistaTiendaIframe.tsx`
 * (§ MODO-EDITOR-SOLO-EN-EL-IFRAME-1): el parámetro que el iframe pone en la URL, y el header de
 * REQUEST al que `proxy.ts` lo traduce para que el storefront lo vea con `headers()` — en Next 16
 * un LAYOUT no recibe `searchParams` (sólo `page.tsx`), así que el parámetro por sí solo no le
 * llega a `app/(storefront)/layout.tsx`, que es donde vive el gate real (§ `modoEditorActivo`).
 *
 * Viven en este módulo —puro, sin `next/headers` ni Prisma ni Better Auth— porque `proxy.ts` NO
 * puede importar `lib/config/modo-editor-gate.ts` directo sin arrastrar esos tres a su propio
 * bundle (la doc de Next lo dice explícito: "Proxy... you should not attempt relying on shared
 * modules or globals" — `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/
 * proxy.md`). Una sola definición del nombre, no dos que puedan divergir (§ CLAUDE.md,
 * `razonDelServidor`/`cruzoMinimo`).
 */
export const PARAM_MODO_EDITOR = 'editor';
export const VALOR_MODO_EDITOR = '1';
export const ENCABEZADO_MODO_EDITOR = 'x-editor-modo';

/** La ruta REAL del storefront para cada pestaña del editor (`PaginaKey`, § tienda-secciones.ts). */
export function urlDePagina(pagina: PaginaKey): string {
  return pagina === 'home' ? '/' : `/${pagina}`;
}

/**
 * La URL que el iframe carga de verdad: la ruta real + el parámetro de modo editor. `proxy.ts` lo
 * lee y lo reenvía como header; sin sesión OWNER/MANAGER válida en ESA request, el gate lo ignora
 * y sirve lo publicado igual (§ `decidirModoEditor`) — el parámetro nunca es, por sí mismo, una
 * credencial.
 */
export function urlDePaginaEnEditor(pagina: PaginaKey): string {
  return `${urlDePagina(pagina)}?${PARAM_MODO_EDITOR}=${VALOR_MODO_EDITOR}`;
}

/** El nombre del atributo que el storefront emite por sección en modo editor, UNA sola vez (nunca
 *  el literal `'data-editor-seccion'` repetido en cada sitio que lo lee o lo escribe) —
 *  `selectorDeSeccion` abajo, el `setAttribute` imperativo de `app/(storefront)/suscripciones/
 *  Contenido.tsx` (§ EDITOR-TIENDA-SELECCION-1), y el `closest()` que lee `EditorPuenteVivo.tsx`. */
export const ATRIBUTO_EDITOR_SECCION = 'data-editor-seccion';

/**
 * EL MARCADOR DE CAMPO (§ EDITOR-TIENDA-CAMPO-EDITABLE-1, docs/editor-tienda/EDICION-INLINE.md
 * § 2.3): `CampoEditable.tsx` lo escribe con la ruta COMPLETA ("hero.titulo",
 * "testimonials.items.0.text" — § `parsearRutaCampo`, `lib/storefront/campo-editable.ts`), SÓLO en
 * modo editor. `EditorPuenteVivo.tsx` lo lee con `closest()` para decidir si un clic abre el campo
 * flotante, ANTES de mirar `ATRIBUTO_EDITOR_SECCION` (un campo vive DENTRO de una sección marcada,
 * nunca al revés). Una sola definición del nombre, misma razón que el de sección: que quien lo
 * escribe y quien lo lee no puedan divergir sobre la cadena literal.
 */
export const ATRIBUTO_EDITOR_CAMPO = 'data-editor-campo';

/**
 * Si el campo es de una sola línea (`'unica'`, un `<input>`) o de varias (`'multiple'`, un
 * `<textarea>`) — el mismo booleano `multilinea` que `CampoEditable` ya recibe por prop, serializado
 * a atributo porque el overlay lo necesita leer desde FUERA de React (el click que lo abre llega
 * por un listener de DOM, no por un handler de React sobre ese nodo). Decide si Enter COMMITEA y
 * cierra el overlay, o inserta un salto de línea (§ EDICION-INLINE.md § 2.2).
 */
export const ATRIBUTO_EDITOR_LINEA = 'data-editor-linea';

/**
 * El marcador de PÁGINA que `app/(storefront)/suscripciones/page.tsx` escribe (literal, fuera de
 * `touches:` de `EDITOR-TIENDA-SELECCION-1` — no se pudo mover a una constante compartida ahí
 * tampoco). `Contenido.tsx` lo usa como ANCLA de detección (§ su docstring): si existe, está dentro
 * del borrador verificado por sesión (el ÚNICO caso en que `page.tsx` lo escribe); si no, es
 * tráfico público y no se toca nada. Ya NO es el marcador que `marcadorDeSeccion` devuelve para
 * ninguna `SeccionVista` (ver abajo) — queda vivo sólo como esa ancla.
 */
export const MARCADOR_SUSCRIPCIONES = 'suscripciones';

/**
 * El marcador `data-editor-seccion` que el storefront emite para esta sección, EN MODO EDITOR
 * (§ EDITOR-TIENDA-IFRAME-VISTA-1). Home y Nosotros: un marcador por BANDA (el mismo id que
 * `BandaId`/`BandaNosotrosId` de `site-content-defaults.ts`), con la única excepción de
 * `spotlight` — variante de la banda estructural `featured`, sin `bandaId` propio (§ su docstring
 * en `tienda-secciones.ts`) — que comparte el marcador de esa banda.
 *
 * Suscripciones YA NO comparte un marcador único de página (§ EDITOR-TIENDA-SELECCION-1, cierra la
 * limitación que esta función documentaba hasta ese slice): sus tres secciones
 * (`suscripcionPlanes`/`suscripcionPasos`/`suscripcionFaq`) ahora marcan su propio nodo DENTRO de
 * `app/(storefront)/suscripciones/Contenido.tsx` —imperativamente, por DOM, no por JSX condicionado
 * (ver el docstring de ese archivo para el porqué)— así que, como el resto, caen a la identidad.
 */
export function marcadorDeSeccion(seccion: SeccionVista): string {
  return seccion === 'spotlight' ? 'featured' : seccion;
}

/** El selector CSS para `querySelector` dentro del documento (mismo origen) del iframe. */
export function selectorDeSeccion(seccion: SeccionVista): string {
  return `[${ATRIBUTO_EDITOR_SECCION}="${marcadorDeSeccion(seccion)}"]`;
}

/**
 * La inversa PARCIAL de `marcadorDeSeccion` (§ EDITOR-TIENDA-SELECCION-1, § 4.1 de DISENO.md —
 * iframe→lista): dado el marcador que llega del storefront por el `postMessage` de un clic,
 * ¿a qué sección del editor corresponde? Sólo resuelve la ÚNICA ambigüedad real —`'featured'`
 * comparte marcador con `spotlight`, y `'featured'` en sí NO es una `SeccionVista` editable
 * (no tiene `SeccionConfig` propia, § su docstring en `tienda-secciones.ts`)—, así que ante ese
 * marcador apunta a `'spotlight'`. Cualquier OTRO marcador se devuelve TAL CUAL: hoy es exactamente
 * el nombre de su `SeccionVista` (identidad), incluidas las tres de Suscripciones desde que dejaron
 * de compartir `'suscripciones'` (arriba).
 *
 * Devuelve `string`, no `SeccionVista`: este módulo NO importa `SECCIONES_TIENDA` (el registro
 * runtime, pesado — íconos, zod, campos — y `proxy.ts` también importa este archivo, que debe
 * seguir liviano para el middleware, § el comentario de arriba). El LLAMADOR (`TiendaPaginas.tsx`),
 * que sí tiene ese registro, es quien valida si el resultado es una sección EXISTENTE en la página
 * activa antes de usarlo — un marcador que no resuelve a nada conocido se ignora ahí, no acá.
 */
export function seccionDesdeMarcador(marcador: string): string {
  return marcador === 'featured' ? 'spotlight' : marcador;
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

// ─── EL SELECTOR DE DISPOSITIVO (§ EDITOR-TIENDA-DISPOSITIVOS-1, § 4.3 de DISENO.md) ───────────────
//
// El iframe de `VistaTiendaIframe` deja de medirse SIEMPRE al ancho del panel: toma el ancho LITERAL
// del dispositivo elegido (así se activan los breakpoints REALES de la tienda, Tailwind `sm:`/`md:`
// incluidos — § DISENO.md § 4.3, "con el iframe a 375px de ancho VERDADERO, el propio CSS responsive
// de la tienda hace el trabajo"), y SÓLO si ese ancho no cabe en la columna del panel se reduce
// ENTERO con `transform: scale` — nunca se recorta ni se desplaza en horizontal.
//
// LOS TRES ANCHOS SALEN DE LO QUE EL REPO YA USA PARA MEDIR, no de un valor inventado para esta
// tanda (el propio spec lo pide así):
//   · escritorio = 1280 — `ANCHO_VIEWPORT` de `scripts/verificar-nayoli-visual.ts:202`, el viewport
//     de escritorio de TODO arnés de captura visual del repo.
//   · tablet = 768 — el breakpoint `md` de Tailwind (sin redefinir en este repo, § `app/globals.css`
//     `--breakpoint-*`), ya usado como el corte móvil/escritorio del propio storefront (p. ej.
//     `components/storefront/home/GrindChooserMosaico.tsx:73`, `sizes="(max-width: 768px) 100vw,
//     50vw"`).
//   · telefono = 393 — el viewport del dispositivo Playwright "iPhone 15", el mismo nombrado en los
//     comentarios de medición de este repo (`components/storefront/home/GrindChooserRiel.tsx:514`,
//     `lib/animation.ts:1158`, `lib/config/presentaciones-riel.test.ts:64`) — medido contra
//     `devices['iPhone 15']` del propio Playwright instalado en `.arnes-tooling/playwright`.
export type DispositivoKey = 'escritorio' | 'tablet' | 'telefono';

export const ANCHOS_DISPOSITIVO: Record<DispositivoKey, number> = {
  escritorio: 1280,
  tablet: 768,
  telefono: 393,
};

/** Escritorio por defecto (owner, EDITOR-TIENDA-DISPOSITIVOS-1: "Escritorio por defecto"). */
export const DISPOSITIVO_DEFECTO: DispositivoKey = 'escritorio';

/** La clave de `localStorage` donde se recuerda el último dispositivo elegido, por navegador. */
export const CLAVE_DISPOSITIVO_EDITOR = 'admin:editor-tienda:dispositivo';

/**
 * El valor guardado en `localStorage` puede ser cualquier string (otra versión, una clave vieja,
 * algo corrupto) o `null` (nunca se eligió, o el storage no es accesible — modo privado). Sólo las
 * tres claves válidas pasan; cualquier otra cosa cae al default, nunca a un dispositivo inventado.
 */
export function dispositivoDesdeStorage(valor: string | null): DispositivoKey {
  return valor === 'escritorio' || valor === 'tablet' || valor === 'telefono' ? valor : DISPOSITIVO_DEFECTO;
}

/**
 * La escala del dispositivo dentro del ancho DISPONIBLE del panel: 1 si el dispositivo entero cabe
 * (se muestra a su ancho real, sin reducir), o `anchoDisponible / anchoDispositivo` si no cabe —
 * nunca más de 1 (nunca se AGRANDA el dispositivo para llenar un panel más ancho que él; sólo se
 * centra, que es trabajo del componente, no de esta función).
 *
 * `anchoDisponible <= 0` es "todavía no medido" (antes del primer `ResizeObserver`, o un nodo que
 * salió del DOM — mismo caso que ya documenta `EscalaDesktop.tsx`): se trata como "cabe", para que
 * el primer paint no muestre un dispositivo reducido a cero por una medición que aún no llegó.
 */
export function calcularEscalaDispositivo(anchoDisponible: number, anchoDispositivo: number): number {
  if (!(anchoDisponible > 0) || !(anchoDispositivo > 0)) return 1;
  return anchoDisponible >= anchoDispositivo ? 1 : anchoDisponible / anchoDispositivo;
}
