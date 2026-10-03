'use client';

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useSiteContentActualizador } from '@/components/storefront/SiteContentProvider';
import {
  esMensajeContenidoSeccion, esSeccionDelRegistro, fusionarContenidoSeccion,
  esMensajeModoNavegar, TIPO_MENSAJE_SECCION_CLICK, TIPO_MENSAJE_CAMPO_CAMBIO,
  TIPO_MENSAJE_CAMPO_IMAGEN_CLICK, esMensajeSesionVencida, datosDeOrden, datosDeTema,
} from '@/lib/storefront/editor-puente';
// `resolverOrden` (§ EDITOR-TIENDA-ORDEN-1): YA viaja en el bundle público por `editor-puente.ts`
// (que importa el módulo completo para `REGISTRY`/`DEFAULTS`/`resolverSiteContent`), así que
// importarla acá directo no agrega peso nuevo — ninguna razón para pasarla por un re-export.
import { resolverOrden } from '@/lib/config/site-content-defaults';
// `ATRIBUTO_EDITOR_SECCION`/`ATRIBUTO_EDITOR_CAMPO`/`ATRIBUTO_EDITOR_LINEA` son admin-level por
// historia (nacieron junto a `proxy.ts`/`modo-editor-gate.ts`, § su docstring), pero son literales
// PUROS —sin `next/headers` ni Prisma—, así que importarlos acá no arrastra nada pesado: una sola
// definición de cada nombre, no dos que puedan divergir entre quien los lee (acá) y quien los
// escribe (`app/(storefront)/page.tsx`, `nosotros/page.tsx`, `suscripciones/Contenido.tsx`,
// `CampoEditable.tsx`).
import { ATRIBUTO_EDITOR_SECCION, ATRIBUTO_EDITOR_CAMPO, ATRIBUTO_EDITOR_LINEA } from '@/lib/admin/editor-iframe';
import {
  parsearRutaCampo, estiloCampoFlotante, ATRIBUTO_EDITOR_CAMPO_IMAGEN, type RutaCampo,
} from '@/lib/storefront/campo-editable';

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
// EL CLIC DENTRO DEL OVERLAY NO SE INTERCEPTA (`overlayNodoRef`): el listener de arriba corre sobre
// TODO `document`, incluido el `<input>`/`<textarea>` portaleado a `document.body` — sin esa guarda,
// cada clic para mover el caret o seleccionar texto DENTRO del campo abierto se leería como "clic en
// otro sitio" y cerraría/reabriría el mismo campo sin sentido.
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
const CLASE_SELECCION_ACTIVA = 'duna-editor-seleccion';

/** El estado del ÚNICO campo flotante que puede estar abierto a la vez. `ruta` ya viene PARSEADA
 *  (`parsearRutaCampo`) — sección + campo relativo — para no volver a parsear el atributo en cada
 *  tecla. `estilo` se calcula UNA vez, al abrir (geometría/tipografía del instante del clic; no se
 *  re-mide mientras se tipea — un recálculo por tecla sería trabajo de layout que el texto tecleado
 *  no necesita, dado que ni la posición ni la fuente del nodo cambian mientras el overlay lo tapa). */
interface EstadoCampoAbierto {
  nodo: HTMLElement;
  ruta: RutaCampo;
  multilinea: boolean;
  valor: string;
  estilo: Record<string, string | number>;
}

/** Lo que el overlay necesita COPIAR del nodo real para verse "visualmente indistinguible" (§ el
 *  diseño) — impuro (DOM), separado de `estiloCampoFlotante` (puro) para que la FORMA del `style`
 *  resultante se pueda testear sin montar nada en un navegador. */
function leerTipografia(nodo: HTMLElement) {
  const cs = window.getComputedStyle(nodo);
  return {
    fontFamily: cs.fontFamily,
    fontSize: cs.fontSize,
    fontWeight: cs.fontWeight,
    fontStyle: cs.fontStyle,
    lineHeight: cs.lineHeight,
    letterSpacing: cs.letterSpacing,
    textAlign: cs.textAlign,
    textTransform: cs.textTransform,
    color: cs.color,
    padding: cs.padding,
  };
}

export default function EditorPuenteVivo({ activo }: { activo: boolean }) {
  const actualizar = useSiteContentActualizador();
  const schemaRef = useRef<typeof import('@/lib/config/site-content-schema') | null>(null);
  const navegarRef = useRef(false);

  // ── EL CAMPO FLOTANTE (§ arriba) ───────────────────────────────────────────────────────────────
  const [campoAbierto, setCampoAbierto] = useState<EstadoCampoAbierto | null>(null);
  const campoAbiertoRef = useRef<EstadoCampoAbierto | null>(null);
  campoAbiertoRef.current = campoAbierto;
  // El nodo DOM del overlay EN VUELO (el `<input>`/`<textarea>` portaleado) — lo pone el `ref`
  // callback del elemento renderizado abajo; lo lee el listener de clic para no interceptarse a sí
  // mismo (§ el comentario grande, "EL CLIC DENTRO DEL OVERLAY").
  const overlayNodoRef = useRef<HTMLElement | null>(null);

  // EL AVISO DE SESIÓN VENCIDA (§ EDITOR-TIENDA-CAMPO-EDITABLE-SESION-1, EDICION-INLINE.md § 3): el
  // texto ya resuelto que llega por `TIPO_MENSAJE_SESION_VENCIDA` cuando el autoguardado del CAMPO
  // ABIERTO falla con 401 — `null` = nada que mostrar. Vive SIEMPRE atado al campo abierto (se limpia
  // al cerrar/abrir OTRO), nunca sobrevive a un cierre: no hay nada que "descartar" acá, el panel
  // sigue siendo la fuente de verdad del estado real.
  const [avisoSesion, setAvisoSesion] = useState<string | null>(null);

  const cerrarCampo = () => {
    const abierto = campoAbiertoRef.current;
    if (abierto) abierto.nodo.style.visibility = '';
    setCampoAbierto(null);
    setAvisoSesion(null);
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
    }

    const multilinea = nodo.getAttribute(ATRIBUTO_EDITOR_LINEA) === 'multiple';
    const rect = nodo.getBoundingClientRect();
    const estilo = estiloCampoFlotante(
      { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      leerTipografia(nodo),
    );
    nodo.style.visibility = 'hidden';
    setAvisoSesion(null); // un campo nuevo nace sin el aviso del campo anterior
    setCampoAbierto({ nodo, ruta, multilinea, valor: nodo.textContent ?? '', estilo });
  };

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

    const onMessage = (e: MessageEvent) => {
      // Mismo origen SIEMPRE — el panel y la tienda son el MISMO despliegue (§ MODO-EDITOR-SOLO-EN-
      // EL-IFRAME-1); un mensaje de otro origen no puede venir del panel que lo embebe.
      if (e.origin !== window.location.origin) return;

      if (esMensajeModoNavegar(e.data)) {
        navegarRef.current = e.data.navegar;
        document.documentElement.classList.toggle(CLASE_SELECCION_ACTIVA, !e.data.navegar);
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
        const nuevoOrden = resolverOrden(crudo);
        const primerNodo = document.querySelector<HTMLElement>(`[data-editor-seccion="${nuevoOrden[0]}"]`);
        const contenedor = primerNodo?.parentElement;
        if (!contenedor) return; // otra página (ningún marcador coincide) — no-op, nunca un error
        for (const id of nuevoOrden) {
          const nodo = document.querySelector<HTMLElement>(`[data-editor-seccion="${id}"]`);
          if (nodo) contenedor.appendChild(nodo);
        }
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

      if (!esSeccionDelRegistro(seccion)) return;

      const aplicar = (schema: typeof import('@/lib/config/site-content-schema')) => {
        const subSchema = (schema.siteContentEditableSchema.shape as Record<
          string,
          { safeParse: (v: unknown) => { success: boolean; data?: unknown } }
        >)[seccion];
        const parsed = subSchema?.safeParse(datos);
        // Un mensaje que no valida (un shape a medio teclear que el schema rechaza, una sección sin
        // sub-schema) se IGNORA — preferir callar a aplicar un borrador a medias que el schema de
        // guardado tampoco aceptaría. El próximo mensaje (la próxima tecla) lo intenta de nuevo.
        if (!parsed || !parsed.success) return;
        actualizar((prev) => fusionarContenidoSeccion(prev, seccion, parsed.data as Record<string, unknown>));
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
    };
  }, [activo, actualizar]);

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
      // Un clic DENTRO del overlay ya abierto no se intercepta (§ el comentario grande).
      if (overlayNodoRef.current && destino && overlayNodoRef.current.contains(destino)) return;

      e.preventDefault();
      e.stopPropagation();

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
      <style>{`
        .${CLASE_SELECCION_ACTIVA} [${ATRIBUTO_EDITOR_SECCION}] { cursor: pointer; }
        .${CLASE_SELECCION_ACTIVA} [${ATRIBUTO_EDITOR_SECCION}]:hover { outline: 2px dashed #f59e0b; outline-offset: -2px; }
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
            ref: (n: HTMLInputElement | HTMLTextAreaElement | null) => { overlayNodoRef.current = n; },
            autoFocus: true,
            value: campoAbierto.valor,
            style: campoAbierto.estilo,
            onChange: manejarCambio,
            onKeyDown: manejarTecla,
            // Marcador de DIAGNÓSTICO/arnés —no lo lee ningún otro código de producto (el gate de
            // "clic dentro del overlay" ya usa `overlayNodoRef.contains()`, no este atributo)—, pero
            // sin él no hay forma de `querySelector` el overlay desde fuera (un test de ejecución,
            // una herramienta de inspección) sin depender de estilos inline frágiles.
            'data-editor-overlay': ruta.seccion + '.' + ruta.campo,
          };
          // `key` por RUTA: fuerza un nodo NUEVO (con `autoFocus` real) al abrir un campo distinto —
          // sin esto, pasar de un campo de una línea a otro TAMBIÉN de una línea reusaría el MISMO
          // `<input>` (React no remonta por props, sólo por tipo+posición) y el foco no saltaría.
          const campo = multilinea
            ? <textarea key={`${ruta.seccion}.${ruta.campo}`} {...comun} />
            : <input key={`${ruta.seccion}.${ruta.campo}`} {...comun} />;
          if (!avisoSesion) return campo;
          // EL AVISO DE SESIÓN (§ arriba): un chip FIJO justo debajo del campo, mismo `left`/ancho
          // mínimo que el overlay. Color LITERAL, no un token `--duna-*`/`--sf-*` — este documento es
          // el storefront, el chrome es EFÍMERO del editor superpuesto por JS (mismo criterio que
          // `COLOR_RESALTE`, `VistaTiendaIframe.tsx`, fuera de `touches:`). El TEXTO es el que ya
          // resolvió el panel (`MSG_SESION_VENCIDA`, reusado — nunca copiado acá).
          const avisoEstilo: Record<string, string | number> = {
            position: 'fixed',
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
              <div role="alert" style={avisoEstilo} data-editor-aviso-sesion="">{avisoSesion}</div>
            </>
          );
        })(),
        document.body,
      )}
    </>
  );
}
