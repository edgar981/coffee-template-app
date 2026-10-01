'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import TiendaSeccionEditor from '@/components/admin/TiendaSeccionEditor';
import VistaTiendaIframe, { type VistaTiendaIframeHandle } from '@/components/admin/VistaTiendaIframe';
import TogglePagina from '@/components/admin/TogglePagina';
import { SECCIONES_TIENDA, PAGINAS, type PaginaKey, type SeccionVista } from '@/components/admin/tienda-secciones';
import { getProducts } from '@/lib/api/products';
import { categoriasDelCatalogo } from '@/lib/productos/categorias';
import { useSheetDesdeAbajo } from '@/hooks/useSheetDesdeAbajo';

// El editor del storefront agrupado por PÁGINA (Home / Nosotros). El selector se renderiza SIEMPRE:
// el config define siempre ≥2 páginas (Home con sus secciones, Nosotros con la suya), así que hay
// dos elecciones reales — un gate "≥2 páginas" nunca se ejercería, sería código muerto. El día que
// un deployment pudiera tener una sola página, el guard entra ahí, con ese caso real.
export default function TiendaPaginas() {
  // DEEP-LINK del aviso de config del Dashboard (§ Backlog #65): `?seccion=&tarjeta=` abre esa sección
  // en su página y resalta el bloque de la tarjeta. Precedente de query-params en el panel: `?pedido=`
  // de Pedidos (por eso el page envuelve esto en <Suspense>, como Pedidos). El deep-link se pasa a cada
  // editor; sólo el de la sección objetivo actúa. La lógica de abrir/resaltar/scrollear vive en el editor
  // (reusa el puente vista→formulario), no acá.
  const params = useSearchParams();
  const seccionParam = params.get('seccion');
  const tarjetaNum = params.get('tarjeta') != null ? Number(params.get('tarjeta')) : NaN;
  const resaltar = seccionParam
    ? { seccion: seccionParam, slot: Number.isInteger(tarjetaNum) ? tarjetaNum : null }
    : null;
  // La página INICIAL = la de la sección del deep-link (Presentaciones → home); sin deep-link, home.
  const paginaObjetivo = seccionParam ? SECCIONES_TIENDA.find(c => c.seccion === seccionParam)?.pagina : undefined;
  const [pagina, setPagina] = useState<PaginaKey>(paginaObjetivo ?? 'home');
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
    <div>
      {/* Selector de página. Visual de pill, semántica de tab (una página es un destino, no un toggle).
          Suscripciones es una PESTAÑA como Home/Nosotros (§ PAGINAS): su interruptor vive DENTRO de su
          pestaña —igual que el de Nosotros—, no suelto arriba, así no hay "dos clases de página" que
          nada explique. Hoy su pestaña sólo tiene el interruptor (sus planes están en código, § #49). */}
      <div role="tablist" aria-label="Página del storefront" style={{ display: 'flex', gap: 'var(--duna-space-2)', marginBottom: 'var(--duna-space-5)' }}>
        {PAGINAS.map(p => (
          <button
            key={p.key}
            role="tab"
            aria-selected={p.key === pagina}
            onClick={() => setPagina(p.key)}
            className={`duna-pill${p.key === pagina ? ' is-on' : ''}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* El toggle de encender/apagar, DENTRO de la pestaña de la página apagable (Nosotros · Suscripciones). */}
      {paginaMeta.apagable && <TogglePagina pagina={pagina} label={paginaMeta.label} />}

      {/* La `nota` de la página — hoy sólo Suscripciones: dice QUÉ gobierna el interruptor (las 5
          superficies que apaga/enciende). */}
      {paginaMeta.nota && (
        <p className="duna-sub" style={{ marginTop: 'var(--duna-space-3)', maxWidth: '42rem' }}>{paginaMeta.nota}</p>
      )}

      {/* LA COMPOSICIÓN (§ EDITOR-TIENDA-IFRAME-VISTA-1): la lista de secciones a un costado, la
          página REAL al centro — nunca secciones aisladas (decisión del owner). Columnas lado a lado
          ≥960; apiladas (iframe arriba, lista abajo) por debajo, donde no hay ancho para las dos.
          El iframe queda en la MISMA posición del árbol en los dos casos (sólo cambia su envoltura
          por `order`/alto/sticky) para no remontarlo —y perder su scroll— al cruzar el umbral. */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: angosto ? '1fr' : 'minmax(0, 1fr) minmax(360px, 1fr)',
        gap: 'var(--duna-space-6)',
        alignItems: 'start',
      }}>
        <div style={{ display: 'grid', gap: 'var(--duna-space-4)', minWidth: 0, order: angosto ? 2 : 1 }}>
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
          order: angosto ? 1 : 2,
          position: angosto ? 'static' : 'sticky',
          top: angosto ? undefined : 'calc(var(--duna-topbar-h) + var(--duna-space-4))',
          height: angosto ? '60vh' : 'calc(100dvh - var(--duna-topbar-h) - var(--duna-space-8))',
        }}>
          <VistaTiendaIframe ref={iframeRef} pagina={pagina} />
        </div>
      </div>
    </div>
  );
}
