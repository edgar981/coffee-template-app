'use client';

import { useCallback, useRef, useState } from 'react';
import TiendaHeroSeccion from '@/components/admin/TiendaHeroSeccion';

// Ancho del viewport DESKTOP que el iframe renderiza. 1280 está por encima de `lg`, así que
// la tienda sale en su layout de escritorio; el `transform: scale` lo reduce al ancho real
// del pane. El home se ve chico pero fiel.
const DESKTOP = 1280;

export default function TiendaPreview() {
  // Ancho REAL del pane, con ResizeObserver (patrón de PagosCurva): callback ref que
  // engancha/desengancha con cada nodo e IGNORA el aviso de ancho 0 (nodo saliendo). El RO
  // observa el PANE, que es ESTABLE —no se remonta al intercambiar iframes—, así que no hay
  // que re-engancharlo por buffer; y si el pane se remontara, el callback ref lo cubre (es el
  // caso que rompió el hover de PagosCurva por observar un nodo que ya no estaba). El factor
  // `paneW/1280` se recalcula al colapsar el rail o redimensionar.
  const observador = useRef<ResizeObserver | null>(null);
  const scroller   = useRef<HTMLDivElement | null>(null);
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

  // DOBLE-BUFFER: normalmente UN iframe. Al guardar se agrega un SEGUNDO (oculto, cargando);
  // cuando termina, se vuelve el activo y el viejo se DESTRUYE —dos renders de la home vivos a
  // la vez es el doble del peso, así que el segundo existe SÓLO durante el intercambio—. El
  // viejo se ve hasta que el nuevo está listo → cero parpadeo.
  const [frames, setFrames]     = useState<number[]>([0]); // ids; el ÚLTIMO es el objetivo
  const [activoId, setActivoId] = useState(0);             // el que se muestra
  const nextId    = useRef(1);
  const pendiente = useRef<{ id: number; scroll: number } | null>(null);
  const iframes   = useRef<Map<number, HTMLIFrameElement>>(new Map());

  const alturaDe = (el: HTMLIFrameElement | undefined): number => {
    try {
      const h = el?.contentWindow?.document?.documentElement?.scrollHeight;
      if (h && h > 0) return h;
    } catch { /* mismo origen: no debería lanzar */ }
    return homeH;
  };

  const alCargar = (id: number) => {
    const h = alturaDe(iframes.current.get(id));
    setHomeH(h);
    const p = pendiente.current;
    if (p && p.id === id) {
      // Promoción: el nuevo se muestra y el viejo se desmonta (segundo iframe transitorio).
      pendiente.current = null;
      setActivoId(id);
      setFrames([id]);
      // Reaplica el SCROLL al nuevo (activo), clampeado al alto NUEVO. El clamp usa `h*scale`
      // —el alto del spacer tras esta carga— y no `scrollHeight` (que aún no re-renderizó): el
      // contenido pudo ACORTARSE y el scrollTop viejo caer fuera. rAF para leer tras el paint.
      requestAnimationFrame(() => {
        const pane = scroller.current;
        if (!pane) return;
        const max = Math.max(0, h * scale - pane.clientHeight);
        pane.scrollTop = Math.min(p.scroll, max);
      });
    }
  };

  const recargar = () => {
    const nuevo = nextId.current++;
    pendiente.current = { id: nuevo, scroll: scroller.current?.scrollTop ?? 0 };
    setFrames(fs => [...fs, nuevo]); // segundo iframe (oculto) carga en paralelo
  };

  return (
    <div className="tienda-split">
      {/* Vista previa (izq) — desktop escalado; se OCULTA bajo el breakpoint (§ duna.css). */}
      <div ref={paneRef} className="tienda-preview-pane">
        {scale > 0 && (
          // El SPACER lleva el alto ESCALADO (transform no cambia el layout), así el pane
          // scrollea la altura correcta; los iframes van escalados y superpuestos (top:0).
          <div className="tienda-preview-lienzo" style={{ height: homeH * scale, width: DESKTOP * scale }}>
            {frames.map(id => (
              <iframe
                key={id}
                ref={el => { if (el) iframes.current.set(id, el); else iframes.current.delete(id); }}
                src="/?preview=1"
                title="Vista previa de la tienda"
                onLoad={() => alCargar(id)}
                style={{
                  width: DESKTOP,
                  height: homeH,
                  border: 0,
                  display: 'block',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                  visibility: id === activoId ? 'visible' : 'hidden',
                }}
              />
            ))}
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
