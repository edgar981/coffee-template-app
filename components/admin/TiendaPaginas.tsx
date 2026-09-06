'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import TiendaSeccionEditor from '@/components/admin/TiendaSeccionEditor';
import TogglePagina from '@/components/admin/TogglePagina';
import { SECCIONES_TIENDA, PAGINAS, type PaginaKey } from '@/components/admin/tienda-secciones';
import { getProducts } from '@/lib/api/products';
import { categoriasDelCatalogo } from '@/lib/productos/categorias';

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
      {/* CAPACIDAD de suscripciones (§ Backlog #49): store-wide, va SOBRE el selector de página porque
          no es una página del editor —sus planes son estructura, no editable aún— sino un interruptor
          que gobierna la página /suscripciones, su enlace en el menú y el pie, y el bloque de la home
          JUNTOS. Reusa `TogglePagina` (key-agnóstico) sobre `paginas.suscripciones`. Default: encendida. */}
      <div style={{ marginBottom: 'var(--duna-space-6)' }}>
        <h2 className="duna-title" style={{ marginBottom: 'var(--duna-space-1)' }}>Suscripciones</h2>
        <p className="duna-sub" style={{ marginTop: 0, marginBottom: 'var(--duna-space-3)', maxWidth: '42rem' }}>
          Muestra u oculta las suscripciones en toda la tienda: la página, el enlace del menú y del pie,
          y el bloque de la home. Apágala si tu negocio no las ofrece. Los planes se coordinan por WhatsApp.
        </p>
        <TogglePagina pagina="suscripciones" label="Suscripciones" />
      </div>

      {/* Selector de página. Visual de pill, semántica de tab (una página es un destino, no un toggle). */}
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

      {/* El toggle de encender/apagar, sólo en las páginas apagables (Nosotros). */}
      {paginaMeta.apagable && <TogglePagina pagina={pagina} label={paginaMeta.label} />}

      <div style={{ display: 'grid', gap: 'var(--duna-space-8)' }}>
        {secciones.map(config => (
          <TiendaSeccionEditor
            key={config.seccion}
            config={config}
            categorias={categorias}
            categoriasListas={categoriasListas}
            resaltar={resaltar}
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
    </div>
  );
}
