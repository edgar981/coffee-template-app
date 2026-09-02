'use client';

import { useCallback, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';

// Escala un fragmento renderizado a ANCHO DE ESCRITORIO hacia el ancho real de su contenedor,
// con `transform: scale`. Así los componentes del storefront se ven a su layout de DISEÑO —no
// reflowados a un ancho angosto que ningún visitante usa— y sólo se reducen visualmente. Resuelve
// la clase de defecto que rompía a TrustBadges en la columna del editor de paleta.
//
// GENÉRICO A PROPÓSITO: no sabe de `SiteContent`, secciones, providers ni de qué se renderiza —
// sólo MIDE (dos ResizeObserver: ancho del pane, alto natural del contenido), ESCALA `children`, y
// NEUTRALIZA la navegación de sus enlaces (es una vista PREVIA, no un storefront navegable — ver
// `neutralizarEnlace` abajo). Un `<a>` es HTML genérico, no conocimiento del storefront.
// Lo que se extrajo de `VistaTiendaEnVivo` es exactamente eso: la lógica de las dos ROs con el
// cálculo de escala, que es la clase que diverge en silencio si se duplica. Todo lo específico de
// la vista de contenido (el mapa de secciones, el `SiteContentProvider`, el `PreviewProvider`, el
// chrome del pane) se quedó en el consumidor. La caja/estilo del pane la pone el consumidor por
// `className`/`style`; acá sólo se garantiza `position: relative` (lo que el contenido absoluto
// necesita) y, en modo grande, el alto = contenido escalado.
//
// DOS MODOS:
//  · GRANDE (default): escala por ANCHO (`paneW/desktopW`); el pane toma el alto del contenido escalado.
//  · COMPACTO: scale-to-FIT (el menor de ancho/alto) dentro de una caja fija que pone el consumidor,
//    con el contenido CENTRADO (letterbox por los offsets left/top).

const DESKTOP_W = 1280;

export function EscalaDesktop({
  children,
  compacto = false,
  desktopW = DESKTOP_W,
  className,
  style,
}: {
  children: ReactNode;
  compacto?: boolean;
  desktopW?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const roPane = useRef<ResizeObserver | null>(null);
  const roContenido = useRef<ResizeObserver | null>(null);
  const [paneW, setPaneW] = useState(0);
  const [paneH, setPaneH] = useState(0);
  const [contenidoH, setContenidoH] = useState(0);

  // RO sobre el PANE → su tamaño real. En COMPACTO se usan ancho Y alto (la caja la fija el
  // consumidor); en GRANDE sólo el ancho (el alto lo pone el contenido). Ignora el aviso de tamaño
  // 0 (nodo saliendo); se recalcula al colapsar el rail o redimensionar. Callback ref (se engancha
  // y desengancha con cada nodo), no efecto `[]` — un RO que mira el nodo viejo tras un remontaje es
  // el defecto que ya costó una curva sin dibujar (§ Pagos — el defecto del observer).
  const paneRef = useCallback((nodo: HTMLDivElement | null) => {
    roPane.current?.disconnect(); roPane.current = null;
    if (!nodo) return;
    const ro = new ResizeObserver(es => {
      for (const e of es) {
        const w = Math.round(e.contentRect.width);
        const h = Math.round(e.contentRect.height);
        if (w > 0) setPaneW(w);
        if (h > 0) setPaneH(h);
      }
    });
    ro.observe(nodo); roPane.current = ro;
  }, []);

  // RO sobre el CONTENIDO (a `desktopW`, sin escalar) → su alto natural, para el fit compacto y para
  // dimensionar el pane grande al alto escalado. Se re-mide cuando el contenido cambia de alto.
  const contenidoRef = useCallback((nodo: HTMLDivElement | null) => {
    roContenido.current?.disconnect(); roContenido.current = null;
    if (!nodo) return;
    const ro = new ResizeObserver(es => { for (const e of es) { const h = Math.round(e.contentRect.height); if (h > 0) setContenidoH(h); } });
    ro.observe(nodo); roContenido.current = ro;
  }, []);

  // ESCALA. Grande: por ancho. Compacto: scale-to-fit (el menor de ancho/alto), y el contenido se
  // CENTRA en la caja con los offsets (letterbox).
  let scale = 0, left = 0, top = 0;
  if (compacto) {
    if (paneW > 0 && paneH > 0 && contenidoH > 0) {
      scale = Math.min(paneW / desktopW, paneH / contenidoH);
      left = (paneW - desktopW * scale) / 2;
      top = (paneH - contenidoH * scale) / 2;
    }
  } else {
    scale = paneW > 0 ? paneW / desktopW : 0;
  }

  const alto = compacto ? undefined : (scale > 0 && contenidoH > 0 ? contenidoH * scale : undefined);

  // La vista previa NO es un storefront navegable: sus `<Link>`/`<a>` se ven como enlaces —mismo
  // estilo, mismo cursor— pero NO navegan. Se neutralizan ACÁ, en la frontera de la vista escalada:
  // es el ÚNICO punto por el que pasan TODOS los consumidores (VistaTiendaEnVivo, PaletaSeccion) y sus
  // superficies (tarjeta, vista grande, overlay de ampliar), así que el fix vale para todos sin que un
  // componente del storefront sepa nada del admin. `stopPropagation` en CAPTURE corta la navegación de
  // `next/link` —su `onClick` de burbuja no llega a correr— y `preventDefault` corta el default nativo
  // de un `<a href>`. Sólo intercepta clics SOBRE un enlace (`closest('a')`): el clic de la TARJETA que
  // abre "Editar" —contenido en `pointer-events:none`, click al thumb ancestro— pasa intacto. `auxclick`
  // cubre el clic-medio (abrir en pestaña nueva). NO cambia el aspecto: el enlace sigue siendo un `<a>`.
  const neutralizarEnlace = useCallback((e: ReactMouseEvent) => {
    if ((e.target as HTMLElement | null)?.closest?.('a')) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  return (
    <div ref={paneRef} className={className} onClickCapture={neutralizarEnlace} onAuxClickCapture={neutralizarEnlace} style={{ position: 'relative', ...(alto != null ? { height: alto } : {}), ...style }}>
      {/* Se monta con paneW>0 (no scale>0): en compacto la escala depende de `contenidoH`, que sólo
          se mide una vez montado el contenido. El `scale(0)` de un tick es medible e invisible. */}
      {paneW > 0 && (
        <div
          ref={contenidoRef}
          style={{ width: desktopW, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', top, left }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
