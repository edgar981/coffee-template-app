import { REGISTRY, DEFAULTS, resolverSiteContent, type SiteContentData, type SeccionDef } from '@/lib/config/site-content-defaults';

// § EDITOR-TIENDA-POSTMESSAGE-1 — EL PUENTE panel→iframe para los cambios EN VIVO (texto/imagen),
// sin recargar el documento. Dos mitades, como todo mecanismo delicado de este repo: ésta es la
// PURA (forma del mensaje, membresía en el REGISTRY, la fusión de UNA sección) — sin `window`,
// `postMessage` ni `zod`; el componente (`EditorPuenteVivo.tsx`) es el envoltorio impuro que
// escucha el evento y hace el `import()` dinámico del schema de validación (§ su docstring, por
// qué NO vive acá: zod + `site-content-schema.ts` no deben viajar en el bundle de CADA visitante
// público, sólo en el del dueño editando — "el peso es un costo real", CLAUDE.md).

/** El discriminador del mensaje — un literal, no un string suelto, para que `esMensajeContenidoSeccion`
 *  y el emisor (`VistaTiendaIframe.tsx`) no puedan divergir sobre el nombre. */
export const TIPO_MENSAJE_CONTENIDO_SECCION = 'editor-tienda:contenido-seccion' as const;

export interface MensajeContenidoSeccion {
  tipo: typeof TIPO_MENSAJE_CONTENIDO_SECCION;
  seccion: string;
  datos: Record<string, unknown>;
}

/**
 * Validación ESTRUCTURAL del mensaje — forma, no contenido semántico (eso lo decide el schema zod,
 * en el llamador impuro). Un `MessageEvent.data` de cualquier OTRO origen de mensajes del mismo
 * `window` (una extensión del navegador, otra librería que postee al mismo documento) no debe
 * parecer un mensaje de este puente sólo porque por casualidad trae un campo `tipo`.
 */
export function esMensajeContenidoSeccion(data: unknown): data is MensajeContenidoSeccion {
  if (!data || typeof data !== 'object') return false;
  const m = data as Record<string, unknown>;
  return (
    m.tipo === TIPO_MENSAJE_CONTENIDO_SECCION &&
    typeof m.seccion === 'string' &&
    m.seccion.trim() !== '' &&
    !!m.datos &&
    typeof m.datos === 'object' &&
    !Array.isArray(m.datos)
  );
}

/**
 * ¿`seccion` es una sección DECLARADA en el REGISTRY (`site-content-defaults.ts`)? Las claves META
 * (`tema`, `paginas`, `cromo`…) NO lo son — sus editores (`PaletaSeccion`, `MenuSeccion`…) quedan
 * fuera de `touches:` de este slice y nunca emiten este mensaje; uno que llegara con una de esas
 * claves se rechaza acá, en vez de fallar en silencio más abajo contra un `REGISTRY[seccion]`
 * `undefined`.
 */
export function esSeccionDelRegistro(seccion: string): seccion is keyof typeof REGISTRY {
  return Object.prototype.hasOwnProperty.call(REGISTRY, seccion);
}

// ─── LOS DOS MENSAJES NUEVOS (§ EDITOR-TIENDA-SELECCION-1) ─────────────────────────────────────
//
// Cierran la mitad que `EDITOR-TIENDA-POSTMESSAGE-1` dejó pendiente (§ DISENO.md § 13.3): el canal
// de ARRIBA es panel→iframe para CONTENIDO; estos dos son la selección en contexto (§ 4.1) — uno
// por dirección, cada uno con su propio discriminador (nunca el mismo que `TIPO_MENSAJE_CONTENIDO_
// SECCION`, por la misma razón que ésa: que una extensión del navegador u otra librería no pueda
// parecer un mensaje de este puente por casualidad).

/** iframe→panel: "el dueño clickeó esta sección dentro de la tienda real" (§ 4.1). Emitido por
 *  `EditorPuenteVivo.tsx` cuando el clic cae dentro de un `[data-editor-seccion]`; recibido por
 *  `VistaTiendaIframe.tsx`, que no vive en este módulo (storefront-puro) así que no puede resolver
 *  el marcador a una `SeccionVista` — eso lo hace `seccionDesdeMarcador`, `lib/admin/editor-iframe.ts`. */
export const TIPO_MENSAJE_SECCION_CLICK = 'editor-tienda:seccion-click' as const;

export interface MensajeSeccionClick {
  tipo: typeof TIPO_MENSAJE_SECCION_CLICK;
  /** El valor LITERAL de `data-editor-seccion` en el nodo clickeado — no necesariamente una
   *  `SeccionVista` válida todavía (ver el docstring de arriba). */
  seccion: string;
}

export function esMensajeSeccionClick(data: unknown): data is MensajeSeccionClick {
  if (!data || typeof data !== 'object') return false;
  const m = data as Record<string, unknown>;
  return m.tipo === TIPO_MENSAJE_SECCION_CLICK && typeof m.seccion === 'string' && m.seccion.trim() !== '';
}

/** panel→iframe: "el interruptor Navegar cambió" (§ 4.1, "Decidí cómo se vuelve a «usar» la
 *  tienda"). `navegar:true` apaga la selección en contexto —un clic vuelve a comportarse como en la
 *  tienda real— y `false` (el DEFAULT con el que nace `EditorPuenteVivo`) la mantiene activa. Vive
 *  acá, junto al resto del puente, por la misma razón que todo lo demás: una sola definición del
 *  nombre del mensaje, compartida por quien lo manda (`VistaTiendaIframe.tsx`) y quien lo recibe
 *  (`EditorPuenteVivo.tsx`). */
export const TIPO_MENSAJE_MODO_NAVEGAR = 'editor-tienda:modo-navegar' as const;

export interface MensajeModoNavegar {
  tipo: typeof TIPO_MENSAJE_MODO_NAVEGAR;
  navegar: boolean;
}

export function esMensajeModoNavegar(data: unknown): data is MensajeModoNavegar {
  if (!data || typeof data !== 'object') return false;
  const m = data as Record<string, unknown>;
  return m.tipo === TIPO_MENSAJE_MODO_NAVEGAR && typeof m.navegar === 'boolean';
}

// ─── EL TERCER MENSAJE (§ EDITOR-TIENDA-CAMPO-EDITABLE-1) ──────────────────────────────────────
//
// iframe→panel: "el campo flotante de ESTE nodo cambió a este valor" (§ EDICION-INLINE.md § 2.1,
// "el nodo contentEditable (o el campo flotante) NUNCA es la fuente de verdad"). Emitido por el
// overlay que vive en `EditorPuenteVivo.tsx` en CADA tecla; recibido por `VistaTiendaIframe.tsx`,
// que lo reenvía a `TiendaPaginas.tsx` (resuelve `seccion` igual que `TIPO_MENSAJE_SECCION_CLICK`,
// § `seccionDesdeMarcador`) y de ahí a `TiendaSeccionEditorHandle.escribirCampo()` — el MISMO
// setter (`cambiar()`) que ya usa el `onChange` del input de la lista, nunca un segundo camino de
// datos (§ el docstring de `fusionarContenidoSeccion`, abajo, que ya fija este principio para el
// mensaje panel→iframe; este es el inverso).

export const TIPO_MENSAJE_CAMPO_CAMBIO = 'editor-tienda:campo-cambio' as const;

export interface MensajeCampoCambio {
  tipo: typeof TIPO_MENSAJE_CAMPO_CAMBIO;
  /** La sección del REGISTRY a la que pertenece el campo (p. ej. 'hero') — `parsearRutaCampo`
   *  (`lib/storefront/campo-editable.ts`) ya separó esto de la ruta completa del nodo. */
  seccion: string;
  /** El campo RELATIVO dentro de esa sección — plano ('titulo') o de ítem de repeater
   *  ('items.0.text'), § `fusionCampoEditable`. */
  campo: string;
  valor: string;
}

export function esMensajeCampoCambio(data: unknown): data is MensajeCampoCambio {
  if (!data || typeof data !== 'object') return false;
  const m = data as Record<string, unknown>;
  return (
    m.tipo === TIPO_MENSAJE_CAMPO_CAMBIO &&
    typeof m.seccion === 'string' && m.seccion.trim() !== '' &&
    typeof m.campo === 'string' && m.campo.trim() !== '' &&
    typeof m.valor === 'string'
  );
}

/**
 * Fusiona el borrador EN VUELO de UNA sección sobre el contenido YA RESUELTO que el storefront
 * tiene en memoria (lo que `getSiteContent()` mandó en el render del servidor, o el resultado de
 * una fusión anterior). `datosValidados` es la salida de `.safeParse()` contra el sub-schema de
 * `seccion` — validada en el LLAMADOR, nunca acá (§ el docstring del módulo, por qué zod no vive en
 * este archivo).
 *
 * Reusa `resolverSiteContent` —la MISMA función que resuelve el documento COMPLETO en el
 * servidor— sobre un registro de UNA sola clave, en vez de reimplementar sus reglas (requerido
 * vacío cae al default, opcional vacío se omite, repeaters se resuelven por `resolverItems`,
 * variantes/escalares/booleanos se clampan). El `defaultsBase` que se le pasa es `DEFAULTS[seccion]`
 * — el default ESTÁTICO de código, el mismo que usaría el servidor al publicar — no el valor actual
 * en pantalla: así un campo REQUERIDO que el dueño vacía a mitad de edición se previsualiza
 * exactamente como se vería publicado (cae al default), no como "lo que había antes de este
 * mensaje" (una tercera definición de "default" que nadie pidió).
 *
 * Una `seccion` que no está en el REGISTRY devuelve `actual` SIN TOCAR — nunca lanza, nunca
 * inventa una clave nueva en el documento.
 */
export function fusionarContenidoSeccion(
  actual: SiteContentData,
  seccion: string,
  datosValidados: Record<string, unknown>,
): SiteContentData {
  if (!esSeccionDelRegistro(seccion)) return actual;
  const def: SeccionDef = REGISTRY[seccion];
  const defaultsSeccion = (DEFAULTS as unknown as Record<string, unknown>)[seccion];
  const resuelto = resolverSiteContent(
    { [seccion]: datosValidados },
    { [seccion]: def },
    { [seccion]: defaultsSeccion },
  ) as unknown as Record<string, unknown>;
  return { ...actual, [seccion]: resuelto[seccion] } as SiteContentData;
}
