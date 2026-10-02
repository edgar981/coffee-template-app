'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import TiendaSeccionEditor from '@/components/admin/TiendaSeccionEditor';
import VistaTiendaIframe, { type VistaTiendaIframeHandle } from '@/components/admin/VistaTiendaIframe';
import TogglePagina from '@/components/admin/TogglePagina';
import { SECCIONES_TIENDA, PAGINAS, type PaginaKey, type SeccionVista } from '@/components/admin/tienda-secciones';
import { getProducts } from '@/lib/api/products';
import { categoriasDelCatalogo } from '@/lib/productos/categorias';
import { useSheetDesdeAbajo } from '@/hooks/useSheetDesdeAbajo';
import { DISPOSITIVO_DEFECTO, type DispositivoKey } from '@/lib/admin/editor-iframe';

export interface TiendaPaginasProps {
  /** La página activa — CONTROLADA desde `EditorTiendaPantallaCompleta` (§ EDITOR-TIENDA-
   *  DISPOSITIVOS-1): el selector de página subió a la barra superior del editor de pantalla
   *  completa, así que este componente ya no lo dibuja ni es dueño de su propio estado. */
  pagina: PaginaKey;
  /** El deep-link del aviso de config del Dashboard (§ Backlog #65), ya resuelto por el padre —
   *  antes este componente leía `useSearchParams` por su cuenta; ahora sólo recibe el resultado. */
  resaltar: { seccion: string; slot: number | null } | null;
  /** El ancho literal al que se arma el iframe (§ 4.3 de DISENO.md). Default Escritorio si se omite
   *  —`VistaTiendaIframe` también lo asume por su cuenta—, para que este componente siga siendo
   *  usable sin que el consumidor tenga que decidir un dispositivo. */
  dispositivo?: DispositivoKey;
}

// El editor del storefront agrupado por PÁGINA (Home / Nosotros), montado DENTRO del editor de
// pantalla completa (§ EDITOR-TIENDA-DISPOSITIVOS-1 — antes vivía directo en `/admin/tienda`). El
// selector de página y el de dispositivo ya no son responsabilidad de este componente: los dos
// llegan por prop desde `EditorTiendaPantallaCompleta`, que los pone en su barra superior.
export default function TiendaPaginas({ pagina, resaltar, dispositivo = DISPOSITIVO_DEFECTO }: TiendaPaginasProps) {
  const paginaMeta = PAGINAS.find(p => p.key === pagina)!;
  const secciones = SECCIONES_TIENDA.filter(c => c.pagina === pagina);

  // EL IFRAME COMPARTIDO (§ EDITOR-TIENDA-IFRAME-VISTA-1): UNA sola vista en vivo por página, no una
  // por sección — reemplaza las `VistaTiendaEnVivo` sueltas que cada `TiendaSeccionEditor` montaba.
  // Los editores no la ven: le hablan por el `ref` a través de dos callbacks (abrir una sección,
  // recargar tras un cambio publicado), así que agregar/quitar secciones no toca este componente.
  const iframeRef = useRef<VistaTiendaIframeHandle>(null);
  const irASeccion = useCallback((seccion: SeccionVista) => iframeRef.current?.irASeccion(seccion), []);
  const recargarIframe = useCallback(() => iframeRef.current?.recargar(), []);

  // ANGOSTO reusa la pregunta de `useSheetDesdeAbajo` ("¿es una pantalla táctil de una mano?",
  // umbral 960 — § DUNA_MQ_SHEET_ABAJO) para una decisión DISTINTA de la suya (de qué borde sale un
  // sheet): acá decide si la lista de secciones y el iframe se apilan en vez de ir lado a lado. Es
  // la MISMA pregunta —hay rail, no hay espacio para dos columnas anchas— así que comparte el
  // umbral en vez de abrir un segundo listener de `matchMedia` para lo mismo.
  const angosto = useSheetDesdeAbajo();

  // Las categorías DERIVADAS del catálogo, para el campo-destino de Presentaciones (el combobox + el
  // aviso de destino inexistente). Se cargan UNA vez —misma fuente que /admin/productos
  // (`getProducts` + `categoriasDelCatalogo`), sin endpoint nuevo—. Si el fetch falla, `categoriasListas`
  // queda en false: el combobox sólo deja escribir y el aviso NO se muestra (no afirmar sobre un
  // catálogo que no tenemos).
  const [categorias, setCategorias] = useState<string[]>([]);
  const [categoriasListas, setCategoriasListas] = useState(false);
  useEffect(() => {
    let vivo = true;
    getProducts()
      .then(ps => { if (vivo) { setCategorias(categoriasDelCatalogo(ps)); setCategoriasListas(true); } })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  // EL CONTENIDO se pide UNA vez acá y se baja a cada editor su rebanada (§ fetch 6→1): antes cada sección
  // fetcheaba `/api/site-content` COMPLETO y usaba sólo su slice —5 requests idénticos en la home—. El GET
  // devuelve el doc draft-merged entero (`contenido`) + el mapa `sinPublicar`; el editor siembra su form de
  // su slice. `recargar` re-lee y DEVUELVE lo fresco, para el re-seed del editor tras "Descartar" (el único
  // que re-leía). Las ESCRITURAS (PUT autoguardado, POST publicar/descartar) siguen POR SECCIÓN, sin tocar.
  const [doc, setDoc] = useState<{ contenido: Record<string, unknown>; sinPublicar: Record<string, boolean> } | null>(null);
  const [errorDoc, setErrorDoc] = useState(false);
  const recargarDoc = useCallback(async () => {
    const r = await fetch('/api/site-content');
    if (!r.ok) throw new Error();
    const d = await r.json();
    setDoc({ contenido: d.contenido ?? {}, sinPublicar: d.sinPublicar ?? {} });
    return d as { contenido?: Record<string, unknown>; sinPublicar?: Record<string, boolean> };
  }, []);
  useEffect(() => { recargarDoc().catch(() => setErrorDoc(true)); }, [recargarDoc]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* El toggle de encender/apagar y la nota de la página apagable (Nosotros · Suscripciones) — el
          selector de PÁGINA en sí ya no vive acá, subió a la barra superior del editor de pantalla
          completa (§ EDITOR-TIENDA-DISPOSITIVOS-1, `EditorTiendaPantallaCompleta`). */}
      {(paginaMeta.apagable || paginaMeta.nota) && (
        <div style={{ flexShrink: 0, marginBottom: 'var(--duna-space-5)' }}>
          {paginaMeta.apagable && <TogglePagina pagina={pagina} label={paginaMeta.label} />}
          {paginaMeta.nota && (
            <p className="duna-sub" style={{ marginTop: 'var(--duna-space-3)', maxWidth: '42rem' }}>{paginaMeta.nota}</p>
          )}
        </div>
      )}

      {/* LA COMPOSICIÓN (§ EDITOR-TIENDA-IFRAME-VISTA-1): la lista de secciones a un costado, la
          página REAL al centro — nunca secciones aisladas (decisión del owner). Columnas lado a lado
          ≥960; apiladas (iframe arriba, lista abajo) por debajo, donde no hay ancho para las dos.
          SIN sticky/document-scroll (§ EDITOR-TIENDA-DISPOSITIVOS-1): el editor de pantalla completa
          ya no es una página de scroll de documento — es su PROPIA región de alto fijo (la barra
          superior + este cuerpo llenan el viewport), así que la lista scrollea DENTRO de su columna
          y el iframe toma el alto DISPONIBLE completo, sin calcular contra `--duna-topbar-h` (que acá
          no existe: no hay topbar del panel). */}
      <div style={{
        display: angosto ? 'flex' : 'grid',
        flexDirection: angosto ? 'column' : undefined,
        gridTemplateColumns: angosto ? undefined : 'minmax(0, 1fr) minmax(360px, 1fr)',
        gap: 'var(--duna-space-6)',
        flex: '1 1 auto',
        minHeight: 0,
      }}>
        <div style={{
          display: 'grid',
          gap: 'var(--duna-space-4)',
          minWidth: 0,
          order: angosto ? 2 : 1,
          overflowY: 'auto',
          alignContent: 'start',
          ...(angosto ? { flex: '1 1 auto', minHeight: 0 } : { height: '100%' }),
        }}>
          {secciones.map(config => (
            <TiendaSeccionEditor
              key={config.seccion}
              config={config}
              categorias={categorias}
              categoriasListas={categoriasListas}
              resaltar={resaltar}
              onAbrir={irASeccion}
              onCambioPublicado={recargarIframe}
              carga={{
                valor: doc ? (doc.contenido[config.seccion] as Record<string, unknown> | undefined) : undefined,
                sinPublicar: doc ? !!doc.sinPublicar[config.seccion] : false,
                listo: !!doc,
                error: errorDoc,
                recargar: recargarDoc,
              }}
            />
          ))}
        </div>
        <div style={{
          minWidth: 0,
          minHeight: 0,
          order: angosto ? 1 : 2,
          ...(angosto ? { height: '50vh', flexShrink: 0 } : { height: '100%' }),
        }}>
          <VistaTiendaIframe ref={iframeRef} pagina={pagina} dispositivo={dispositivo} />
        </div>
      </div>
    </div>
  );
}
