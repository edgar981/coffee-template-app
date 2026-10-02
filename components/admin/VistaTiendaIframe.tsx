'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';
import type { PaginaKey, SeccionVista } from '@/components/admin/tienda-secciones';
import {
  urlDePagina,
  urlDePaginaEnEditor,
  selectorDeSeccion,
  scrollSeguro,
  ANCHOS_DISPOSITIVO,
  DISPOSITIVO_DEFECTO,
  calcularEscalaDispositivo,
  type DispositivoKey,
} from '@/lib/admin/editor-iframe';

// LA PÁGINA REAL de la tienda, completa, dentro del panel (§ EDITOR-TIENDA-IFRAME-VISTA-1).
// Reemplaza las vistas previas sueltas por sección (`VistaTiendaEnVivo`) que montaba cada
// `TiendaSeccionEditor`: en vez de reconstruir cada banda con una segunda implementación del
// cálculo de colores/tipografía/forma, el iframe navega a la RUTA REAL del storefront en modo
// borrador (§ EDITOR-TIENDA-IFRAME-GATE-1, reescrito en `MODO-EDITOR-SOLO-EN-EL-IFRAME-1`: el
// borrador se activa por el `?editor=1` de la URL del iframe, no por una cookie de sesión) — mismo
// origen, sin `postMessage` todavía (ésa es `EDITOR-TIENDA-POSTMESSAGE-1`, slice 3 del plan): cada
// guardado asentado, publicar o descartar recargan el documento, conservando el scroll.
//
// "Ir a la sección" y el resalte se resuelven por MANIPULACIÓN DIRECTA del DOM del iframe —mismo
// origen, así que `contentDocument`/`contentWindow` son accesibles sin restricción— en vez de con
// una clase CSS que el storefront tendría que declarar: el storefront no necesita saber que un
// resalte existe, y el estilo nunca puede quedar "pegado" en una recarga.
//
// NAVEGAR DENTRO DEL IFRAME — decisión y por qué (§ MODO-EDITOR-SOLO-EN-EL-IFRAME-1). La tienda
// real adentro es completamente interactiva: un clic en el nav, una tarjeta de producto o el
// carrito puede llevar a OTRA ruta (`/tienda`, `/tienda/[slug]`, `/checkout`…) que no lleva
// `?editor=1`. Dos salidas posibles —"conservar el parámetro" en cada navegación, o "el iframe
// vuelve a la página del editor"— y se elige la SEGUNDA:
//   - "Conservar el parámetro" exigiría reescribir el destino de CADA enlace del storefront antes
//     de que navegue. La mayoría de esa navegación es client-side de Next (`<Link>`, `router.push`),
//     que NO dispara el evento `load` del iframe ni reusa el `href` del DOM en el momento del clic
//     (el handler de `Link` ya capturó el destino original) — habría que interceptar el CLIC en fase
//     de captura y forzar una navegación completa por cada uno, tocando el comportamiento de TODO el
//     storefront (fuera de `touches:` de este slice) a cambio de evitar un reload.
//   - "Vuelve a la página del editor" se resuelve ENTERO acá, sin tocar una sola página del
//     storefront: un POLL (no un `onLoad`, que tampoco vería una navegación client-side — mismo
//     motivo de arriba) compara el pathname real del iframe contra el de la pestaña activa, y si
//     divergió —por CUALQUIER causa: clic, redirect de un submit, `router.push`— lo manda de vuelta
//     con `location.replace`, CON el parámetro. Cuesta un reload extra si el admin se desvía, pero
//     es robusto a cualquier mecanismo de navegación y no depende de qué construya cada página.
// `EDITOR-TIENDA-POSTMESSAGE-1` (slice 3 del plan) es el lugar correcto para una experiencia de
// navegación más fina (el storefront avisa su propia ruta por `postMessage`); acá el editor es de
// UNA página a la vez, y volver a ella es la expectativa correcta mientras tanto.
const INTERVALO_VIGIA_RUTA_MS = 400;
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

const VistaTiendaIframe = forwardRef<VistaTiendaIframeHandle, { pagina: PaginaKey; dispositivo?: DispositivoKey }>(
  function VistaTiendaIframe({ pagina, dispositivo = DISPOSITIVO_DEFECTO }, ref) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const scrollPendiente = useRef<number | null>(null);
    // EL DISPOSITIVO (§ EDITOR-TIENDA-DISPOSITIVOS-1, § 4.3 de DISENO.md): el canvas que mide su
    // propio tamaño disponible (ResizeObserver, ancho Y alto — a diferencia de `EscalaDesktop`, que
    // sólo mide ancho porque su contenido tiene alto NATURAL; acá el iframe no lo tiene — su alto es
    // el que el canvas le dé, como un viewport real). No se remonta cuando cambia `pagina` (sólo el
    // `<iframe key={pagina}>` de abajo lo hace), así que un `useEffect(() => {...}, [])` normal —sin
    // el patrón de callback-ref de `EscalaDesktop`— es correcto acá: este nodo nunca es el que se
    // desmonta y remonta.
    const canvasRef = useRef<HTMLDivElement>(null);
    const [medida, setMedida] = useState({ ancho: 0, alto: 0 });
    useEffect(() => {
      const nodo = canvasRef.current;
      if (!nodo || typeof ResizeObserver === 'undefined') return;
      const ro = new ResizeObserver(entries => {
        const entry = entries[0];
        if (!entry) return;
        setMedida({ ancho: Math.round(entry.contentRect.width), alto: Math.round(entry.contentRect.height) });
      });
      ro.observe(nodo);
      return () => ro.disconnect();
    }, []);
    const anchoDispositivo = ANCHOS_DISPOSITIVO[dispositivo];
    const medido = medida.ancho > 0 && medida.alto > 0;
    const escala = medido ? calcularEscalaDispositivo(medida.ancho, anchoDispositivo) : 1;
    // El ancho VISIBLE del stage (<= ancho disponible, por construcción de `escala`); el alto
    // INTERNO (sin escalar) se dimensiona para que, al multiplicarlo por `escala`, ocupe EXACTAMENTE
    // el alto disponible — ni hueco ni recorte, nunca scroll del canvas. `medido` gatea los dos: sin
    // medición todavía, el stage toma el 100% del canvas sin transformar (el primer paint, antes de
    // que el ResizeObserver reporte — un sub-frame, no un estado visible de verdad).
    const anchoVisible = medido ? Math.round(anchoDispositivo * escala) : anchoDispositivo;
    const altoInterno = medido ? medida.alto / escala : undefined;
    // EL resalte ACTIVO (nodo + su timer de limpieza), no sólo el timer: con sólo el timer, resaltar
    // una SEGUNDA sección mientras la primera seguía iluminada cancelaría el timer de la primera sin
    // limpiar su outline (queda pegado para siempre), y resaltar la MISMA sección dos veces seguidas
    // haría que el segundo timeout "restaurara" el outline AMBAR que el primero dejó puesto como si
    // fuera el valor original. Guardar el nodo deja limpiar la mitad VIEJA explícitamente antes de
    // pintar la nueva, en vez de fiarse de un valor "previo" capturado a mitad de una animación.
    const resaltadoRef = useRef<{ nodo: HTMLElement; timeout: number } | null>(null);
    const [cargando, setCargando] = useState(true);
    // Espejo SÍNCRONO de `cargando` para el vigía de ruta (abajo): el `setInterval` se crea UNA vez
    // por `pagina` y su callback, si leyera `cargando` por closure, vería siempre el valor del
    // momento en que se creó el efecto — no el actual. El ref se actualiza en cada render.
    const cargandoRef = useRef(cargando);
    cargandoRef.current = cargando;

    const rutaEditor = urlDePaginaEnEditor(pagina);
    const rutaPagina = urlDePagina(pagina);

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

    // EL VIGÍA DE RUTA (§ el comentario grande de arriba, "NAVEGAR DENTRO DEL IFRAME"). Un POLL, no
    // un `onLoad`: la navegación client-side de Next (`<Link>`, `router.push`) cambia
    // `contentWindow.location` vía `history.pushState` SIN disparar el evento `load` del iframe, así
    // que un chequeo "al cargar" nunca vería ese caso — sólo comparar la ruta a intervalos lo
    // atrapa, sea cual sea el mecanismo que la cambió.
    useEffect(() => {
      const id = window.setInterval(() => {
        // Mientras el documento está a mitad de cargar (incluida la primera carga, antes del
        // primer `onLoad`), `contentWindow.location` puede ser `about:blank` o el documento VIEJO
        // todavía — comparar en ese instante daría un falso positivo y dispararía un `replace`
        // sobre una navegación que ya estaba en curso.
        if (cargandoRef.current) return;
        const win = iframeRef.current?.contentWindow;
        if (!win) return;
        let actual: string;
        try {
          actual = win.location.pathname;
        } catch {
          // Cross-origin momentáneo a mitad de una transición de navegación — se reintenta en el
          // próximo tick, nunca se trata como "se fue a otra página".
          return;
        }
        if (actual === rutaPagina) return;
        // El admin navegó FUERA de la página que está editando (un clic en el nav/una tarjeta,
        // un redirect de un submit...): vuelve a ESTA página, con el modo editor puesto.
        limpiarResalte();
        cargandoRef.current = true;
        setCargando(true);
        win.location.replace(rutaEditor);
      }, INTERVALO_VIGIA_RUTA_MS);
      return () => window.clearInterval(id);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- `rutaEditor`/`rutaPagina` se derivan
      // de `pagina`, ya en las deps; `limpiarResalte` no es estable entre renders pero no necesita
      // serlo acá (lee `resaltadoRef`, no estado de render).
    }, [pagina, rutaPagina, rutaEditor]);

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
          ref={canvasRef}
          style={{
            position: 'relative',
            flex: '1 1 auto',
            minHeight: 0,
            border: '1px solid var(--duna-border)',
            borderRadius: 'var(--duna-r-l)',
            overflow: 'hidden',
            background: 'var(--duna-bg)',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          {/* EL STAGE DEL DISPOSITIVO: ancho LITERAL del dispositivo elegido (así se activan los
              breakpoints reales de la tienda — § 4.3 de DISENO.md), reducido ENTERO con
              `transform: scale` sólo si no cabe en el canvas — nunca recortado, nunca con scroll
              horizontal. El `<iframe>` ve su propio tamaño REAL (anchoDispositivo × altoInterno)
              ANTES de la transformación: el scale es puramente visual, no cambia qué CSS responsivo
              corre adentro. */}
          <div style={{ width: anchoVisible, height: '100%', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
            <div
              style={{
                width: anchoDispositivo,
                height: altoInterno ?? '100%',
                transform: medido ? `scale(${escala})` : undefined,
                transformOrigin: 'top left',
              }}
            >
              <iframe
                ref={iframeRef}
                key={pagina}
                src={rutaEditor}
                title="Vista previa de la tienda"
                onLoad={onLoad}
                style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
              />
            </div>
          </div>
          {cargando && (
            <div className="duna-skel" aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 0 }} />
          )}
        </div>
      </div>
    );
  },
);

export default VistaTiendaIframe;
