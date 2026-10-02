'use client';

import { useEffect, useRef } from 'react';
import { useSiteContentActualizador } from '@/components/storefront/SiteContentProvider';
import {
  esMensajeContenidoSeccion, esSeccionDelRegistro, fusionarContenidoSeccion,
  esMensajeModoNavegar, TIPO_MENSAJE_SECCION_CLICK,
} from '@/lib/storefront/editor-puente';
// `ATRIBUTO_EDITOR_SECCION` es admin-level por historia (nació junto a `proxy.ts`/
// `modo-editor-gate.ts`, § su docstring), pero es un literal PURO —sin `next/headers` ni Prisma—,
// así que importarlo acá no arrastra nada pesado: una sola definición del nombre del atributo, no
// dos que puedan divergir entre quien lo lee (acá) y quien lo escribe (`app/(storefront)/page.tsx`,
// `nosotros/page.tsx`, `suscripciones/Contenido.tsx`).
import { ATRIBUTO_EDITOR_SECCION } from '@/lib/admin/editor-iframe';

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
const CLASE_SELECCION_ACTIVA = 'duna-editor-seleccion';

export default function EditorPuenteVivo({ activo }: { activo: boolean }) {
  const actualizar = useSiteContentActualizador();
  const schemaRef = useRef<typeof import('@/lib/config/site-content-schema') | null>(null);
  const navegarRef = useRef(false);

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

      if (!esMensajeContenidoSeccion(e.data)) return;
      const { seccion, datos } = e.data;
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
  useEffect(() => {
    if (!activo) return;
    const onClick = (e: MouseEvent) => {
      if (navegarRef.current) return; // modo Navegar: comportamiento normal, no se intercepta nada
      e.preventDefault();
      e.stopPropagation();
      const nodo = (e.target as HTMLElement | null)?.closest<HTMLElement>(`[${ATRIBUTO_EDITOR_SECCION}]`);
      const seccion = nodo?.getAttribute(ATRIBUTO_EDITOR_SECCION);
      if (!seccion) return; // clic fuera de cualquier sección marcada (nav/pie/chrome): sólo se frena
      window.parent.postMessage({ tipo: TIPO_MENSAJE_SECCION_CLICK, seccion }, window.location.origin);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [activo]);

  if (!activo) return null;
  return (
    <style>{`
      .${CLASE_SELECCION_ACTIVA} [${ATRIBUTO_EDITOR_SECCION}] { cursor: pointer; }
      .${CLASE_SELECCION_ACTIVA} [${ATRIBUTO_EDITOR_SECCION}]:hover { outline: 2px dashed #f59e0b; outline-offset: -2px; }
    `}</style>
  );
}
