'use client';

import { useState } from 'react';
import TiendaSeccionEditor from '@/components/admin/TiendaSeccionEditor';
import TogglePagina from '@/components/admin/TogglePagina';
import { SECCIONES_TIENDA, PAGINAS, type PaginaKey } from '@/components/admin/tienda-secciones';

// El editor del storefront agrupado por PÁGINA (Home / Nosotros). El selector se renderiza SIEMPRE:
// el config define siempre ≥2 páginas (Home con sus secciones, Nosotros con la suya), así que hay
// dos elecciones reales — un gate "≥2 páginas" nunca se ejercería, sería código muerto. El día que
// un deployment pudiera tener una sola página, el guard entra ahí, con ese caso real.
export default function TiendaPaginas() {
  const [pagina, setPagina] = useState<PaginaKey>('home');
  const paginaMeta = PAGINAS.find(p => p.key === pagina)!;
  const secciones = SECCIONES_TIENDA.filter(c => c.pagina === pagina);

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
          <TiendaSeccionEditor key={config.seccion} config={config} />
        ))}
      </div>
    </div>
  );
}
