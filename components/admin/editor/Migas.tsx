'use client';

import { ChevronLeft } from 'lucide-react';

// LAS MIGAS (§ EDITOR-TIENDA-SHELL-1, REDISENO.md § 3): «‹ volver» que nombra el nivel de ARRIBA, no
// un breadcrumb genérico con toda la cadena — hoy sólo hay DOS niveles reales bajo «Secciones»
// (Inicio → sección; «elemento» es EDITOR-TIENDA-ZONAS-1, slice 5, todavía sin construir), así que lo
// único que hace falta nombrar es el nivel inmediatamente anterior. Cuando el nivel «elemento» exista,
// este mismo componente sirve sin cambios: `nivelAnterior` pasa a ser el título de la SECCIÓN en vez
// de «Inicio».
//
// Sólo se renderiza cuando HAY un nivel de arriba (`TiendaPaginas.tsx` no lo monta en Inicio) — un
// «‹ volver» sin a dónde volver sería un botón muerto.
export function Migas({ nivelAnterior, actual, onVolver }: { nivelAnterior: string; actual: string; onVolver: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', flexShrink: 0, marginBottom: 'var(--duna-space-3)' }}>
      <button type="button" onClick={onVolver} className="duna-btn duna-btn--ghost duna-btn--sm" style={{ flexShrink: 0 }}>
        <ChevronLeft aria-hidden /> {nivelAnterior}
      </button>
      <span className="duna-caption" aria-hidden style={{ margin: 0 }}>›</span>
      <span className="duna-caption" style={{ margin: 0, fontWeight: 600, color: 'var(--duna-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {actual}
      </span>
    </div>
  );
}

export default Migas;
