'use client';

import { useState, useEffect } from 'react';
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
  const [pagina, setPagina] = useState<PaginaKey>('home');
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

  return (
    <div>
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
          <TiendaSeccionEditor key={config.seccion} config={config} categorias={categorias} categoriasListas={categoriasListas} />
        ))}
      </div>
    </div>
  );
}
