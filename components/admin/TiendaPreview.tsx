'use client';

import { useCallback, useRef, useState } from 'react';
import TiendaHeroSeccion from '@/components/admin/TiendaHeroSeccion';

// Ancho del viewport DESKTOP que el iframe renderiza. 1280 está por encima de `lg`, así que
// la tienda sale en su layout de escritorio; el `transform: scale` lo reduce al ancho real
// del pane (§ negocio≠tienda / vista previa). El home se ve chico pero fiel.
const DESKTOP = 1280;

export default function TiendaPreview() {
  // Ancho REAL del pane, medido con ResizeObserver (mismo patrón que PagosCurva): un callback
  // ref que engancha/desengancha con cada nodo y IGNORA el aviso de ancho 0 (nodo saliendo).
  // Así el factor de escala se RECALCULA al colapsar el rail o redimensionar la ventana, no
  // una sola vez al montar.
  const observador = useRef<ResizeObserver | null>(null);
  const scroller   = useRef<HTMLDivElement | null>(null); // el pane que SCROLLEA
  const iframeRef  = useRef<HTMLIFrameElement | null>(null);
  const [paneW, setPaneW] = useState(0);
  const [homeH, setHomeH] = useState(2400); // alto del home en coords desktop; se mide al cargar

  const paneRef = useCallback((nodo: HTMLDivElement | null) => {
    observador.current?.disconnect();
    observador.current = null;
    scroller.current = nodo;
    if (!nodo) return;
    const ro = new ResizeObserver(entradas => {
      for (const e of entradas) {
        const w = Math.round(e.contentRect.width);
        if (w > 0) setPaneW(w);
      }
    });
    ro.observe(nodo);
    observador.current = ro;
  }, []);

  const scale = paneW > 0 ? paneW / DESKTOP : 0;

  // Al cargar el iframe (mismo origen) se mide el alto real del home para dimensionar el
  // spacer que le da al pane su altura de scroll. Si el contenido cambia (un guardado), se
  // vuelve a medir.
  const medir = () => {
    try {
      const h = iframeRef.current?.contentWindow?.document?.documentElement?.scrollHeight;
      if (h && h > 0) setHomeH(h);
    } catch { /* mismo origen: no debería lanzar; si lo hace, se queda el alto previo */ }
  };

  // Reload al guardar: preserva el scrollTop del PANE, CLAMPeado al alto NUEVO. El contenido
  // puede ACORTARSE entre recargas (p. ej. borrar un párrafo de la historia); sin el clamp, el
  // scrollTop viejo caería fuera de rango y el pane saltaría al fondo o quedaría en blanco.
  const recargar = () => {
    const pane = scroller.current;
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    const prev = pane?.scrollTop ?? 0;
    // El listener va en el ELEMENTO iframe, no en `contentWindow`: tras `reload()` el window
    // puede ser otro objeto, y un listener sobre el viejo no se enteraría del nuevo `load`.
    const alCargar = () => {
      iframe.removeEventListener('load', alCargar);
      medir();
      // Tras re-medir, el spacer cambia de alto en el siguiente frame; ahí se clampea.
      requestAnimationFrame(() => {
        if (!pane) return;
        const max = Math.max(0, pane.scrollHeight - pane.clientHeight);
        pane.scrollTop = Math.min(prev, max);
      });
    };
    iframe.addEventListener('load', alCargar);
    iframe.contentWindow.location.reload();
  };

  return (
    <div className="tienda-split">
      {/* Vista previa (izq) — desktop escalado. Se OCULTA bajo el breakpoint (§ duna.css):
          debajo el split no cabe y el editor toma el ancho completo. */}
      <div ref={paneRef} className="tienda-preview-pane">
        {scale > 0 && (
          // El SPACER lleva el alto ESCALADO (transform no cambia el layout), así el pane
          // scrollea la altura correcta; el iframe va escalado dentro.
          <div style={{ height: homeH * scale, width: DESKTOP * scale }}>
            <iframe
              ref={iframeRef}
              src="/?preview=1"
              title="Vista previa de la tienda"
              onLoad={medir}
              style={{
                width: DESKTOP,
                height: homeH,
                border: 0,
                display: 'block',
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }}
            />
          </div>
        )}
      </div>

      {/* Editor (der) — el Hero (única sección de v1). El split le pasa el reload. */}
      <div className="tienda-editor-col">
        <TiendaHeroSeccion onGuardado={recargar} />
      </div>
    </div>
  );
}
