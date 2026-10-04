'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { AlignLeft, AlignCenter, AlignRight, ChevronDown, Minus, Plus, Trash2, Check } from 'lucide-react';
import { useSiteContent, useSiteContentActualizador } from '@/components/storefront/SiteContentProvider';
import {
  esMensajeContenidoSeccion, esSeccionDelRegistro, fusionarContenidoSeccion,
  esMensajeModoNavegar, TIPO_MENSAJE_SECCION_CLICK, TIPO_MENSAJE_CAMPO_CAMBIO,
  TIPO_MENSAJE_CAMPO_IMAGEN_CLICK, esMensajeSesionVencida, datosDeOrden, datosDeTema,
  datosDeEncabezado, fusionarContenidoInstancia,
  ATRIBUTO_EDITOR_ZONA_CAMPO, ATRIBUTO_EDITOR_ZONA_VALOR, ATRIBUTO_EDITOR_ZONA_CAMPO2,
  ATRIBUTO_EDITOR_ZONA_VALOR2, mensajesDeZonaHero,
  mensajeEstiloElemento, mensajesQuitarEstiloElemento, type MensajeCampoCambio,
  ATRIBUTO_EDITOR_CHROME, esClicEnChromeEditor,
  ATRIBUTO_EDITOR_ETIQUETA, etiquetaDeSeccion,
  TIPO_MENSAJE_AGREGAR_SECCION, ATRIBUTO_EDITOR_AGREGAR_SECCION,
} from '@/lib/storefront/editor-puente';
// `resolverOrden` (§ EDITOR-TIENDA-ORDEN-1): YA viaja en el bundle público por `editor-puente.ts`
// (que importa el módulo completo para `REGISTRY`/`DEFAULTS`/`resolverSiteContent`), así que
// importarla acá directo no agrega peso nuevo — ninguna razón para pasarla por un re-export.
// `bandaOscuraCanonica` (§ EDITOR-TIENDA-BARRA-FLOTANTE-1) decide el fondo real de la zona del
// hero para el filtro "se leen bien" de la barra flotante — MISMO motivo, ya viaja en el bundle.
import { BANDA_IDS, bandaOscuraCanonica } from '@/lib/config/site-content-defaults';
// `resolverOrdenCompleto`/`esInstanciaId` (§ SECCIONES-INSTANCIAS-1): MISMO motivo que
// `resolverOrden` arriba — `secciones-instancias.ts` ya viaja en el bundle público vía
// `site-content-defaults.ts` (que la importa para resolver `seccionesHome`/`orden`), así que
// importarla acá directo no agrega peso nuevo.
import { resolverOrdenCompleto, esInstanciaId, type InstanciaContent } from '@/lib/config/secciones-instancias';
// `ATRIBUTO_EDITOR_SECCION`/`ATRIBUTO_EDITOR_CAMPO`/`ATRIBUTO_EDITOR_LINEA` son admin-level por
// historia (nacieron junto a `proxy.ts`/`modo-editor-gate.ts`, § su docstring), pero son literales
// PUROS —sin `next/headers` ni Prisma—, así que importarlos acá no arrastra nada pesado: una sola
// definición de cada nombre, no dos que puedan divergir entre quien los lee (acá) y quien los
// escribe (`app/(storefront)/page.tsx`, `nosotros/page.tsx`, `suscripciones/Contenido.tsx`,
// `CampoEditable.tsx`).
import { ATRIBUTO_EDITOR_SECCION, ATRIBUTO_EDITOR_CAMPO, ATRIBUTO_EDITOR_LINEA } from '@/lib/admin/editor-iframe';
import {
  parsearRutaCampo, estiloCampoFlotante, ATRIBUTO_EDITOR_CAMPO_IMAGEN, ATRIBUTO_RUTA_EN_EDICION,
  type RutaCampo,
} from '@/lib/storefront/campo-editable';
// LA BARRA FLOTANTE (§ EDITOR-TIENDA-BARRA-FLOTANTE-1, docs/editor-tienda/REDISENO.md § 5) — el
// módulo nuevo de este slice, ya PÚBLICO vía `site-content-defaults.ts` (que lo importa para
// resolver `hero.estilos`), así que importarlo acá tampoco agrega peso nuevo.
import {
  metaElementoEstilo, TAMANOS_ELEMENTO, LABEL_TAMANO_ELEMENTO,
  ESTILO_ELEMENTO_VACIO, rolesColorLegibles,
  type EstiloElementoResuelto, type AlineacionElemento, type TamanoElemento,
} from '@/lib/config/estilo-elemento';
import { derivarPaleta, RAICES_DEFECTO, ROLES_COLOR_ELEMENTO, type RolColorElemento } from '@/lib/config/palette-derive';
import { PARES_FUENTES } from '@/lib/config/fuentes';

// EL PUENTE panel→iframe, mitad IMPURA (§ EDITOR-TIENDA-POSTMESSAGE-1). La lógica de forma/fusión
// vive en `lib/storefront/editor-puente.ts` (pura, testeada sin DOM); este componente es el
// envoltorio de `window`/`postMessage` — mismo criterio de siempre del repo.
//
// MONTADO SIEMPRE desde el layout del storefront (como ScrollInercia/BackToTop/RielSocial), y
// DECIDE SU PROPIO SILENCIO adentro por la prop `activo` (`modoEditorActivo()`, computado
// server-side — el MISMO booleano que ya gatea el `noindex` por-request, § `modo-editor-gate.ts`).
// AUSENTE/false (el 99.99% del tráfico: cualquier visitante real) → ningún efecto adjunta nada y
// `return null` corre de inmediato — cero bytes, cero listeners, cero CSS de más.
//
// EL `import()` DINÁMICO del schema (`siteContentEditableSchema`, zod) — NUNCA un import estático:
// zod + `site-content-schema.ts` no deben viajar en el bundle de CADA visitante público, sólo en el
// del dueño editando (§ "el peso es un costo real", CLAUDE.md — el mismo criterio que ya aplican
// jsPDF/mp4box/SheetJS en este repo). Se PRECARGA al activarse (no en el primer mensaje): una vez
// activo, el dueño va a teclear en segundos, y el `import()` sólo paga su costo de red una vez por
// carga de página — precargarlo evita que esa carga caiga justo en la primera tecla.
//
// LA SELECCIÓN EN CONTEXTO (§ EDITOR-TIENDA-SELECCION-1, § 4.1 de DISENO.md): este componente gana
// DOS responsabilidades más, las dos gateadas por el MISMO `activo` —nunca por `useIsPreview()`, el
// mecanismo VIEJO de `VistaTiendaEnVivo`/preview local, sin relación con el modo-borrador-por-
// request de este iframe (§ EDITOR-TIENDA-POSTMESSAGE-1 ya fijó esa distinción, no se repite acá)—:
//
//   1. UN CLIC DENTRO DE LA PÁGINA SELECCIONA, NO NAVEGA. Un listener de `click` en fase de CAPTURA
//      sobre `document` —fase de captura porque corre ANTES de que cualquier `<Link>`/`onClick` de
//      React llegue a ejecutarse; `stopPropagation()` ahí detiene la dispatch ENTERA del evento
//      (capture+target+bubble), nativo y sintético, para ese clic— intercepta TODO clic mientras el
//      modo Navegar esté apagado (el DEFAULT): `preventDefault()`+`stopPropagation()` siempre, y SI
//      el clic cayó dentro de un `[data-editor-seccion]` (ver `ATRIBUTO_EDITOR_SECCION`,
//      `lib/admin/editor-iframe.ts`), además avisa al panel por `postMessage` con el marcador — el
//      panel resuelve a qué `SeccionVista` corresponde (`seccionDesdeMarcador`) y abre/desplaza esa
//      sección en la lista (`VistaTiendaIframe.tsx` → `TiendaPaginas.tsx` → el `ref` de
//      `TiendaSeccionEditor`). Un clic FUERA de cualquier sección marcada (el nav, el pie, el
//      carrito — chrome global del layout, fuera de `<main>`) sólo se frena: no hay sección que
//      abrir, y frenarlo es lo que impide que "enlaces, botones, carrito y ojo" naveguen/disparen
//      (el pedido textual del spec).
//   2. "NAVEGAR" ES EL INTERRUPTOR QUE VUELVE A "USAR" LA TIENDA (decisión de esta tanda, pedida
//      explícitamente por el spec: "decidí cómo se vuelve a «usar» la tienda… y decilo"). Vive como
//      un botón en la barra de `VistaTiendaIframe.tsx` (el panel), que manda `TIPO_MENSAJE_MODO_
//      NAVEGAR` por `postMessage`; este componente lo escucha y, mientras esté en `true`, el
//      listener de clic de arriba NO HACE NADA —la tienda se usa exactamente como un visitante
//      real—. El estado vive en un REF (`navegarRef`), no en `useState`: lo único que depende de su
//      valor es la clase CSS de abajo (imperativa) y la rama del listener de clic — ninguno de los
//      dos necesita un re-render de este componente.
//
// LA CLASE `duna-editor-seleccion` EN `<html>` (puesta/quitada por este componente, nunca en
// `globals.css`) es lo que pinta el afordance de hover/cursor —outline punteado, el MISMO color que
// el resalte del panel (`COLOR_RESALTE`, `VistaTiendaIframe.tsx`: `--duna-sol`)— SÓLO mientras la
// selección está activa; con Navegar encendido se quita, para que no quede un cursor "pointer"
// mintiendo sobre un clic que ya no selecciona nada. El `<style>` que la declara se renderiza
// SIEMPRE que `activo` sea true (nunca condicionado a `navegar`): es sólo una regla CSS keyed por la
// clase, que es lo que realmente enciende/apaga el afordance.
//
// EL CAMPO FLOTANTE (§ EDITOR-TIENDA-CAMPO-EDITABLE-1, docs/editor-tienda/EDICION-INLINE.md § 2.2):
// un clic dentro de un nodo marcado `[data-editor-campo]` (ver `CampoEditable.tsx`) —con Navegar
// apagado, el mismo gate que la selección— monta, ENCIMA de ese nodo, un `<input>`/`<textarea>` REAL
// (nunca `contentEditable`: § el porqué completo en el docstring del diseño) con su MISMA
// tipografía/geometría (`getComputedStyle`/`getBoundingClientRect`, leídos acá; formateados por
// `estiloCampoFlotante`, puro, `lib/storefront/campo-editable.ts`), mientras el nodo real se oculta
// (`visibility: hidden`, conserva su layout — nunca texto duplicado en pantalla). Cada tecla manda
// `TIPO_MENSAJE_CAMPO_CAMBIO` al panel SIN DEBOUNCE propio (el puente ya mide 2.4–5ms por mensaje,
// § EDITOR-TIENDA-POSTMESSAGE-1 — más barato que agregar latencia percibida con un debounce), y el
// panel aplica el MISMO setter (`cambiar()`) que ya usa el input de la lista — el nodo contentEditable
// nunca es la fuente de verdad, el `form` del panel sí (§ el principio de § 2.1 del diseño).
//
// EL CLIC DENTRO DE CUALQUIER CONTROL PROPIO DEL EDITOR NO SE INTERCEPTA (§ EDITOR-BARRA-ESTILO-
// CLIC-1, `ATRIBUTO_EDITOR_CHROME`/`esClicEnChromeEditor`, `lib/storefront/editor-puente.ts`): el
// listener de arriba corre sobre TODO `document`, incluidos el `<input>`/`<textarea>` del overlay
// Y la barra flotante (§ EDITOR-TIENDA-BARRA-FLOTANTE-1) — los dos portaleados a `document.body`,
// cada uno en SU PROPIO portal. Sin esta guarda, cada clic para mover el caret DENTRO del campo
// abierto, o cada clic en un botón/select de la barra, se leería como "clic en otro sitio" y
// cerraría el campo sin aplicar nada (el defecto medido de este slice: la barra nunca recibía el
// `onClick` de React porque la intercepción corría primero). Un atributo COMPARTIDO —no un ref por
// control— es lo que hace que un control nuevo del editor herede esta excepción sin tocar el
// listener.
//
// UN SOLO CAMPO ABIERTO A LA VEZ (`campoAbierto`, estado): clickear OTRO campo marcado cierra el
// anterior (restaura `visibility`) antes de abrir el nuevo; clickear FUERA de cualquier campo
// (sección, chrome, u otro campo cerrado de golpe) también lo cierra. `Escape`/`Tab` cierran sin
// preguntar — no hay nada que "descartar": cada tecla YA viajó por el puente, así que al cerrar el
// nodo real ya refleja el valor nuevo (§ el ciclo panel→iframe de `TIPO_MENSAJE_CONTENIDO_SECCION`,
// que sigue intacto). `Enter` COMMITEA y cierra en un campo de una línea (`multilinea: false`); en
// uno de varias líneas inserta el salto, como cualquier `<textarea>` (no se previene el default).
//
// EL RESALTE DE SELECCIÓN (`:hover { outline: 2px dashed }`, la clase de arriba) NO COMPITE con el
// overlay abierto, POR CONSTRUCCIÓN: el nodo real queda `visibility: hidden` mientras edita, y un
// elemento no renderizado no puede recibir `:hover` — el overlay, aparte en el DOM (portal), nunca
// lleva el atributo `[data-editor-campo]` que ese selector CSS apunta. Nada que reconciliar a mano.
//
// EL CLIC EN UNA IMAGEN/VIDEO (§ EDITOR-TIENDA-CAMPO-EDITABLE-IMAGEN-1, EDICION-INLINE.md § 4): un
// nodo marcado `[data-editor-campo-imagen]` (`CampoEditable tipo="imagen"`) se revisa ANTES que
// `[data-editor-campo]` (texto) — los dos atributos nunca coexisten en el mismo nodo, así que no hay
// ambigüedad que resolver. En vez de abrir un overlay, manda `TIPO_MENSAJE_CAMPO_IMAGEN_CLICK` (sin
// `valor`, sólo la ruta) y cierra cualquier overlay de TEXTO que hubiera quedado abierto de un clic
// anterior — nunca monta un selector de archivos propio: el panel dispara PROGRAMÁTICAMENTE el mismo
// `<input type="file">` oculto que ya monta el control "Cambiar imagen"/"Cambiar video" de la lista
// (`TiendaSeccionEditor.abrirSelectorImagen`). El `seccion-click` de abajo se manda IGUAL para este
// clic (la sección se abre en la lista, como cualquier otro clic dentro de ella).
//
// EL AVISO DE SESIÓN VENCIDA (§ EDITOR-TIENDA-CAMPO-EDITABLE-SESION-1, EDICION-INLINE.md § 3): si el
// autoguardado de la sección del campo ABIERTO falla con 401 mientras el dueño teclea DENTRO del
// iframe, su atención no está en el panel —el banner que éste ya muestra puede pasar inadvertido—.
// El panel manda `TIPO_MENSAJE_SESION_VENCIDA` (`{seccion, vencida, mensaje}`) con el MISMO texto
// que ya usa para su propio aviso (`MSG_SESION_VENCIDA`, reusado, nunca copiado); este componente lo
// muestra como un chip FIJO justo debajo del overlay, SÓLO si el campo abierto es de esa sección.
// Nada se cierra ni se pierde: el valor tecleado sigue viajando por tecla como siempre (§ el
// principio de § 2.1 del diseño — el campo nunca es la fuente de verdad), y el mismo canal lo retira
// (`vencida:false`) en cuanto un guardado posterior tiene éxito (tras volver a iniciar sesión, el
// reintento automático del autoguardado lo logra solo, sin que el dueño tenga que hacer nada acá).
//
// DESHACER/REHACER (§ EDITOR-TIENDA-DESHACER-1, iframe→panel): Ctrl/Cmd+Z (y +Shift para rehacer)
// presionados DENTRO del iframe —el dueño mirando la página, no el panel— se reenvían al padre, que
// tiene el historial (`TiendaPaginas.tsx`, fuera de este árbol). SALVO que el foco esté en un campo
// editable del PROPIO documento del iframe —el overlay flotante (`campoAbierto`, abajo) o cualquier
// otro `<input>`/`<textarea>`/`contentEditable`—, donde manda el deshacer NATIVO del navegador sobre
// ESE campo (el pedido textual del spec, § `docs/editor-tienda/EDICION-INLINE.md`).
//
// EL DISCRIMINADOR VIVE ACÁ, NO EN `lib/storefront/editor-puente.ts` — y es una DESVIACIÓN MEDIDA
// contra `touches:`: ese módulo es donde CUALQUIER otro mensaje del puente declara su discriminador
// (`TIPO_MENSAJE_SECCION_CLICK`, `TIPO_MENSAJE_CAMPO_CAMBIO`…), pero no está en la lista de archivos
// de este slice y ampliarla no estaba autorizado. `TiendaPaginas.tsx` (el único receptor, SÍ en
// `touches:`) importa este const y esta función DIRECTO de este componente en vez de un módulo
// compartido — mismo patrón de nombre/forma que el resto del puente, roto sólo en DÓNDE vive.
export const TIPO_MENSAJE_DESHACER = 'editor-tienda:deshacer' as const;

export interface MensajeDeshacer {
  tipo: typeof TIPO_MENSAJE_DESHACER;
  /** `false` = deshacer, `true` = rehacer — un solo tipo de mensaje con un booleano, como
   *  `TIPO_MENSAJE_MODO_NAVEGAR` ya hace para su propio booleano. */
  rehacer: boolean;
}

export function esMensajeDeshacer(data: unknown): data is MensajeDeshacer {
  if (!data || typeof data !== 'object') return false;
  const m = data as Record<string, unknown>;
  return m.tipo === TIPO_MENSAJE_DESHACER && typeof m.rehacer === 'boolean';
}

const CLASE_SELECCION_ACTIVA = 'duna-editor-seleccion';

// ─── EL «+» ENTRE SECCIONES (§ EDITOR-AGREGAR-SECCION-LIENZO-1, docs/editor-tienda/
// AGREGAR-SECCIONES.md) — insertado por ESTE componente, NO por el storefront (que no está en
// `touches:` de este slice y, aunque lo estuviera, el afordance es editor-only: una banda SSR'd no
// debe nacer con un botón que un visitante real jamás ve). Mismo criterio que la selección en
// contexto y el campo flotante: chrome EFÍMERO superpuesto por JS, visible SÓLO mientras `activo`
// es `true` y el modo Navegar está apagado — con Navegar encendido la tienda se usa como un
// visitante real (§ el comentario grande de arriba), y estos botones desaparecen con el resto del
// afordance de selección.
//
// INSERCIÓN DIRECTA EN EL DOM, no un overlay posicionado-y-medido (como el campo flotante o la
// barra de estilo): un separador es un SIBLING real entre dos `<div data-editor-seccion>` —
// `nodo.insertAdjacentElement('afterend', …)` — así que sigue el FLUJO del documento sin
// `ResizeObserver` ni listeners de `scroll`/`resize`: si una sección crece o la ventana cambia de
// ancho, el separador se mueve solo, gratis, porque es parte del layout. Es seguro por la MISMA
// razón que el branch `seccion === 'orden'` de abajo puede reordenar nodos con `appendChild`:
// `Home` es un Server Component, su árbol de bandas nunca se reconcilia del lado del cliente
// (§ el comentario de ese branch), así que insertar nodos AJENOS a React en ese mismo contenedor
// no entra en conflicto con ningún re-render futuro — no hay ninguno.
//
// EL CLIC NO PASA POR REACT: igual que `[data-editor-zona-campo]`/`[data-editor-campo-imagen]`
// (§ el listener de clic, abajo), el botón no lleva `onClick` — lo reconoce el MISMO listener de
// captura sobre `document` que ya intercepta todo clic en modo selección, leyendo el atributo
// `ATRIBUTO_EDITOR_AGREGAR_SECCION` (editor-puente.ts) directo del nodo. Es consistente con cómo
// ya funciona TODO lo demás que este componente inserta/marca — nunca un segundo mecanismo.
const CLASE_SEPARADOR_AGREGAR = 'duna-editor-separador-agregar';
const CLASE_SEPARADOR_AGREGAR_LINEA = 'duna-editor-separador-agregar__linea';
const CLASE_SEPARADOR_AGREGAR_BOTON = 'duna-editor-separador-agregar__boton';

/** El nodo de UN separador — línea + pastilla «+», ninguno con `onClick` (§ arriba: el clic lo
 *  resuelve el listener de captura, leyendo `ATRIBUTO_EDITOR_AGREGAR_SECCION` del botón). */
function crearSeparadorAgregar(despuesDe: string): HTMLElement {
  const envoltorio = document.createElement('div');
  envoltorio.className = CLASE_SEPARADOR_AGREGAR;
  const linea = document.createElement('div');
  linea.className = CLASE_SEPARADOR_AGREGAR_LINEA;
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = CLASE_SEPARADOR_AGREGAR_BOTON;
  boton.textContent = '+ Agregar sección';
  boton.setAttribute('aria-label', 'Agregar sección aquí');
  boton.setAttribute(ATRIBUTO_EDITOR_AGREGAR_SECCION, despuesDe);
  envoltorio.appendChild(linea);
  envoltorio.appendChild(boton);
  return envoltorio;
}

/**
 * Pone (o repone) un separador después de cada sección del HOME — la única página con `orden`/
 * `seccionesHome` (§ CLAUDE.md, "SÓLO 'home' tiene content.orden"). El ancla para encontrar el
 * contenedor compartido es `hero` (`ocultable:false`, siempre presente): el MISMO truco que ya
 * usa el branch `seccion === 'orden'` de abajo para localizar dónde reordenar — leído por DOM, no
 * por `useSiteContent().orden`, que queda RANCIO tras un reorden en vivo (ese branch mueve nodos
 * sin tocar el context, § su propio comentario). En `nosotros`/`suscripciones` (sin `hero`, sin
 * `orden`) `contenedor` sale `null` y esta función no pone nada — no hay biblioteca que ofrecer
 * ahí.
 *
 * SIEMPRE retira los separadores viejos primero (recrear, no diffear: son ≤10 nodos vacíos, el
 * costo de recrearlos en cada 'orden'/toggle de Navegar es nulo frente a reconciliar posiciones a
 * mano) — `navegando=true` los deja retirados y no pone nada nuevo.
 */
function sincronizarSeparadoresAgregar(navegando: boolean) {
  document.querySelectorAll(`.${CLASE_SEPARADOR_AGREGAR}`).forEach((n) => n.remove());
  if (navegando) return;
  const hero = document.querySelector<HTMLElement>(`[${ATRIBUTO_EDITOR_SECCION}="hero"]`);
  const contenedor = hero?.parentElement;
  if (!contenedor) return;
  const nodos = Array.from(contenedor.children).filter(
    (n): n is HTMLElement => n instanceof HTMLElement && n.hasAttribute(ATRIBUTO_EDITOR_SECCION),
  );
  for (const nodo of nodos) {
    const marcador = nodo.getAttribute(ATRIBUTO_EDITOR_SECCION);
    if (marcador) nodo.insertAdjacentElement('afterend', crearSeparadorAgregar(marcador));
  }
}

/**
 * El RÓTULO al pasar el mouse (§ EDITOR-VISUAL-LIENZO-1, `.sec::after{content:attr(data-label)}`
 * del prototipo) — escribe `ATRIBUTO_EDITOR_ETIQUETA` sobre TODO `[data-editor-seccion]` del
 * documento (nav, pie, home, nosotros, suscripciones: a diferencia de los separadores «+», el
 * rótulo aplica a TODAS las páginas, no sólo al home con `orden`), con el valor que
 * `etiquetaDeSeccion` (puro, `lib/storefront/editor-puente.ts`) resuelve para cada marcador. El CSS
 * lee ese atributo con `content: attr(...)` — ver el `<style>` del render, abajo.
 *
 * Recorre TODOS los nodos marcados cada vez que se llama (como `sincronizarSeparadoresAgregar`): son
 * a lo sumo un puñado por página, así que recalcular es más simple que diferenciar cuáles cambiaron.
 */
function sincronizarEtiquetasSeccion(seccionesHome: Record<string, InstanciaContent>) {
  document.querySelectorAll<HTMLElement>(`[${ATRIBUTO_EDITOR_SECCION}]`).forEach((nodo) => {
    const marcador = nodo.getAttribute(ATRIBUTO_EDITOR_SECCION);
    if (!marcador) return;
    nodo.setAttribute(ATRIBUTO_EDITOR_ETIQUETA, etiquetaDeSeccion(marcador, seccionesHome));
  });
}

/**
 * Posta una LISTA de mensajes al panel, ESCALONADOS — nunca en un `for` síncrono. MEDIDO por
 * ejecución (§ EDITOR-TIENDA-ZONAS-1): el panel (`TiendaSeccionEditor.escribirCampo`) mergea cada
 * mensaje sobre `formRef.current`, que sólo se re-sincroniza en el RENDER siguiente a un `setForm`.
 * Dos `postMessage` posteados en la MISMA pila se procesan como dos eventos `message` separados,
 * pero si React no alcanza a re-renderizar entre uno y otro, el segundo mergea sobre el `formRef`
 * TODAVÍA viejo y PISA el resultado del primero — confirmado contra la base real: con el velo
 * combinado, `alto` quedaba en su valor viejo y sólo `alturaLlena` sobrevivía. Un `setTimeout` de
 * por medio le da tiempo a React a confirmar el primer `setForm` (un commit tarda microsegundos;
 * 80ms es generoso) antes de que llegue el siguiente. Usado por las zonas del hero (§ abajo) y por
 * "Quitar estilo" de la barra flotante (§ `mensajesQuitarEstiloElemento`, los CUATRO subcampos a la
 * vez) — la MISMA clase de problema, factorizada en un solo sitio en vez de reimplementada dos veces.
 */
function postarEscalonado(mensajes: MensajeCampoCambio[]) {
  mensajes.forEach((m, i) => {
    if (i === 0) window.parent.postMessage(m, window.location.origin);
    else window.setTimeout(() => window.parent.postMessage(m, window.location.origin), 80 * i);
  });
}

/** El estado del ÚNICO campo flotante que puede estar abierto a la vez. `ruta` ya viene PARSEADA
 *  (`parsearRutaCampo`) — sección + campo relativo — para no volver a parsear el atributo en cada
 *  tecla. `bloque` es el elemento que de verdad se mide (§ `elementoDeBloque`, abajo) — se guarda
 *  para que el `ResizeObserver`/los listeners de `scroll`/`resize` (§ EDITOR-TIENDA-CAMPO-ANCLADO-1)
 *  tengan a qué re-medir sin tener que volver a buscar el nodo. `estilo` SÍ se re-calcula — ya no
 *  "una vez al abrir": el documento puede cambiar de ancho (resize), el bloque puede crecer con el
 *  contenido (RO) y el scroll mueve la VENTANA aunque `position:absolute` no necesite re-medir sólo
 *  por eso (§ el docstring de `GeometriaCampo`, `lib/storefront/campo-editable.ts`). */
interface EstadoCampoAbierto {
  nodo: HTMLElement;
  bloque: HTMLElement;
  ruta: RutaCampo;
  multilinea: boolean;
  valor: string;
  estilo: Record<string, string | number>;
}

/**
 * El elemento de BLOQUE que de verdad hay que medir y copiar (§ EDITOR-TIENDA-CAMPO-ANCLADO-1,
 * cierra el error 3 de `docs/editor-tienda/REDISENO.md` § 1) — nunca el `<span>` que
 * `CampoEditable` marca, que es `display:inline` y por tanto mide su CAJA DE TEXTO, no la del
 * párrafo que lo contiene.
 *
 * Sube EXACTAMENTE UN nivel: si el padre directo del marcador NO es `inline` (el caso de CASI
 * todo el storefront — `CampoEditable` es casi siempre el único hijo de un `<p>`/`<h1>`/`<h2>`,
 * medido contra el código: `NosotrosHistoria.tsx`, los `subtitulo`/`fraseAlPie` del hero, los
 * párrafos de `BrandStoryColumnas`/`BrandStoryCentrada`, …), ESE padre es el bloque. Si el padre
 * SIGUE siendo inline (el caso de `marquesina.texto`: `CampoEditable` vive dentro de un `<span
 * className="pr-[0.5em]">` que a su vez vive dentro del `motion.div.flex` del ticker — ESE
 * `motion.div` es `display:flex` y mide el ANCHO DE LAS DOS COPIAS juntas, no el de una línea de
 * texto), la función se QUEDA en el marcador — el comportamiento de HOY para ese caso, que no
 * tiene el defecto de las copias colapsadas que esto arregla (es una sola línea, sin `\n`). Subir
 * SIN TOPE (hasta el primer `display` no-inline, sea el nivel que sea) fue la primera versión y
 * medida contra `marquesina.texto` daba el `motion.div.flex` del ticker — el ancho de las DOS
 * copias, no el de la línea — así que el tope de UN nivel es DELIBERADO, no una simplificación.
 */
function elementoDeBloque(nodo: HTMLElement): HTMLElement {
  const padre = nodo.parentElement;
  if (!padre) return nodo;
  return window.getComputedStyle(padre).display === 'inline' ? nodo : padre;
}

/** Lo que el overlay necesita COPIAR del BLOQUE (§ `elementoDeBloque`) para verse "visualmente
 *  indistinguible" (§ el diseño) — impuro (DOM), separado de `estiloCampoFlotante` (puro) para que
 *  la FORMA del `style` resultante se pueda testear sin montar nada en un navegador. `whiteSpace`
 *  (§ EDITOR-TIENDA-CAMPO-ANCLADO-1) es lo que hace que un `\n` que el bloque COLAPSA
 *  (`white-space: normal`, el default de un `<p>`) también se colapse en el `<textarea>` — que sin
 *  esto renderiza con `white-space: pre-wrap` (el default del navegador para ese control) y pide
 *  una línea más de las que el bloque real muestra. */
function leerTipografia(bloque: HTMLElement) {
  const cs = window.getComputedStyle(bloque);
  return {
    fontFamily: cs.fontFamily,
    fontSize: cs.fontSize,
    fontWeight: cs.fontWeight,
    fontStyle: cs.fontStyle,
    lineHeight: cs.lineHeight,
    letterSpacing: cs.letterSpacing,
    textAlign: cs.textAlign,
    textTransform: cs.textTransform,
    whiteSpace: cs.whiteSpace,
    color: cs.color,
    padding: cs.padding,
  };
}

/** La geometría DOCUMENTO-relativa del bloque, lista para `estiloCampoFlotante` (§ su docstring en
 *  `lib/storefront/campo-editable.ts`): `getBoundingClientRect()` (viewport) + el scroll actual. */
function medirGeometriaDocumento(bloque: HTMLElement) {
  const rect = bloque.getBoundingClientRect();
  return { top: rect.top + window.scrollY, left: rect.left + window.scrollX, width: rect.width, height: rect.height };
}

export default function EditorPuenteVivo({ activo }: { activo: boolean }) {
  const actualizar = useSiteContentActualizador();
  // LA BARRA FLOTANTE (§ EDITOR-TIENDA-BARRA-FLOTANTE-1) necesita LEER el contenido en vivo —el
  // valor actual del elemento abierto (para resaltar la selección) y la paleta derivada del tenant
  // (para el filtro "se leen bien sobre el fondo de esta zona", § `rolesColorLegibles`,
  // estilo-elemento.ts) — algo que ningún otro mensaje de este componente necesitaba hasta ahora
  // (el resto sólo ESCRIBE, vía `actualizar`/`postMessage`). Seguro siempre: este componente vive
  // SIEMPRE dentro de `<SiteContentProvider>` (§ app/(storefront)/layout.tsx).
  // `seccionesHome` (§ SECCIONES-INSTANCIAS-1): necesario para que el branch de 'orden' (abajo)
  // sepa qué ids de instancia EXISTEN de verdad al re-resolver el DOM — mismo contrato que
  // `resolverOrdenCompleto` en todo el resto del mecanismo.
  const { hero, tema, seccionesHome } = useSiteContent();
  const schemaRef = useRef<typeof import('@/lib/config/site-content-schema') | null>(null);
  const navegarRef = useRef(false);

  // LOS ROLES LEGIBLES (§ el filtro de `estilo-elemento.ts`): derivados UNA VEZ por cambio de
  // paleta/variante, no en cada tecla — la barra los usa sólo mientras hay un campo de TEXTO
  // abierto, pero calcularlos siempre es más simple que gatearlos, y el costo es matemática pura
  // (sin red, sin DOM) sobre, como mucho, un puñado de hex.
  const derivado = useMemo(
    () => derivarPaleta(
      { fondo: tema.fondo ?? RAICES_DEFECTO.fondo, tinta: tema.tinta ?? RAICES_DEFECTO.tinta, acento: tema.acento ?? RAICES_DEFECTO.acento },
      { origenTexto: tema.origenTexto ?? undefined, origenAccion: tema.origenAccion ?? undefined },
    ),
    [tema.fondo, tema.tinta, tema.acento, tema.origenTexto, tema.origenAccion],
  );
  // Hoy el ÚNICO llamador declara elementos estilizables en `hero` (§ ELEMENTOS_ESTILO,
  // estilo-elemento.ts) — `bandaOscuraCanonica('hero', …)` es por tanto la zona correcta sin
  // necesitar leer `ruta.seccion` (que todavía no existe en este punto del render).
  const oscura = bandaOscuraCanonica('hero', hero.variante);
  const rolesLegibles = useMemo(() => rolesColorLegibles(derivado, oscura), [derivado, oscura]);

  // ── EL CAMPO FLOTANTE (§ arriba) ───────────────────────────────────────────────────────────────
  const [campoAbierto, setCampoAbierto] = useState<EstadoCampoAbierto | null>(null);
  const campoAbiertoRef = useRef<EstadoCampoAbierto | null>(null);
  campoAbiertoRef.current = campoAbierto;
  // EL RE-MEDIDO del campo abierto (§ EDITOR-TIENDA-CAMPO-ANCLADO-1, cierra el error 3 y la mitad
  // de resize/contenido del error 4): un `ResizeObserver` sobre el BLOQUE (cambia de alto cuando el
  // contenido crece — incluida la propia tecla que se está tipeando, porque el bloque real sigue
  // renderizando el valor en vivo aunque esté `visibility:hidden`) + `scroll`/`resize` de `window`
  // (por si algo MÁS arriba en la página cambia de alto mientras el campo está abierto). Guarda la
  // función de limpieza del campo ACTUAL para poder cortarla antes de abrir otro — nunca dos
  // observers vivos a la vez.
  const limpiarMedicionRef = useRef<() => void>(() => {});

  // EL AVISO DE SESIÓN VENCIDA (§ EDITOR-TIENDA-CAMPO-EDITABLE-SESION-1, EDICION-INLINE.md § 3): el
  // texto ya resuelto que llega por `TIPO_MENSAJE_SESION_VENCIDA` cuando el autoguardado del CAMPO
  // ABIERTO falla con 401 — `null` = nada que mostrar. Vive SIEMPRE atado al campo abierto (se limpia
  // al cerrar/abrir OTRO), nunca sobrevive a un cierre: no hay nada que "descartar" acá, el panel
  // sigue siendo la fuente de verdad del estado real.
  const [avisoSesion, setAvisoSesion] = useState<string | null>(null);

  // LA PREVISUALIZACIÓN AL PASAR EL MOUSE (§ EDITOR-TIENDA-BARRA-FLOTANTE-1, REDISENO.md § 5: "al
  // pasar el mouse se previsualiza en la página"): un `color` CSS temporal —nunca posteado, nunca
  // guardado— que `BarraEstiloElemento` enciende en `onMouseEnter` de un swatch de rol y apaga en
  // `onMouseLeave`. Vive ACÁ (no dentro de la barra) porque tiene que mezclarse en el `style` del
  // OVERLAY, que es otro componente — la barra no puede tocar el DOM del overlay directamente.
  const [previewColorCss, setPreviewColorCss] = useState<string | null>(null);

  const cerrarCampo = () => {
    const abierto = campoAbiertoRef.current;
    if (abierto) abierto.nodo.style.visibility = '';
    limpiarMedicionRef.current();
    limpiarMedicionRef.current = () => {};
    document.documentElement.removeAttribute(ATRIBUTO_RUTA_EN_EDICION);
    setCampoAbierto(null);
    setAvisoSesion(null);
    setPreviewColorCss(null);
  };

  const abrirCampo = (nodo: HTMLElement) => {
    const rutaAtributo = nodo.getAttribute(ATRIBUTO_EDITOR_CAMPO);
    if (!rutaAtributo) return;
    const ruta = parsearRutaCampo(rutaAtributo);
    if (!ruta) return; // ruta mal formada — preferir callar (§ `parsearRutaCampo`)

    const yaAbierto = campoAbiertoRef.current;
    if (yaAbierto) {
      if (yaAbierto.nodo === nodo) return; // el mismo campo — nada que reabrir
      yaAbierto.nodo.style.visibility = ''; // cierra el anterior, comiteando su valor (ya viajó por tecla)
      limpiarMedicionRef.current(); // corta el RE-MEDIDO del campo anterior antes de armar el nuevo
    }

    const multilinea = nodo.getAttribute(ATRIBUTO_EDITOR_LINEA) === 'multiple';
    const bloque = elementoDeBloque(nodo);
    const estilo = estiloCampoFlotante(medirGeometriaDocumento(bloque), leerTipografia(bloque));
    nodo.style.visibility = 'hidden';
    const rutaCompleta = `${ruta.seccion}.${ruta.campo}`;
    document.documentElement.setAttribute(ATRIBUTO_RUTA_EN_EDICION, rutaCompleta);
    setAvisoSesion(null); // un campo nuevo nace sin el aviso del campo anterior
    setPreviewColorCss(null); // ídem: la previsualización de hover no debe sobrevivir a OTRO campo
    setCampoAbierto({ nodo, bloque, ruta, multilinea, valor: nodo.textContent ?? '', estilo });

    // EL RE-MEDIDO (§ el docstring de `limpiarMedicionRef`): cada disparo recalcula la geometría
    // DESDE EL BLOQUE FRESCO (nunca desde un valor capturado) y actualiza sólo `estilo` —
    // `valor`/`nodo`/`bloque`/`ruta` no cambian entre disparos de un mismo campo abierto.
    const reMedir = () => {
      const nuevoEstilo = estiloCampoFlotante(medirGeometriaDocumento(bloque), leerTipografia(bloque));
      setCampoAbierto((prev) => (prev && prev.bloque === bloque ? { ...prev, estilo: nuevoEstilo } : prev));
    };
    const limpiezas: Array<() => void> = [];
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(reMedir);
      ro.observe(bloque);
      limpiezas.push(() => ro.disconnect());
    }
    window.addEventListener('scroll', reMedir, { passive: true });
    limpiezas.push(() => window.removeEventListener('scroll', reMedir));
    window.addEventListener('resize', reMedir);
    limpiezas.push(() => window.removeEventListener('resize', reMedir));
    limpiarMedicionRef.current = () => { for (const limpiar of limpiezas) limpiar(); };
  };

  // Al DESMONTAR este componente (navegación del iframe, `activo` pasando a false) con un campo
  // todavía abierto: corta el RE-MEDIDO y borra el atributo — sin esto, un `ResizeObserver`/listener
  // de `scroll` quedaría observando un nodo de un documento que ya no es éste, y el atributo
  // `ATRIBUTO_RUTA_EN_EDICION` seguiría puesto en un `<html>` que ya no tiene overlay que lo explique.
  useEffect(() => () => {
    limpiarMedicionRef.current();
    document.documentElement.removeAttribute(ATRIBUTO_RUTA_EN_EDICION);
  }, []);

  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    import('@/lib/config/site-content-schema').then((mod) => { if (vivo) schemaRef.current = mod; });
    return () => { vivo = false; };
  }, [activo]);

  useEffect(() => {
    if (!activo || !actualizar) return;

    // Selección activa de ARRANQUE (el default, § arriba) — antes de que llegue ningún mensaje.
    document.documentElement.classList.add(CLASE_SELECCION_ACTIVA);
    // § EDITOR-AGREGAR-SECCION-LIENZO-1 — los separadores «+» de ARRANQUE, con el mismo default
    // (selección activa) que la clase de arriba.
    sincronizarSeparadoresAgregar(navegarRef.current);
    // § EDITOR-VISUAL-LIENZO-1 — los rótulos de ARRANQUE (el hover ya debe tener nombre desde el
    // primer frame, no recién tras el primer mensaje del panel).
    sincronizarEtiquetasSeccion(seccionesHome);

    const onMessage = (e: MessageEvent) => {
      // Mismo origen SIEMPRE — el panel y la tienda son el MISMO despliegue (§ MODO-EDITOR-SOLO-EN-
      // EL-IFRAME-1); un mensaje de otro origen no puede venir del panel que lo embebe.
      if (e.origin !== window.location.origin) return;

      if (esMensajeModoNavegar(e.data)) {
        navegarRef.current = e.data.navegar;
        document.documentElement.classList.toggle(CLASE_SELECCION_ACTIVA, !e.data.navegar);
        // § EDITOR-AGREGAR-SECCION-LIENZO-1 — Navegar ON retira los «+» (visitante real, § arriba);
        // Navegar OFF los repone.
        sincronizarSeparadoresAgregar(e.data.navegar);
        return;
      }

      // § EDITOR-TIENDA-CAMPO-EDITABLE-SESION-1 — el quinto mensaje: el autoguardado de ESTA
      // sección falló/volvió a funcionar. Sólo importa si pertenece al campo que está ABIERTO
      // ahora mismo (comparando `ruta.seccion`, no el nodo) — un aviso de otra sección no debe
      // aparecer junto a un campo que no tiene nada que ver con ese guardado.
      if (esMensajeSesionVencida(e.data)) {
        const abierto = campoAbiertoRef.current;
        if (abierto && abierto.ruta.seccion === e.data.seccion) {
          setAvisoSesion(e.data.vencida ? (e.data.mensaje ?? 'Tu sesión expiró.') : null);
        }
        return;
      }

      if (!esMensajeContenidoSeccion(e.data)) return;
      const { seccion, datos } = e.data;

      // § EDITOR-TIENDA-ORDEN-1 — 'orden' es clave META (como 'tema'/'paginas'), fuera del REGISTRY
      // a propósito (`SeccionKey` la excluye, site-content-defaults.ts), así que NO pasa por
      // `fusionarContenidoSeccion` (key-agnóstica sólo para claves DEL registro) ni por el
      // context —ningún band lee `content.orden` reactivamente: la secuencia la fija `page.tsx` en
      // el SERVIDOR, una sola vez por carga del documento—. Lo que SÍ hay que mover es el DOM real:
      // cada banda deja su propio marcador `data-editor-seccion` (sólo en modo editor, § page.tsx),
      // mismo origen, así que reordenar sus nodos con `appendChild` es la MISMA técnica que
      // `VistaTiendaIframe.tsx` ya usa para desplazar/resaltar — manipulación directa en vez de
      // reinventar con CSS lo que el DOM ya puede hacer (§ DISENO.md § 4.1.1). `appendChild` sobre
      // un nodo YA EN EL ÁRBOL lo MUEVE (no lo duplica); es seguro acá porque `Home` es un Server
      // Component — su árbol de bandas no vuelve a reconciliarse del lado del cliente, así que
      // React nunca intenta deshacer este reordenamiento externo.
      if (seccion === 'orden') {
        const crudo = datosDeOrden(datos);
        if (!crudo) return;
        // § SECCIONES-INSTANCIAS-1: `resolverOrdenCompleto` (no la vieja `resolverOrden`, que sólo
        // conoce `BANDA_IDS`) para que un reorder que incluya una instancia mueva TAMBIÉN su nodo
        // `[data-editor-seccion]` — el mismo marcador que `page.tsx` ya pone, id de instancia o no
        // (§ `bandaNodo`, `app/(storefront)/page.tsx`).
        const nuevoOrden = resolverOrdenCompleto(crudo, BANDA_IDS, Object.keys(seccionesHome));
        const primerNodo = document.querySelector<HTMLElement>(`[data-editor-seccion="${nuevoOrden[0]}"]`);
        const contenedor = primerNodo?.parentElement;
        if (!contenedor) return; // otra página (ningún marcador coincide) — no-op, nunca un error
        for (const id of nuevoOrden) {
          const nodo = document.querySelector<HTMLElement>(`[data-editor-seccion="${id}"]`);
          if (nodo) contenedor.appendChild(nodo);
        }
        // § EDITOR-AGREGAR-SECCION-LIENZO-1 — las secciones se movieron: los separadores «+»
        // (descubiertos por DOM, § `sincronizarSeparadoresAgregar`) se reponen en las posiciones
        // nuevas. Sin esto quedarían pegados a los ids viejos que ya no son sus vecinos.
        sincronizarSeparadoresAgregar(navegarRef.current);
        // § EDITOR-VISUAL-LIENZO-1 — reordenar NO cambia ningún rótulo (los nodos se MUEVEN, no se
        // recrean), pero una instancia nueva recién agregada podría no tener el suyo todavía si el
        // mensaje de 'orden' llegó antes que la primera sincronización — barato de re-correr.
        sincronizarEtiquetasSeccion(seccionesHome);
        return;
      }

      // § EDITOR-TIENDA-TEMA-1 — el séptimo mensaje: 'tema' es clave META (como 'orden'), fuera del
      // REGISTRY a propósito, así que tampoco pasa por `fusionarContenidoSeccion` ni por el context
      // —un tema no es contenido que React deba re-renderizar, es presentación que CSS ya lee por
      // cascada—. Las vars viajan SIEMPRE COMPLETAS (`varsDeTemaEnVivo`, el lado del panel, § el
      // docstring de `datosDeTema`), así que acá basta con APLICARLAS: nunca hay que decidir qué
      // `removeProperty`. Van en `documentElement.style` —no en un `<style>` nuevo— porque un valor
      // puesto ahí gana sobre CUALQUIER regla de hoja de estilo, incluido el `:root{…}` server-
      // rendered que ya pintó esta carga con el tema PUBLICADO.
      if (seccion === 'tema') {
        const vars = datosDeTema(datos);
        if (!vars) return;
        const raiz = document.documentElement.style;
        for (const [clave, valor] of Object.entries(vars)) raiz.setProperty(clave, valor);
        return;
      }

      // § EDITOR-TIENDA-CROMO-1 — el octavo mensaje: 'encabezado' es clave META COMBINADA (como
      // 'orden'/'tema'), fuera del REGISTRY a propósito, pero a diferencia de esas dos SÍ necesita
      // re-renderizar React — `StoreNav.tsx` lee `cromo`/`navWordmark`/`navTratamiento`/
      // `navDrawerMovil` por `useSiteContent()`, no por CSS ni por el DOM directo. `logo` —la quinta
      // pieza de esta misma tarjeta, pero SÍ sección del REGISTRY— llega por su propio mensaje
      // (`seccion: 'logo'`), sin pasar por acá.
      if (seccion === 'encabezado') {
        const partes = datosDeEncabezado(datos);
        if (!partes) return;
        actualizar((prev) => ({ ...prev, ...partes }) as typeof prev);
        return;
      }

      // § SECCIONES-INSTANCIAS-1 — el noveno mensaje: `seccion` puede ser el id de una INSTANCIA de
      // `seccionesHome` (`inst:…`) en vez de una clave del REGISTRY. SIN UI de admin todavía que
      // emita este mensaje (§ el docstring de `fusionarContenidoInstancia`, editor-puente.ts) —
      // plomería receptora lista, inerte hasta que esa UI exista.
      const esInstancia = esInstanciaId(seccion);
      if (!esInstancia && !esSeccionDelRegistro(seccion)) return;

      const aplicar = (schema: typeof import('@/lib/config/site-content-schema')) => {
        // El sub-schema de UNA instancia es el elemento del `z.record` de `seccionesHome` (la unión
        // discriminada por tipo) — DISTINTO objeto que el sub-schema de una sección del REGISTRY
        // (`shape[seccion]` directo), así que la validación bifurca ANTES de llegar al parse.
        // `.valueType` (zod 4 — NO `.valueSchema`, el nombre de zod 3; verificado contra el paquete
        // instalado, `node_modules/zod/package.json` dice "4.4.3") es el schema del VALOR del
        // record — `.unwrap()` primero porque `shape.seccionesHome` es `ZodOptional<ZodRecord<…>>`.
        const subSchema = esInstancia
          ? (schema.siteContentEditableSchema.shape.seccionesHome as unknown as {
              unwrap: () => { valueType: { safeParse: (v: unknown) => { success: boolean; data?: unknown } } };
            }).unwrap().valueType
          : (schema.siteContentEditableSchema.shape as Record<
              string,
              { safeParse: (v: unknown) => { success: boolean; data?: unknown } }
            >)[seccion];
        const parsed = subSchema?.safeParse(datos);
        // Un mensaje que no valida (un shape a medio teclear que el schema rechaza, una sección sin
        // sub-schema) se IGNORA — preferir callar a aplicar un borrador a medias que el schema de
        // guardado tampoco aceptaría. El próximo mensaje (la próxima tecla) lo intenta de nuevo.
        if (!parsed || !parsed.success) return;
        const datosValidados = parsed.data as Record<string, unknown>;
        actualizar((prev) => (esInstancia
          ? fusionarContenidoInstancia(prev, seccion, datosValidados)
          : fusionarContenidoSeccion(prev, seccion, datosValidados)));
      };

      if (schemaRef.current) {
        aplicar(schemaRef.current);
        return;
      }
      import('@/lib/config/site-content-schema').then((mod) => {
        schemaRef.current = mod;
        aplicar(mod);
      });
    };

    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      document.documentElement.classList.remove(CLASE_SELECCION_ACTIVA);
      // § EDITOR-AGREGAR-SECCION-LIENZO-1 — retira los separadores «+» insertados a mano (nunca
      // deja un nodo huérfano en un documento que ya no tiene este efecto vivo para limpiarlo).
      document.querySelectorAll(`.${CLASE_SEPARADOR_AGREGAR}`).forEach((n) => n.remove());
    };
  }, [activo, actualizar]);

  // DESHACER/REHACER (§ el comentario grande, arriba) — efecto PROPIO, independiente del de clics:
  // no depende de `navegarRef` (deshacer no es "seleccionar", corre con Navegar en cualquier
  // estado) ni de `actualizar` (no toca el contenido DIRECTO, sólo avisa al panel).
  useEffect(() => {
    if (!activo) return;
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      const modificador = e.metaKey || e.ctrlKey;
      if (!modificador || e.key.toLowerCase() !== 'z') return;
      const foco = document.activeElement;
      // El deshacer NATIVO del campo manda — tanto el overlay flotante (un `<input>`/`<textarea>`
      // real, § el principio de § 2.2 del diseño) como cualquier otro control editable del
      // documento. Sin esta guarda, Ctrl+Z dentro del overlay deshace la ÚLTIMA tecla (undo del
      // navegador) Y el paso del historial del panel a la vez — dos deshacer por un solo gesto.
      const esEditable = foco instanceof HTMLElement
        && (foco.tagName === 'INPUT' || foco.tagName === 'TEXTAREA' || foco.isContentEditable);
      if (esEditable) return;
      e.preventDefault();
      window.parent.postMessage({ tipo: TIPO_MENSAJE_DESHACER, rehacer: e.shiftKey }, window.location.origin);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [activo]);

  // EL CLIC INTERCEPTADO (§ el comentario grande de arriba). Efecto SEPARADO del de los mensajes:
  // no depende de `actualizar` (la selección en contexto no toca el contenido), y así un eventual
  // `actualizar` nulo (fuera del provider — no debería pasar en producción) no desactiva también la
  // selección.
  //
  // EXTENDIDO por el campo flotante (§ EDITOR-TIENDA-CAMPO-EDITABLE-1): antes de resolver la
  // sección (como siempre), mira si el clic cayó DENTRO de un campo marcado — si sí, abre su
  // overlay; si no, y había uno abierto, lo cierra (clic afuera). La sección SIGUE resolviéndose
  // igual que antes, aunque el clic haya abierto un campo (§ EDICION-INLINE.md § 2.4: "se manda
  // seccion-click igual" — un clic en el título abre "Portada" en la lista Y deja escribir ahí
  // mismo).
  useEffect(() => {
    if (!activo) return;
    const onClick = (e: MouseEvent) => {
      if (navegarRef.current) return; // modo Navegar: comportamiento normal, no se intercepta nada
      const destino = e.target as HTMLElement | null;
      // Un clic DENTRO de cualquier control propio del editor (overlay, barra flotante, aviso de
      // sesión…) no se intercepta (§ el comentario grande, § EDITOR-BARRA-ESTILO-CLIC-1).
      if (esClicEnChromeEditor(destino)) return;

      e.preventDefault();
      e.stopPropagation();

      // § EDITOR-AGREGAR-SECCION-LIENZO-1 — se revisa PRIMERO, antes de zona/campo-imagen/campo: el
      // «+» insertado por `sincronizarSeparadoresAgregar` (arriba) vive FUERA de cualquier sección
      // marcada (es un sibling entre dos `[data-editor-seccion]`, nunca su descendiente), así que no
      // puede ambiguar con ninguno de los otros marcadores — pero revisarlo primero documenta que es
      // la capa MÁS externa del lienzo, la misma razón por la que una zona del hero se revisa antes
      // que su campo de texto.
      const nodoAgregar = destino?.closest<HTMLElement>(`[${ATRIBUTO_EDITOR_AGREGAR_SECCION}]`);
      if (nodoAgregar) {
        if (campoAbiertoRef.current) cerrarCampo();
        const despuesDe = nodoAgregar.getAttribute(ATRIBUTO_EDITOR_AGREGAR_SECCION);
        if (despuesDe) {
          window.parent.postMessage({ tipo: TIPO_MENSAJE_AGREGAR_SECCION, despuesDe }, window.location.origin);
        }
      } else {
        // § EDITOR-TIENDA-ZONAS-1 — se revisa ANTES que campo-imagen/campo (§ `mensajesDeZonaHero`,
        // `lib/storefront/editor-puente.ts`): un botón de zona ("+ Titular", "Quitar", Alto, Velo)
        // nunca abre el overlay de texto ni el selector de archivos — escribe el/los campo(s) que su
        // propio marcador declara, directo.
        const nodoZona = destino?.closest<HTMLElement>(`[${ATRIBUTO_EDITOR_ZONA_CAMPO}]`);
        if (nodoZona) {
          if (campoAbiertoRef.current) cerrarCampo();
          const mensajes = mensajesDeZonaHero(
            nodoZona.getAttribute(ATRIBUTO_EDITOR_ZONA_CAMPO),
            nodoZona.getAttribute(ATRIBUTO_EDITOR_ZONA_VALOR),
            nodoZona.getAttribute(ATRIBUTO_EDITOR_ZONA_CAMPO2),
            nodoZona.getAttribute(ATRIBUTO_EDITOR_ZONA_VALOR2),
          );
          // ESCALONADOS, no en un `for` síncrono — § `postarEscalonado`, arriba, para el porqué.
          postarEscalonado(mensajes);
        } else {
          // § EDITOR-TIENDA-CAMPO-EDITABLE-IMAGEN-1 — se revisa PRIMERO (§ el comentario grande de
          // arriba): un campo-imagen nunca abre el overlay de texto.
          const nodoCampoImagen = destino?.closest<HTMLElement>(`[${ATRIBUTO_EDITOR_CAMPO_IMAGEN}]`);
          if (nodoCampoImagen) {
            if (campoAbiertoRef.current) cerrarCampo();
            const rutaAtributo = nodoCampoImagen.getAttribute(ATRIBUTO_EDITOR_CAMPO_IMAGEN);
            const ruta = rutaAtributo ? parsearRutaCampo(rutaAtributo) : null;
            if (ruta) {
              window.parent.postMessage(
                { tipo: TIPO_MENSAJE_CAMPO_IMAGEN_CLICK, seccion: ruta.seccion, campo: ruta.campo },
                window.location.origin,
              );
            }
          } else {
            const nodoCampo = destino?.closest<HTMLElement>(`[${ATRIBUTO_EDITOR_CAMPO}]`);
            if (nodoCampo) {
              abrirCampo(nodoCampo);
            } else if (campoAbiertoRef.current) {
              cerrarCampo();
            }
          }
        }
      }

      // § EDITOR-AGREGAR-SECCION-LIENZO-1 — el separador «+» vive FUERA de cualquier sección
      // marcada: `closest([data-editor-seccion])` sobre su nodo da `null` acá, así que el clic en
      // el «+» NUNCA dispara TAMBIÉN un `TIPO_MENSAJE_SECCION_CLICK` de paso.
      const nodo = destino?.closest<HTMLElement>(`[${ATRIBUTO_EDITOR_SECCION}]`);
      const seccion = nodo?.getAttribute(ATRIBUTO_EDITOR_SECCION);
      if (!seccion) return; // clic fuera de cualquier sección marcada (nav/pie/chrome): sólo se frena
      window.parent.postMessage({ tipo: TIPO_MENSAJE_SECCION_CLICK, seccion }, window.location.origin);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `abrirCampo`/`cerrarCampo` se
    // redefinen en cada render pero sólo leen/escriben REFS y el setter de React (nunca estado de
    // render capturado por closure) — incluirlas en las deps reharía este efecto (quitar/poner el
    // listener) en cada tecla del campo flotante, sin ganar nada.
  }, [activo]);

  if (!activo) return null;
  return (
    <>
      {/* § EDITOR-VISUAL-LIENZO-1 — EL HOVER/SELECCIÓN Y EL «+» ENTRE SECCIONES, con la anatomía del
          prototipo (`docs/editor-tienda/prototipo/prototipo-editor.html`, `.sec`/`.sec::before`/
          `.sec::after`, `.add-sec`): borde en tinta (blanco sobre el hero, que es la banda OSCURA
          por defecto — `.hero.sec:hover::before` del prototipo usa el mismo contraste invertido) +
          rótulo oscuro mono-chico en la esquina superior izquierda, en vez del outline punteado
          ámbar sin nombre que había antes. `position:relative` es NUEVO sobre estos nodos —lo que
          hace posible anclar el rótulo (`::after`, `position:absolute`)—: se verificó que ninguno
          de los wrappers marcados (los `<div data-editor-seccion>` de `page.tsx`, el `<nav>` de
          `menu` —ya `relative` por su propia clase—, el `<footer>`) depende de quedar SIN contexto
          de posicionamiento propio; el único `position:fixed` del árbol (el `<header>` de
          `StoreNav.tsx`) nunca lleva este atributo. */}
      <style>{`
        .${CLASE_SELECCION_ACTIVA} [${ATRIBUTO_EDITOR_SECCION}] { cursor: pointer; position: relative; }
        .${CLASE_SELECCION_ACTIVA} [${ATRIBUTO_EDITOR_SECCION}]:hover {
          box-shadow: inset 0 0 0 1.5px rgba(20,19,17,.55);
        }
        .${CLASE_SELECCION_ACTIVA} [${ATRIBUTO_EDITOR_SECCION}="hero"]:hover {
          box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.8);
        }
        .${CLASE_SELECCION_ACTIVA} [${ATRIBUTO_EDITOR_SECCION}]:hover::after {
          content: attr(${ATRIBUTO_EDITOR_ETIQUETA});
          position: absolute; left: 10px; top: 10px; z-index: 2147483000;
          font: 600 11px/1 'Hanken Grotesk', system-ui, sans-serif;
          color: #fff; background: #141311; padding: 6px 8px; border-radius: 6px;
          pointer-events: none; white-space: nowrap;
        }
        .${CLASE_SEPARADOR_AGREGAR} {
          position: relative; height: 24px; margin: 0; display: flex; align-items: center;
          cursor: pointer;
        }
        .${CLASE_SEPARADOR_AGREGAR_LINEA} {
          flex: 1; height: 1px; background: rgba(20,19,17,.18); transition: background 120ms ease;
        }
        .${CLASE_SEPARADOR_AGREGAR}:hover .${CLASE_SEPARADOR_AGREGAR_LINEA},
        .${CLASE_SEPARADOR_AGREGAR}:focus-within .${CLASE_SEPARADOR_AGREGAR_LINEA} { background: #141311; }
        .${CLASE_SEPARADOR_AGREGAR_BOTON} {
          position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
          opacity: 0; transition: opacity 120ms ease;
          display: inline-flex; align-items: center; gap: 4px;
          background: #ffffff; color: #141311; border: 1px solid #ddd9cd; border-radius: 999px;
          padding: 4px 10px 4px 8px;
          font: 600 12px 'Hanken Grotesk', system-ui, sans-serif; cursor: pointer;
          box-shadow: 0 2px 8px rgba(20,19,17,.18);
        }
        .${CLASE_SEPARADOR_AGREGAR}:hover .${CLASE_SEPARADOR_AGREGAR_BOTON},
        .${CLASE_SEPARADOR_AGREGAR}:focus-within .${CLASE_SEPARADOR_AGREGAR_BOTON},
        .${CLASE_SEPARADOR_AGREGAR_BOTON}:focus-visible { opacity: 1; }
      `}</style>
      {campoAbierto && createPortal(
        (() => {
          const ruta = campoAbierto.ruta;
          const multilinea = campoAbierto.multilinea;
          const manejarCambio = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const valor = e.target.value;
            setCampoAbierto((prev) => (prev ? { ...prev, valor } : prev));
            window.parent.postMessage(
              { tipo: TIPO_MENSAJE_CAMPO_CAMBIO, seccion: ruta.seccion, campo: ruta.campo, valor },
              window.location.origin,
            );
          };
          const manejarTecla = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            if (e.key === 'Escape') { e.preventDefault(); cerrarCampo(); return; }
            if (e.key === 'Enter' && !multilinea) { e.preventDefault(); cerrarCampo(); return; }
            if (e.key === 'Tab') cerrarCampo(); // no se previene: el tab-order real sigue su curso
          };
          const comun = {
            autoFocus: true,
            value: campoAbierto.valor,
            // La previsualización de hover (§ arriba) GANA sobre el color real mientras está
            // activa — se aplica DESPUÉS en el spread, nunca se guarda, se apaga sola al salir del
            // swatch (`onMouseLeave`, `BarraEstiloElemento`).
            style: previewColorCss ? { ...campoAbierto.estilo, color: previewColorCss } : campoAbierto.estilo,
            onChange: manejarCambio,
            onKeyDown: manejarTecla,
            // Marcador de DIAGNÓSTICO/arnés —no lo lee ningún código de producto—, pero sin él no
            // hay forma de `querySelector` el overlay desde fuera (un test de ejecución, una
            // herramienta de inspección) sin depender de estilos inline frágiles.
            'data-editor-overlay': ruta.seccion + '.' + ruta.campo,
            // § EDITOR-BARRA-ESTILO-CLIC-1 — el overlay ES chrome propio del editor: el listener de
            // captura lo deja pasar sin interceptar (`esClicEnChromeEditor`, editor-puente.ts), para
            // que mover el caret o seleccionar texto DENTRO del campo abierto no se lea como "clic
            // en otro sitio" y lo cierre. Reemplaza al `overlayNodoRef` (un ref por control) que
            // esta misma excepción usaba antes de generalizarse a un atributo compartido.
            [ATRIBUTO_EDITOR_CHROME]: '',
          };
          // `key` por RUTA: fuerza un nodo NUEVO (con `autoFocus` real) al abrir un campo distinto —
          // sin esto, pasar de un campo de una línea a otro TAMBIÉN de una línea reusaría el MISMO
          // `<input>` (React no remonta por props, sólo por tipo+posición) y el foco no saltaría.
          const campo = multilinea
            ? <textarea key={`${ruta.seccion}.${ruta.campo}`} {...comun} />
            : <input key={`${ruta.seccion}.${ruta.campo}`} {...comun} />;
          if (!avisoSesion) return campo;
          // EL AVISO DE SESIÓN (§ arriba): un chip ANCLADO AL DOCUMENTO justo debajo del campo
          // (§ EDITOR-TIENDA-CAMPO-ANCLADO-1 — `campoAbierto.estilo.top`/`left` ya son coordenadas
          // de DOCUMENTO, no de pantalla, así que este chip tiene que ser `absolute` como el
          // overlay, nunca `fixed`: con `fixed` quedaría mal ubicado en cuanto el documento
          // scrolleara). Mismo `left`/ancho mínimo que el overlay. Color LITERAL, no un token
          // `--duna-*`/`--sf-*` — este documento es el storefront, el chrome es EFÍMERO del editor
          // superpuesto por JS (mismo criterio que `COLOR_RESALTE`, `VistaTiendaIframe.tsx`, fuera
          // de `touches:`). El TEXTO es el que ya resolvió el panel (`MSG_SESION_VENCIDA`, reusado
          // — nunca copiado acá).
          const avisoEstilo: Record<string, string | number> = {
            position: 'absolute',
            top: Number(campoAbierto.estilo.top) + Number(campoAbierto.estilo.height) + 4,
            left: Number(campoAbierto.estilo.left),
            maxWidth: Math.max(240, Number(campoAbierto.estilo.width)),
            zIndex: 2147483647,
            background: '#fff',
            color: '#A0472F',
            border: '1px solid #A0472F',
            fontSize: 12,
            lineHeight: 1.35,
            padding: '4px 8px',
            borderRadius: 6,
            boxShadow: '0 2px 10px rgba(0,0,0,.25)',
            fontFamily: 'system-ui, sans-serif',
          };
          return (
            <>
              {campo}
              {/* § EDITOR-BARRA-ESTILO-CLIC-1 — chrome propio del editor, no se intercepta
                  (`ATRIBUTO_EDITOR_CHROME`, mismo motivo que el overlay de arriba). */}
              <div
                role="alert"
                style={avisoEstilo}
                data-editor-aviso-sesion=""
                {...{ [ATRIBUTO_EDITOR_CHROME]: '' }}
              >
                {avisoSesion}
              </div>
            </>
          );
        })(),
        document.body,
      )}
      {/* LA BARRA FLOTANTE (§ EDITOR-TIENDA-BARRA-FLOTANTE-1) — SÓLO cuando el campo abierto es uno
          de los elementos declarados en `ELEMENTOS_ESTILO` (estilo-elemento.ts, hoy sólo `hero`).
          Portal PROPIO, sibling del de arriba: la barra no es parte del campo, es un control
          aparte que lo acompaña — separarlos deja a cada uno con su propia key/ciclo de vida. */}
      {campoAbierto && metaElementoEstilo(campoAbierto.ruta.seccion, campoAbierto.ruta.campo) && (
        <BarraEstiloElemento
          key={`${campoAbierto.ruta.seccion}.${campoAbierto.ruta.campo}`}
          seccion={campoAbierto.ruta.seccion}
          elemento={campoAbierto.ruta.campo}
          estilo={(hero.estilos as Record<string, EstiloElementoResuelto>)[campoAbierto.ruta.campo] ?? ESTILO_ELEMENTO_VACIO}
          rolesLegibles={rolesLegibles}
          anclaje={{
            top: Number(campoAbierto.estilo.top), left: Number(campoAbierto.estilo.left), height: Number(campoAbierto.estilo.height),
          }}
          onPreviewColor={setPreviewColorCss}
        />
      )}
    </>
  );
}

// § EDITOR-VISUAL-LIENZO-1 — LA ESCALERA DE TAMAÑO como STEPPER −/+ con PALABRA en el medio
// (`.tbsz`/`.tbsz-w` del prototipo), no un `<select>` numérico. El PRIMER paso es "Por defecto"
// (`''`/`null`) — un sexto escalón por debajo de "Pequeño", no uno de los cinco de
// `TAMANOS_ELEMENTO` (`estilo-elemento.ts`, fuera de `touches:`): así "Por defecto" se alcanza
// bajando desde "Pequeño" en vez de ser un caso aparte que el stepper no sabe visitar.
const PASOS_TAMANO: readonly (TamanoElemento | '')[] = ['', ...TAMANOS_ELEMENTO];

function labelPaso(paso: TamanoElemento | ''): string {
  return paso === '' ? 'Por defecto' : LABEL_TAMANO_ELEMENTO[paso];
}

/** Es un hex de 6 dígitos (`#rrggbb`), sin el prefijo `custom:` — lo que el `<input type=color>`
 *  nativo necesita como `value`. `estilo-elemento.ts` (fuera de `touches:`) ya valida la forma
 *  completa (`custom:#rrggbb`) al RESOLVER; acá sólo hay que leerla de vuelta para el picker. */
function hexDeColorPersonalizado(color: EstiloElementoResuelto['color']): string {
  return typeof color === 'string' && color.startsWith('custom:#') ? color.slice('custom:'.length) : '#000000';
}

/**
 * LA BARRA FLOTANTE — letra, tamaño, alineación, color por rol y quitar (§ EDITOR-TIENDA-BARRA-
 * FLOTANTE-1, REDISENO.md § 5; restilizada en § EDITOR-VISUAL-LIENZO-1 sobre el popover del
 * prototipo — `docs/editor-tienda/prototipo/prototipo-editor.html`, `.ftb`/`.tbb`/`.pop`/`.cdef`/
 * `.crole`/`.cadv`/`.ccust`). Anclada al DOCUMENTO (mismo sistema de coordenadas que el campo
 * flotante, § `GeometriaCampo`) — ARRIBA del elemento si hay lugar, ABAJO si no (`anclaje.top` bajo
 * para el campo abierto, p. ej. un titular pegado al borde superior del viewport tras un scroll).
 * Componente de MÓDULO (no anidado dentro de `EditorPuenteVivo`) para que no se redefina en cada
 * render de ese componente — se identifica entre aperturas con `key` (arriba), así que React la
 * remonta limpia al cambiar de campo (lo que también resetea `fontAbierto`/`colorAbierto`/
 * `avanzadoAbierto`, abajo, sin que haga falta un efecto de limpieza propio).
 *
 * REUTILIZA `mensajeEstiloElemento`/`mensajesQuitarEstiloElemento` (editor-puente.ts) — el MISMO
 * tipo de mensaje que cualquier campo de texto, nunca un canal nuevo. Estilo LITERAL, no tokens
 * `--duna-*`/`--sf-*` — mismo criterio que el resto del chrome efímero de este archivo (el aviso de
 * sesión, `ZonaChip` de los 4 heros): este documento es el storefront público, no el panel.
 *
 * DEVIACIÓN MEDIDA — LETRA Y TAMAÑO SIGUEN SIENDO CONTROLES NATIVOS/LINEALES, no los dos popovers
 * anidados del prototipo (`.fo`/`.flist` para letra como lista desplegable; el stepper es NUEVO acá,
 * no un `<select>`). El prototipo abre "Letra" en un popover con una lista `.flist` de muestras —se
 * construyó acá COMO POPOVER (ver `fontAbierto` abajo), pero el stepper de tamaño reemplaza al
 * `<select>` numérico por el `.tbsz` del prototipo (−/palabra/+), que SÍ es fiel. Lo que NO se
 * reconstruyó es el aviso de contraste del prototipo —no existe, y el spec lo pide explícitamente
 * ausente— y el label "Avanzado ›" SÍ se construyó, con el picker de color personalizado
 * (`custom:#rrggbb`, ya soportado por `estilo-elemento.ts` pero sin UI hasta este slice).
 */
function BarraEstiloElemento({
  seccion, elemento, estilo, rolesLegibles, anclaje, onPreviewColor,
}: {
  seccion: string;
  elemento: string;
  estilo: EstiloElementoResuelto;
  rolesLegibles: readonly RolColorElemento[];
  anclaje: { top: number; left: number; height: number };
  onPreviewColor: (cssColor: string | null) => void;
}) {
  const [fontAbierto, setFontAbierto] = useState(false);
  const [colorAbierto, setColorAbierto] = useState(false);
  const [avanzadoAbierto, setAvanzadoAbierto] = useState(false);

  const enviar = (sub: 'fuente' | 'tamano' | 'color' | 'alinear', valor: string) => {
    window.parent.postMessage(mensajeEstiloElemento(seccion, elemento, sub, valor), window.location.origin);
  };
  const quitar = () => postarEscalonado(mensajesQuitarEstiloElemento(seccion, elemento));

  // ARRIBA por default; si no hay suficiente espacio sobre el campo (p. ej. un titular casi pegado
  // al borde superior tras un scroll), ABAJO — mismo criterio de "dónde cabe" que cualquier popover.
  const arriba = anclaje.top > 140;
  const estiloBarra: Record<string, string | number> = {
    position: 'absolute',
    left: anclaje.left,
    ...(arriba ? { top: anclaje.top - 8, transform: 'translateY(-100%)' } : { top: anclaje.top + anclaje.height + 8 }),
    zIndex: 2147483647,
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2,
    background: '#ffffff', color: '#141311', borderRadius: 12,
    padding: 4, boxShadow: '0 12px 34px -8px rgba(20,19,17,.42), 0 0 0 1px rgba(20,19,17,.08)',
    fontFamily: "'Hanken Grotesk', system-ui, sans-serif", fontSize: 12.5, maxWidth: 420,
  };
  const botonBarra = (activo = false): Record<string, string | number> => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    height: 36, padding: '0 10px', border: 'none', borderRadius: 9,
    background: activo ? '#141311' : 'transparent', color: activo ? '#f4f3ef' : '#141311',
    fontFamily: "'Hanken Grotesk', system-ui, sans-serif", fontSize: 12.5, fontWeight: 500,
    cursor: 'pointer', whiteSpace: 'nowrap',
  });
  const botonCuadrado = (activo = false): Record<string, string | number> => ({
    ...botonBarra(activo), width: 34, padding: 0, justifyContent: 'center',
  });
  const separador: Record<string, string | number> = {
    width: 1, height: 22, background: '#e9e6dd', margin: '0 3px', flex: 'none',
  };
  // SIEMPRE hacia ABAJO del trigger (§ `.pop` del prototipo, que SÍ invierte según la posición de
  // `.ftb` en el viewport — `.ftb.at-cap .pop`/etc abren hacia arriba). Acá no se replica esa
  // inversión: decidirla bien exige la altura del VIEWPORT, que `anclaje` no trae (sólo coordenadas
  // de DOCUMENTO, § `GeometriaCampo`) — abrir siempre abajo es la opción segura en los dos casos de
  // `arriba` (el trigger nunca está pegado al borde inferior real de la ventana, sólo bajo o sobre
  // el campo), así que simplificar acá evita una inversión construida sin el dato que la decidiría.
  const estiloPopover = (ancho: number): Record<string, string | number> => ({
    position: 'absolute', left: 0, top: 'calc(100% + 10px)',
    width: ancho, background: '#fff', color: '#141311', borderRadius: 14,
    boxShadow: '0 22px 56px -12px rgba(20,19,17,.45), 0 0 0 1px rgba(20,19,17,.08)',
    padding: 8, zIndex: 5, fontFamily: "'Hanken Grotesk', system-ui, sans-serif", fontSize: 13,
  });

  const fuenteActual = estilo.fuente === 'otra-del-par'
    ? 'La otra del par'
    : estilo.fuente
      ? PARES_FUENTES.find((p) => p.clave === estilo.fuente)?.label ?? 'Por defecto'
      : 'Por defecto';
  const pasoActual = PASOS_TAMANO.indexOf(estilo.tamano ?? '');
  const colorActualHex = hexDeColorPersonalizado(estilo.color);
  const esColorPersonalizado = typeof estilo.color === 'string' && estilo.color.startsWith('custom:#');
  const rolActual = esColorPersonalizado ? null : (estilo.color as RolColorElemento | null);
  const colorActualLabel = esColorPersonalizado
    ? 'Personalizado'
    : rolActual
      ? ROLES_COLOR_ELEMENTO.find((r) => r.clave === rolActual)?.label ?? 'Por defecto'
      : 'Por defecto';
  const colorActualSwatch = esColorPersonalizado
    ? colorActualHex
    : rolActual
      ? `var(${ROLES_COLOR_ELEMENTO.find((r) => r.clave === rolActual)?.variable})`
      : 'transparent';

  return createPortal(
    // § EDITOR-BARRA-ESTILO-CLIC-1 — `ATRIBUTO_EDITOR_CHROME` es lo que hace que el listener de
    // captura de `EditorPuenteVivo` deje pasar sin interceptar TODO clic dentro de esta barra —
    // antes de este atributo, cada clic en un botón/select de acá se leía como "clic afuera" y
    // cerraba el campo sin aplicar nada (el defecto que este slice arregla).
    <div
      style={estiloBarra}
      data-editor-barra-estilo={`${seccion}.${elemento}`}
      {...{ [ATRIBUTO_EDITOR_CHROME]: '' }}
    >
      {/* LETRA — trigger "Aa + nombre" que abre un popover con la lista curada (§ `.fo`/`.flist`
          del prototipo). «Por defecto» y «La otra del par» primero, después la colección. */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => { setFontAbierto((v) => !v); setColorAbierto(false); }}
          style={botonBarra(fontAbierto)}
        >
          <span style={{ width: 20, textAlign: 'center', fontSize: 15 }}>Aa</span>
          <span style={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis' }}>{fuenteActual}</span>
          <ChevronDown size={13} aria-hidden="true" />
        </button>
        {fontAbierto && (
          <div style={estiloPopover(260)}>
            <FilaFuente seleccionado={estilo.fuente === null} onClick={() => { enviar('fuente', ''); setFontAbierto(false); }}>
              Por defecto
            </FilaFuente>
            <FilaFuente seleccionado={estilo.fuente === 'otra-del-par'} onClick={() => { enviar('fuente', 'otra-del-par'); setFontAbierto(false); }}>
              La otra del par
            </FilaFuente>
            {PARES_FUENTES.map((p) => (
              <FilaFuente
                key={p.clave}
                familia={p.titulo}
                hint={p.descripcion}
                seleccionado={estilo.fuente === p.clave}
                onClick={() => { enviar('fuente', p.clave); setFontAbierto(false); }}
              >
                {p.label}
              </FilaFuente>
            ))}
          </div>
        )}
      </div>
      <div style={separador} />

      {/* TAMAÑO — stepper −/palabra/+ (§ `.tbsz` del prototipo), no un `<select>` numérico. */}
      <button
        type="button"
        aria-label="Más pequeño"
        onClick={() => enviar('tamano', PASOS_TAMANO[Math.max(0, pasoActual - 1)])}
        style={botonCuadrado()}
      >
        <Minus size={13} aria-hidden="true" />
      </button>
      <span style={{ minWidth: 86, textAlign: 'center', fontWeight: 600, padding: '0 4px', whiteSpace: 'nowrap' }}>
        {labelPaso(PASOS_TAMANO[pasoActual])}
      </span>
      <button
        type="button"
        aria-label="Más grande"
        onClick={() => enviar('tamano', PASOS_TAMANO[Math.min(PASOS_TAMANO.length - 1, pasoActual + 1)])}
        style={botonCuadrado()}
      >
        <Plus size={13} aria-hidden="true" />
      </button>
      <div style={separador} />

      {/* ALINEACIÓN — tres íconos cuadrados, mismo trío de siempre, chrome ink/blanco. */}
      <div role="group" aria-label="Alineación" style={{ display: 'flex', gap: 2 }}>
        {(
          [
            { v: 'izquierda' as AlineacionElemento, Icon: AlignLeft, label: 'Izquierda' },
            { v: 'centro' as AlineacionElemento, Icon: AlignCenter, label: 'Centro' },
            { v: 'derecha' as AlineacionElemento, Icon: AlignRight, label: 'Derecha' },
          ] as const
        ).map(({ v, Icon, label }) => (
          <button key={v} type="button" aria-label={label} onClick={() => enviar('alinear', v)} style={botonCuadrado(estilo.alinear === v)}>
            <Icon size={13} aria-hidden="true" />
          </button>
        ))}
      </div>
      <div style={separador} />

      {/* COLOR — trigger con la muestra + nombre, abre «Por defecto» primero, los roles en chips
          con su muestra (§ `.crole`), y «Avanzado ›» para el hex personalizado. SIN aviso de
          contraste (§ el pedido del spec, REDISENO.md § 5 — no se agrega uno). */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => { setColorAbierto((v) => !v); setFontAbierto(false); }}
          style={botonBarra(colorAbierto)}
        >
          <span style={{
            width: 18, height: 18, borderRadius: '50%', boxShadow: 'inset 0 0 0 1px rgba(20,19,17,.2)',
            background: colorActualSwatch,
          }}
          />
          <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>{colorActualLabel}</span>
          <ChevronDown size={13} aria-hidden="true" />
        </button>
        {colorAbierto && (
          <div style={estiloPopover(290)}>
            <button
              type="button"
              onClick={() => { enviar('color', ''); setColorAbierto(false); setAvanzadoAbierto(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: 8,
                borderRadius: 11, border: `1px solid ${estilo.color === null ? '#141311' : '#e9e6dd'}`,
                background: '#fbfaf7', cursor: 'pointer', marginBottom: 10, textAlign: 'left',
              }}
            >
              <span style={{ width: 30, height: 30, borderRadius: 9, boxShadow: 'inset 0 0 0 1px rgba(20,19,17,.15)', background: '#fff', flex: 'none' }} />
              <span>
                <b style={{ display: 'block', fontWeight: 600, fontSize: 12.5 }}>Por defecto</b>
                <small style={{ display: 'block', color: '#746f64', fontSize: 11.5 }}>Lo que pide esta zona</small>
              </span>
            </button>
            <p style={{ font: "500 10px/1 'Spline Sans Mono', monospace", letterSpacing: '.08em', textTransform: 'uppercase', color: '#746f64', margin: '0 0 7px 4px' }}>
              De tu paleta
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 4 }} onMouseLeave={() => onPreviewColor(null)}>
              {ROLES_COLOR_ELEMENTO.filter((r) => rolesLegibles.includes(r.clave)).map((r) => (
                <button
                  key={r.clave}
                  type="button"
                  onClick={() => { enviar('color', r.clave); setColorAbierto(false); }}
                  onMouseEnter={() => onPreviewColor(`var(${r.variable})`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9, padding: '7px 8px', borderRadius: 10,
                    border: `1px solid ${rolActual === r.clave ? '#141311' : 'transparent'}`,
                    background: 'transparent', cursor: 'pointer', textAlign: 'left', width: '100%',
                  }}
                >
                  <span style={{ width: 24, height: 24, borderRadius: '50%', boxShadow: 'inset 0 0 0 1px rgba(20,19,17,.14)', background: `var(${r.variable})`, flex: 'none' }} />
                  <span>
                    <b style={{ display: 'block', fontWeight: 500, fontSize: 12.5 }}>{r.label}</b>
                    <small style={{ display: 'block', color: '#746f64', fontSize: 11 }}>{r.descripcion}</small>
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setAvanzadoAbierto((v) => !v)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                marginTop: 8, padding: '9px 8px', border: 'none', borderTop: '1px solid #e9e6dd',
                background: 'transparent', color: '#3d3a34', fontWeight: 500,
                fontSize: 12.5, cursor: 'pointer',
              }}
            >
              <span>Avanzado</span>
              <ChevronDown size={13} aria-hidden="true" style={{ transform: avanzadoAbierto ? 'rotate(180deg)' : undefined }} />
            </button>
            {avanzadoAbierto && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px 6px' }}>
                <span style={{ flex: 1, fontWeight: 500, fontSize: 12.5 }}>Personalizado</span>
                <label style={{ position: 'relative', width: 30, height: 30, borderRadius: 9, overflow: 'hidden', boxShadow: 'inset 0 0 0 1px rgba(20,19,17,.15)', cursor: 'pointer', flex: 'none' }}>
                  <input
                    type="color"
                    value={colorActualHex}
                    onChange={(e) => enviar('color', `custom:${e.target.value}`)}
                    style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', border: 0, padding: 0 }}
                    aria-label="Elegir un color personalizado"
                  />
                  <span style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: colorActualHex }} />
                </label>
                <span style={{ fontFamily: "'Spline Sans Mono', monospace", fontSize: 11.5, color: '#746f64' }}>{colorActualHex}</span>
              </div>
            )}
          </div>
        )}
      </div>
      <div style={separador} />

      <button type="button" onClick={quitar} aria-label="Quitar estilo" title="Quitar estilo" style={botonCuadrado()}>
        <Trash2 size={13} aria-hidden="true" />
      </button>
    </div>,
    document.body,
  );
}

/** Una fila del popover de LETRA — "Aa" en la familia real + nombre + hint, con el check a la
 *  derecha cuando está seleccionada (§ `.fo` del prototipo). `familia`/`hint` ausentes para "Por
 *  defecto"/"La otra del par" (no tienen una tipografía propia que mostrar en miniatura). */
function FilaFuente({
  familia, hint, seleccionado, onClick, children,
}: { familia?: string; hint?: string; seleccionado: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '7px 9px',
        borderRadius: 9, border: 'none', background: seleccionado ? '#f4f3ef' : 'transparent',
        cursor: 'pointer', textAlign: 'left',
      }}
    >
      <span style={{ fontSize: 19, width: 30, textAlign: 'center', lineHeight: 1, flex: 'none', fontFamily: familia }}>Aa</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <b style={{ display: 'block', fontWeight: 500, fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{children}</b>
        {hint && <small style={{ display: 'block', color: '#746f64', fontSize: 11.5 }}>{hint}</small>}
      </span>
      {seleccionado && <Check size={14} aria-hidden="true" style={{ flex: 'none' }} />}
    </button>
  );
}
