'use client';

import { useCallback, useRef, useState } from 'react';
import TiendaHeroSeccion from '@/components/admin/TiendaHeroSeccion';
import { REGISTRY, type SiteContentData } from '@/lib/config/site-content-defaults';

// El iframe renderiza el viewport DESKTOP a tamaño REAL (1280×800) y el `transform: scale` lo
// reduce al ancho del pane. El documento interno scrollea DENTRO del marco (modelo a): ver el
// resto de la home es el MISMO gesto del visitante, sin un segundo scroller sincronizado.
//
// ⚠️ EL ALTO ES FIJO (800), NO scrollHeight — y esto NO se debe "arreglar" volviendo a
// scrollHeight. El hero es `min-h-[92vh]`, así que su alto CRECE con el alto del marco. Si el
// iframe tomara el alto del documento, el hero se hincharía contra ese alto y desincronizaría
// los dos scrollers. Medido en el storefront real: a un marco de 5792px el hero mide 5329px
// (ratio 4.16:1, grotesco); a 800px mide 736px (0.575:1, la proporción real del desktop). Un
// viewport de alto FIJO es lo único que da la proporción correcta. Volver a scrollHeight
// reintroduce los dos defectos: hero desproporcionado + dos scrolls que topan en puntos
// distintos (el spacer basado en un scrollHeight rancio ≠ el contenido ya hinchado).
const DESKTOP_W = 1280;
const DESKTOP_H = 800;

// Las secciones editables SALEN del registry —el selector no tiene una lista propia—. Hoy es
// UNA (Portada/hero); BrandStory/Testimonios/Suscripción entran agregándolas al registry + su
// editor, sin tocar esta plataforma.
const SECCIONES = Object.keys(REGISTRY) as (keyof SiteContentData)[];

export default function TiendaPreview() {
  // Ancho REAL del pane, con ResizeObserver (patrón de PagosCurva): callback ref que
  // engancha/desengancha con cada nodo e IGNORA el aviso de ancho 0 (nodo saliendo). Observa el
  // PANE —ESTABLE, no se remonta al intercambiar iframes—, así que el factor `paneW/1280` se
  // recalcula SOLO al colapsar el rail o redimensionar (el pane cambia de ancho → RO dispara).
  const observador = useRef<ResizeObserver | null>(null);
  const [paneW, setPaneW] = useState(0);

  const paneRef = useCallback((nodo: HTMLDivElement | null) => {
    observador.current?.disconnect();
    observador.current = null;
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

  const scale = paneW > 0 ? paneW / DESKTOP_W : 0;

  // DOBLE-BUFFER: normalmente UN iframe. Al guardar se agrega un SEGUNDO (oculto, cargando);
  // cuando termina, hereda el scroll INTERNO del anterior y se vuelve el activo; el viejo se
  // DESTRUYE —dos renders de la home vivos a la vez es el doble del peso, así que el segundo
  // existe SÓLO durante el intercambio—. El viejo se ve hasta que el nuevo está listo → cero
  // parpadeo.
  const [frames, setFrames]     = useState<number[]>([0]); // ids; el ÚLTIMO es el objetivo
  const [activoId, setActivoId] = useState(0);             // el que se muestra
  const nextId    = useRef(1);
  const pendiente = useRef<{ id: number; scroll: number } | null>(null);
  const iframes   = useRef<Map<number, HTMLIFrameElement>>(new Map());

  // El scroll vive DENTRO del iframe (mismo origen). `scrollActual` lo lee para guardarlo antes
  // de recargar; `maxScroll` es el rango del documento NUEVO (scrollHeight − alto del marco fijo)
  // para clampear el restaurado —el contenido pudo ACORTARSE entre recargas y el scroll viejo
  // caer fuera—. El alto del marco NO sale de acá: es fijo (ver arriba).
  const scrollActual = (el: HTMLIFrameElement | undefined): number => {
    try { return el?.contentWindow?.scrollY ?? 0; } catch { return 0; }
  };
  const maxScroll = (el: HTMLIFrameElement | undefined): number => {
    try {
      const h = el?.contentWindow?.document?.documentElement?.scrollHeight ?? 0;
      return Math.max(0, h - DESKTOP_H);
    } catch { return 0; }
  };

  const alCargar = (id: number) => {
    const p = pendiente.current;
    if (p && p.id === id) {
      // El nuevo hereda el scroll interno ANTES de mostrarse (está hidden), clampeado al rango
      // NUEVO. `behavior:'instant'` es OBLIGATORIO: el storefront tiene `scroll-behavior:smooth`,
      // así que sin esto el scrollTo ANIMA de 0 a la posición guardada y se ve el salto al
      // promover. Instant lo aplica de golpe, aún oculto. Recién entonces se promueve y el viejo
      // se desmonta (segundo iframe transitorio).
      const el = iframes.current.get(id);
      try {
        el?.contentWindow?.scrollTo({ top: Math.min(p.scroll, maxScroll(el)), behavior: 'instant' });
      } catch { /* mismo origen */ }
      pendiente.current = null;
      setActivoId(id);
      setFrames([id]);
    }
  };

  const recargar = () => {
    const nuevo = nextId.current++;
    pendiente.current = { id: nuevo, scroll: scrollActual(iframes.current.get(activoId)) };
    setFrames(fs => [...fs, nuevo]); // segundo iframe (oculto) carga en paralelo
  };

  // Sección activa (UNA a la vez). El COLAPSO del iframe se DERIVA del modelo: una sección
  // repeater (Testimonios, cuando exista) necesita la columna completa para su lista, así que
  // el preview se oculta y el editor toma todo el ancho. Es `REGISTRY[activa].repeater`, no un
  // `if` con el nombre de una sección. Hoy la única es Portada (no repeater) → nunca colapsa.
  const [activa, setActiva] = useState<keyof SiteContentData>(SECCIONES[0]);
  const colapsado = REGISTRY[activa].repeater != null;

  return (
    <div className={`tienda-split${colapsado ? ' tienda-split--sin-preview' : ''}`}>
      {/* Vista previa (izq) — el MARCO tiene el tamaño real de la ventana desktop escalada
          (paneW × 800·scale) y se ancla arriba (align-self:start, § duna.css); el documento
          scrollea DENTRO. Se OCULTA bajo el breakpoint. */}
      <div
        ref={paneRef}
        className="tienda-preview-pane"
        style={scale > 0 ? { height: DESKTOP_H * scale } : undefined}
      >
        {scale > 0 && (
          // Lienzo del tamaño de la ventana escalada; los iframes (viewport 1280×800) van
          // escalados y superpuestos (top:0). Sin spacer de scrollHeight: el pane no scrollea.
          <div className="tienda-preview-lienzo" style={{ height: DESKTOP_H * scale, width: DESKTOP_W * scale }}>
            {frames.map(id => (
              <iframe
                key={id}
                ref={el => { if (el) iframes.current.set(id, el); else iframes.current.delete(id); }}
                src="/?preview=1"
                title="Vista previa de la tienda"
                onLoad={() => alCargar(id)}
                style={{
                  width: DESKTOP_W,
                  height: DESKTOP_H,
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

      {/* Editor (der) — UNA sección a la vez. El selector sale del registry; con una sola
          sección no se muestra (un tab de uno no es una elección). El split le pasa el reload. */}
      <div className="tienda-editor-col">
        {SECCIONES.length > 1 && (
          <div className="tienda-secciones" role="tablist" aria-label="Secciones de la tienda">
            {SECCIONES.map(k => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={k === activa}
                className={`duna-pill${k === activa ? ' is-on' : ''}`}
                onClick={() => setActiva(k)}
              >
                {REGISTRY[k].label}
              </button>
            ))}
          </div>
        )}
        {activa === 'hero' && <TiendaHeroSeccion onGuardado={recargar} />}
      </div>
    </div>
  );
}
