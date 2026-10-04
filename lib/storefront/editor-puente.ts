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
 * fuera de `touches:` de ese slice y nunca emiten este mensaje; uno que llegara con una de esas
 * claves se rechaza acá, en vez de fallar en silencio más abajo contra un `REGISTRY[seccion]`
 * `undefined`.
 *
 * EXCEPCIÓN (§ EDITOR-TIENDA-ORDEN-1): `'orden'` también es clave META, pero SÍ reusa este mismo
 * mensaje (`TIPO_MENSAJE_CONTENIDO_SECCION`) — `EditorPuenteVivo.tsx` la reconoce ANTES de llamar a
 * esta función (nunca llega acá con `seccion === 'orden'`, así que esta función sigue devolviendo
 * `false` para esa clave; el llamador bifurca antes).
 *
 * SEGUNDA EXCEPCIÓN (§ EDITOR-TIENDA-TEMA-1): `'tema'` es la MISMA clase de caso que `'orden'` —
 * reusa `TIPO_MENSAJE_CONTENIDO_SECCION`, `EditorPuenteVivo.tsx` la reconoce ANTES de esta función,
 * y por tanto nunca llega acá con `seccion === 'tema'` tampoco.
 */
export function esSeccionDelRegistro(seccion: string): seccion is keyof typeof REGISTRY {
  return Object.prototype.hasOwnProperty.call(REGISTRY, seccion);
}

// ─── EL SEXTO MENSAJE — REUTILIZADO (§ EDITOR-TIENDA-ORDEN-1) ──────────────────────────────────
//
// panel→iframe: "el orden de las bandas del home cambió". NO es un mensaje NUEVO — reusa
// `TIPO_MENSAJE_CONTENIDO_SECCION` con `seccion: 'orden'`, documentado como excepción en
// `esSeccionDelRegistro` arriba. La razón de reusar en vez de inventar un séptimo mensaje: la forma
// que necesita ({tipo, seccion, datos}) ya existe, y `VistaTiendaIframe.tsx` (`enviarCambio`, fuera
// de `touches:` de este slice) ya la manda genéricamente en runtime — sólo tipada a `SeccionVista`,
// que `TiendaPaginas.tsx` cruza con un cast documentado en el call site. `EditorPuenteVivo.tsx`
// reconoce `seccion === 'orden'` ANTES de `esSeccionDelRegistro`/`fusionarContenidoSeccion` (que
// sólo fusionan secciones DEL REGISTRY) y reordena el DOM directo — ningún band lee `content.orden`
// reactivamente (la secuencia la fija `page.tsx`, en el SERVIDOR, una sola vez), así que fusionar
// `orden` en el contexto no reordenaría nada por sí solo.
//
/** `datos.valor` del mensaje, cuando `seccion === 'orden'` — el array crudo, SIN resolver todavía
 *  (`resolverOrden`, `lib/config/site-content-defaults.ts`, lo hace el llamador: SOFT, nunca
 *  lanza). Validación ESTRUCTURAL únicamente (¿hay un array ahí?) — `orden` es una permutación de
 *  un set YA CONOCIDO (`BANDA_IDS`), no texto libre que el dueño tipea, así que coercionar
 *  defensivamente con el resolver es más apropiado que rechazar con zod, como hacen los demás
 *  mensajes de este módulo. */
export function datosDeOrden(datos: Record<string, unknown>): unknown[] | null {
  return Array.isArray(datos.valor) ? datos.valor : null;
}

// ─── EL SÉPTIMO MENSAJE — REUTILIZADO (§ EDITOR-TIENDA-TEMA-1) ─────────────────────────────────
//
// panel→iframe: "la paleta/tipografía/forma del tema cambiaron". Mismo patrón que 'orden' arriba:
// NO es un mensaje nuevo — reusa `TIPO_MENSAJE_CONTENIDO_SECCION` con `seccion: 'tema'`, también
// documentado como excepción en `esSeccionDelRegistro` (abajo). La razón de reusar: la forma que
// necesita ({tipo, seccion, datos}) ya existe, y la decisión de con qué SECCIÓN se identifica un
// mensaje panel→iframe ya está resuelta — inventar un OCTAVO tipo de mensaje por cada clave META
// (tema, paginas, cromo…) que algún día quiera hablarle al iframe sería la misma forma repetida
// sin ganar nada. `EditorPuenteVivo.tsx` reconoce `seccion === 'tema'` ANTES de
// `esSeccionDelRegistro`/`fusionarContenidoSeccion` (que sólo fusionan CONTENIDO editorial dentro
// del `SiteContentProvider`) y aplica las variables DIRECTO sobre `documentElement.style` — un
// tema no es contenido que el árbol de React deba re-renderizar, es presentación que CSS ya lee
// por cascada; fusionarlo en el contexto no movería un solo píxel por sí solo.
//
// `datos.vars` viaja SIEMPRE COMPLETO (§ `varsDeTemaEnVivo`, `lib/config/esquema-style.ts`): el
// panel —no el iframe— es quien rellena fuente/forma con su valor CONCRETO incluso cuando el eje
// está en su default, así que el lado del iframe nunca necesita decidir qué `removeProperty`: basta
// con aplicar cada clave que llega. Esa decisión se tomó para no tener que importar `fuentes.ts`/
// `formas.ts` (los resolvers "nunca null", `parDeFuentePar`/`formaDeForma`) en este archivo —PÚBLICO,
// vía `EditorPuenteVivo.tsx`, que se monta en TODO visitante del storefront— por una lista de 17
// nombres de variable que sólo hacía falta para decidir qué limpiar.

/** `datos.vars` del mensaje, cuando `seccion === 'tema'` — el mapa de variables CSS YA RESUELTAS
 *  por `varsDeTemaEnVivo` (`lib/config/esquema-style.ts`, el lado del panel). Validación
 *  ESTRUCTURAL únicamente (¿es un objeto plano de string→string?) — el contenido semántico (que
 *  cada clave sea realmente una custom property conocida) no se verifica acá: aplicar una clave
 *  CSS inventada vía `style.setProperty` no hace nada peligroso, el navegador la ignora. */
export function datosDeTema(datos: Record<string, unknown>): Record<string, string> | null {
  const vars = datos.vars;
  if (!vars || typeof vars !== 'object' || Array.isArray(vars)) return null;
  const entradas = Object.entries(vars as Record<string, unknown>);
  for (const [clave, valor] of entradas) {
    if (typeof clave !== 'string' || typeof valor !== 'string') return null;
  }
  return vars as Record<string, string>;
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

// ─── EL CUARTO MENSAJE (§ EDITOR-TIENDA-CAMPO-EDITABLE-IMAGEN-1) ───────────────────────────────
//
// iframe→panel: "el dueño clickeó esta imagen/video" (§ EDICION-INLINE.md § 4). A diferencia del
// campo de TEXTO (arriba, `TIPO_MENSAJE_CAMPO_CAMBIO`), una imagen NUNCA se edita tecleando dentro
// del iframe — el mensaje no lleva `valor`, sólo la ruta. El panel abre la sección en la lista (como
// `TIPO_MENSAJE_SECCION_CLICK`, que el emisor sigue mandando IGUAL para este clic) y dispara
// PROGRAMÁTICAMENTE el mismo `<input type="file">` oculto que el control "Cambiar imagen"/"Cambiar
// video" de esa sección ya monta — nunca un selector de archivos propio dentro del iframe: la
// subida entera (Blob directo, progreso, tope de tamaño) vive SOLO en la lista.
export const TIPO_MENSAJE_CAMPO_IMAGEN_CLICK = 'editor-tienda:campo-imagen-click' as const;

export interface MensajeCampoImagenClick {
  tipo: typeof TIPO_MENSAJE_CAMPO_IMAGEN_CLICK;
  /** La sección del REGISTRY, igual que `MensajeCampoCambio.seccion`. */
  seccion: string;
  /** El campo RELATIVO dentro de esa sección — p. ej. 'imagen', 'imagenPoster', 'imagenMovil'. */
  campo: string;
}

export function esMensajeCampoImagenClick(data: unknown): data is MensajeCampoImagenClick {
  if (!data || typeof data !== 'object') return false;
  const m = data as Record<string, unknown>;
  return (
    m.tipo === TIPO_MENSAJE_CAMPO_IMAGEN_CLICK &&
    typeof m.seccion === 'string' && m.seccion.trim() !== '' &&
    typeof m.campo === 'string' && m.campo.trim() !== ''
  );
}

// ─── LAS ZONAS DEL HERO (§ EDITOR-TIENDA-ZONAS-1, docs/editor-tienda/REDISENO.md § 4) ──────────
//
// NO es un mensaje nuevo — REUTILIZA `TIPO_MENSAJE_CAMPO_CAMBIO` (arriba): "+ Titular"/"Quitar"/los
// botones de Alto y de Velo son, los cuatro, la MISMA operación que ya existe ("escribir un campo
// de la sección que el clic marcó"), disparada por un CLIC en un botón en vez de por una TECLA en
// el campo flotante. Lo único nuevo es DE DÓNDE sale el mensaje: en vez de leer `nodo.textContent`
// tras cada tecla (§ `abrirCampo`, `EditorPuenteVivo.tsx`), lee DOS atributos fijos del nodo
// clickeado — el campo y el valor a escribir, declarados por el HERO en el JSX, nunca calculados—.
//
// `ATRIBUTO_EDITOR_ZONA_CAMPO`/`_VALOR` viven ACÁ y no junto a `ATRIBUTO_EDITOR_CAMPO` en
// `lib/admin/editor-iframe.ts` por la MISMA razón que ya fijó `ATRIBUTO_EDITOR_CAMPO_IMAGEN`
// (`lib/storefront/campo-editable.ts`, § EDITOR-TIENDA-CAMPO-EDITABLE-IMAGEN-1): ese archivo no
// está en `touches:` de este slice. Comparten la convención de nombre (`data-editor-*`), no el
// módulo.
//
// UN SEGUNDO PAR OPCIONAL (`_CAMPO2`/`_VALOR2`) cubre el VELO: «Oscurecer para leer mejor» escribe
// DOS campos reales a la vez (`veloVisible`+`veloIntensidad`, § `camposDeVeloCombo`,
// site-content-defaults.ts) — un solo botón, dos mensajes en secuencia, nunca un mensaje compuesto
// nuevo (el panel ya sabe aplicar `TIPO_MENSAJE_CAMPO_CAMBIO` uno por uno; inventar una forma de
// mensaje "con dos campos" sería una SEGUNDA manera de decir lo mismo).
export const ATRIBUTO_EDITOR_ZONA_CAMPO = 'data-editor-zona-campo';
export const ATRIBUTO_EDITOR_ZONA_VALOR = 'data-editor-zona-valor';
export const ATRIBUTO_EDITOR_ZONA_CAMPO2 = 'data-editor-zona-campo2';
export const ATRIBUTO_EDITOR_ZONA_VALOR2 = 'data-editor-zona-valor2';

/**
 * De los CUATRO atributos ya leídos (`null` si el nodo no los trae), los mensajes
 * `TIPO_MENSAJE_CAMPO_CAMBIO` a postear — SIEMPRE para la sección `'hero'` (hoy la única que declara
 * zonas; § REDISENO.md § 4, "el hero por zonas"). Pura: no lee el DOM, sólo valida/arma la forma —
 * `EditorPuenteVivo.tsx` hace el `getAttribute` y le pasa los cuatro strings-o-null acá.
 *
 * Devuelve `[]` si el primer par (campo/valor) no es válido — un nodo marcado sin su campo principal
 * es una declaración rota, no hay nada que mandar; el segundo par es estrictamente OPCIONAL (sólo el
 * velo lo usa) y se ignora en silencio si falta la mitad.
 */
export function mensajesDeZonaHero(
  campo: string | null, valor: string | null, campo2: string | null, valor2: string | null,
): MensajeCampoCambio[] {
  if (!campo || valor === null) return [];
  const out: MensajeCampoCambio[] = [{ tipo: TIPO_MENSAJE_CAMPO_CAMBIO, seccion: 'hero', campo, valor }];
  if (campo2 && valor2 !== null) out.push({ tipo: TIPO_MENSAJE_CAMPO_CAMBIO, seccion: 'hero', campo: campo2, valor: valor2 });
  return out;
}

// ─── EL QUINTO MENSAJE (§ EDITOR-TIENDA-CAMPO-EDITABLE-SESION-1) ───────────────────────────────
//
// panel→iframe: "el autoguardado de ESTA sección acaba de fallar/volver a funcionar por 401"
// (docs/editor-tienda/EDICION-INLINE.md § 3, "Lo que SÍ es nuevo" — el banner de sesión vencida del
// panel puede pasar inadvertido mientras el dueño teclea DENTRO del iframe). A diferencia de
// `TIPO_MENSAJE_CONTENIDO_SECCION`/`TIPO_MENSAJE_MODO_NAVEGAR` (los otros dos panel→iframe), éste NO
// viaja por el `ref` imperativo de `VistaTiendaIframe.tsx` (fuera de `touches:` de este slice): el
// emisor (`TiendaSeccionEditor.tsx`) captura la ventana del iframe del propio `MessageEvent.source`
// de cualquier mensaje iframe→panel que YA le llega (todo mensaje de ese sentido trae, por
// especificación, la ventana que lo mandó) y le contesta DIRECTO ahí — sin necesitar un segundo
// camino al iframe. El `mensaje` viaja como STRING ya resuelto (`MSG_SESION_VENCIDA`,
// `lib/api/upload.ts`, reusado por el emisor — nunca copiado) para que el lado del iframe
// (`EditorPuenteVivo.tsx`, storefront público) no tenga que importar ese módulo: arrastraría
// `@vercel/blob/client` al bundle de CADA visitante (§ "el peso es un costo real", CLAUDE.md).
export const TIPO_MENSAJE_SESION_VENCIDA = 'editor-tienda:sesion-vencida' as const;

export interface MensajeSesionVencida {
  tipo: typeof TIPO_MENSAJE_SESION_VENCIDA;
  /** La sección del REGISTRY cuyo autoguardado cambió de estado — el aviso sólo se muestra si el
   *  campo ABIERTO en el iframe pertenece a ESTA sección (nunca el de otra, aunque comparta
   *  ventana). */
  seccion: string;
  /** `true`: el guardado acaba de fallar con 401 — el campo abierto de esta sección muestra
   *  `mensaje`. `false`: un guardado posterior tuvo éxito — retira el aviso si seguía puesto. */
  vencida: boolean;
  /** El texto a mostrar; sólo relevante cuando `vencida` es `true`. */
  mensaje?: string;
}

export function esMensajeSesionVencida(data: unknown): data is MensajeSesionVencida {
  if (!data || typeof data !== 'object') return false;
  const m = data as Record<string, unknown>;
  return (
    m.tipo === TIPO_MENSAJE_SESION_VENCIDA &&
    typeof m.seccion === 'string' && m.seccion.trim() !== '' &&
    typeof m.vencida === 'boolean' &&
    (m.mensaje === undefined || typeof m.mensaje === 'string')
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
