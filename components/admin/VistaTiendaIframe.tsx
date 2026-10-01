'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';
import type { PaginaKey, SeccionVista } from '@/components/admin/tienda-secciones';
import { urlDePagina, selectorDeSeccion, scrollSeguro } from '@/lib/admin/editor-iframe';

// LA PÁGINA REAL de la tienda, completa, dentro del panel (§ EDITOR-TIENDA-IFRAME-VISTA-1).
// Reemplaza las vistas previas sueltas por sección (`VistaTiendaEnVivo`) que montaba cada
// `TiendaSeccionEditor`: en vez de reconstruir cada banda con una segunda implementación del
// cálculo de colores/tipografía/forma, el iframe navega a la RUTA REAL del storefront en modo
// borrador (§ EDITOR-TIENDA-IFRAME-GATE-1) — mismo origen, sin `postMessage` todavía (ésa es
// `EDITOR-TIENDA-POSTMESSAGE-1`, slice 3 del plan): cada guardado asentado, publicar o descartar
// recargan el documento, conservando el scroll.
//
// "Ir a la sección" y el resalte se resuelven por MANIPULACIÓN DIRECTA del DOM del iframe —mismo
// origen, así que `contentDocument`/`contentWindow` son accesibles sin restricción— en vez de con
// una clase CSS que el storefront tendría que declarar: el storefront no necesita saber que un
// resalte existe, y el estilo nunca puede quedar "pegado" en una recarga.
export interface VistaTiendaIframeHandle {
  /** Desplaza el iframe hasta la sección y la resalta brevemente. No hace nada si el documento
   *  todavía no cargó, o si esta sección no tiene marcador resoluble (§ `selectorDeSeccion`, el
   *  caso de Suscripciones). */
  irASeccion: (seccion: SeccionVista) => void;
  /** Recarga la página real preservando el scroll — se llama tras cada guardado asentado,
   *  publicar o descartar (§ `TiendaSeccionEditor`, `onCambioPublicado`). */
  recargar: () => void;
}

// El color del resalte es un LITERAL, no una custom property: el documento del iframe es el
// STOREFRONT (tokens `--sf-*`), no el panel (`--duna-*`) — las dos paletas no se pueden leer entre
// documentos sin plomería extra, y esto es chrome EFÍMERO del editor superpuesto por JS, no una
// decisión de estilo del storefront. Es el valor de `--duna-sol` (ámbar = atención).
const COLOR_RESALTE = '#f59e0b';
const DURACION_RESALTE_MS = 1500;

const VistaTiendaIframe = forwardRef<VistaTiendaIframeHandle, { pagina: PaginaKey }>(
  function VistaTiendaIframe({ pagina }, ref) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const scrollPendiente = useRef<number | null>(null);
    // EL resalte ACTIVO (nodo + su timer de limpieza), no sólo el timer: con sólo el timer, resaltar
    // una SEGUNDA sección mientras la primera seguía iluminada cancelaría el timer de la primera sin
    // limpiar su outline (queda pegado para siempre), y resaltar la MISMA sección dos veces seguidas
    // haría que el segundo timeout "restaurara" el outline AMBAR que el primero dejó puesto como si
    // fuera el valor original. Guardar el nodo deja limpiar la mitad VIEJA explícitamente antes de
    // pintar la nueva, en vez de fiarse de un valor "previo" capturado a mitad de una animación.
    const resaltadoRef = useRef<{ nodo: HTMLElement; timeout: number } | null>(null);
    const [cargando, setCargando] = useState(true);

    const url = urlDePagina(pagina);

    const limpiarResalte = () => {
      const activo = resaltadoRef.current;
      if (!activo) return;
      window.clearTimeout(activo.timeout);
      activo.nodo.style.outline = '';
      activo.nodo.style.outlineOffset = '';
      resaltadoRef.current = null;
    };

    const irASeccion = useCallback((seccion: SeccionVista) => {
      const doc = iframeRef.current?.contentDocument;
      const nodo = doc?.querySelector<HTMLElement>(selectorDeSeccion(seccion));
      if (!nodo) return;
      limpiarResalte();
      const reduce = iframeRef.current?.contentWindow?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      nodo.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      nodo.style.outline = `2px solid ${COLOR_RESALTE}`;
      nodo.style.outlineOffset = '-2px';
      const timeout = window.setTimeout(() => {
        nodo.style.outline = '';
        nodo.style.outlineOffset = '';
        resaltadoRef.current = null;
      }, DURACION_RESALTE_MS);
      resaltadoRef.current = { nodo, timeout };
    }, []);

    const recargar = useCallback(() => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      limpiarResalte();
      scrollPendiente.current = scrollSeguro(win.scrollY);
      setCargando(true);
      win.location.reload();
    }, []);

    useImperativeHandle(ref, () => ({ irASeccion, recargar }), [irASeccion, recargar]);

    // Cambiar de pestaña de página es una NAVEGACIÓN real (otra URL) — el `key={pagina}` del
    // iframe ya fuerza el remonte; este efecto sólo repone el estado "cargando" para esa carga.
    useEffect(() => { setCargando(true); }, [pagina]);

    const onLoad = useCallback(() => {
      setCargando(false);
      const win = iframeRef.current?.contentWindow;
      if (win && scrollPendiente.current != null) {
        win.scrollTo(0, scrollPendiente.current);
        scrollPendiente.current = null;
      }
    }, []);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: 'var(--duna-space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button type="button" onClick={recargar} className="duna-btn duna-btn--ghost duna-btn--sm" title="Volver a cargar la vista con los últimos cambios">
            <RotateCw /> Actualizar
          </button>
        </div>
        <div
          style={{
            position: 'relative',
            flex: '1 1 auto',
            minHeight: 0,
            border: '1px solid var(--duna-border)',
            borderRadius: 'var(--duna-r-l)',
            overflow: 'hidden',
            background: 'var(--duna-bg)',
          }}
        >
          <iframe
            ref={iframeRef}
            key={pagina}
            src={url}
            title="Vista previa de la tienda"
            onLoad={onLoad}
            style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
          />
          {cargando && (
            <div className="duna-skel" aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 0 }} />
          )}
        </div>
      </div>
    );
  },
);

export default VistaTiendaIframe;
