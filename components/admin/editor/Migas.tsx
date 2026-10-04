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
//
// § EDITOR-VISUAL-PANEL-1 — LA FORMA pasa a ser `.editor-pv-back` (prototipo `.pv-back`): SÓLO
// «‹ {nivelAnterior}», sin el segundo tramo "› {actual}" que esta miga mostraba antes. No es pérdida
// de información — el nivel actual ya lo dice el `<h2 class="duna-title">` que cada editor pinta
// debajo (TiendaSeccionEditor.tsx, EncabezadoSeccion.tsx…), así que el segundo tramo repetía el
// mismo texto dos veces en la misma pantalla. `actual` SIGUE siendo parte de la firma (se recibe,
// no se usa en el render) para no tocar los ~4 call sites que ya lo pasan.
export function Migas({ nivelAnterior, onVolver }: { nivelAnterior: string; actual: string; onVolver: () => void }) {
  return (
    <div style={{ flexShrink: 0, marginBottom: 'var(--duna-space-1)' }}>
      <button type="button" onClick={onVolver} className="editor-pv-back">
        <ChevronLeft aria-hidden /> {nivelAnterior}
      </button>
    </div>
  );
}

export default Migas;
