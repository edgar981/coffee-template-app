'use client';

import { ChevronLeft, HelpCircle } from 'lucide-react';

// LAS MIGAS (§ EDITOR-TIENDA-SHELL-1, REDISENO.md § 3): «‹ volver» que nombra el nivel de ARRIBA, no
// un breadcrumb genérico con toda la cadena. `TiendaPaginas.tsx` la monta para «‹ Inicio» (Inicio →
// sección) y «‹ Ayuda» (§ EDITOR-AYUDA-1, Ayuda → una guía abierta); desde § EDITOR-VISUAL-NIVELES-1,
// `TiendaSeccionEditor.tsx` monta una SEGUNDA instancia, LOCAL al hero, para «‹ Hero» (Hero →
// Titular/Subtítulo/Botones/Indicador) — EXACTAMENTE el uso que este componente ya preveía ("cuando
// el nivel «elemento» exista, este mismo componente sirve sin cambios"): sólo cambia
// `nivelAnterior`, nunca el componente.
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
//
// § EDITOR-AYUDA-1 — `onAyuda` OPCIONAL agrega el «?» de ese nivel (el spec: "cada nivel del panel…
// muestra un «?» que abre la guía de ese tema"), alineado al otro extremo de la fila. Esta migaja no
// sabe de temas ni de `TemaAyudaId` — el llamador ya cerró ese valor en el closure que pasa; acá sólo
// hay un botón más, igual que el «‹ volver». Ausente en la propia Ayuda (su «‹ Ayuda» no necesita
// ayuda de sí misma).
export function Migas({ nivelAnterior, onVolver, onAyuda }: { nivelAnterior: string; actual: string; onVolver: () => void; onAyuda?: () => void }) {
  return (
    <div style={{ flexShrink: 0, marginBottom: 'var(--duna-space-1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--duna-space-2)' }}>
      <button type="button" onClick={onVolver} className="editor-pv-back">
        <ChevronLeft aria-hidden /> {nivelAnterior}
      </button>
      {onAyuda && (
        <button type="button" onClick={onAyuda} className="duna-btn duna-btn--ghost duna-btn--icon" aria-label="Ayuda de esta sección" title="Ayuda de esta sección">
          <HelpCircle aria-hidden />
        </button>
      )}
    </div>
  );
}

export default Migas;
