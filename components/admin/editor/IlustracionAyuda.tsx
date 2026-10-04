'use client';

import { ChevronRight } from 'lucide-react';

// LA MINI ILUSTRACIÓN de un paso de guía (§ EDITOR-AYUDA-1, el spec: "los pasos pueden llevar una
// mini ilustración hecha con CSS/SVG en el estilo del prototipo — no capturas pesadas"). No es un
// diagrama por guía: es una cadena de etiquetas cortas (`PasoGuia.secuencia`, `lib/admin/
// ayuda-editor.ts`) conectadas por una flecha — la misma forma para "Editás → Se guarda solo →
// Publicás" que para "Tocás el texto → Escribís → Tocás afuera". CSS puro (chips + ícono), sin SVG
// propio: el repo ya tiene el glifo que hace falta (`ChevronRight`, de lucide-react).
export function IlustracionAyuda({ pasos }: { pasos: string[] }) {
  return (
    <div aria-hidden className="editor-ayuda-secuencia">
      {pasos.map((paso, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          <span className="editor-ayuda-chip">{paso}</span>
          {i < pasos.length - 1 && <ChevronRight width={12} height={12} style={{ color: 'var(--duna-faint)', flexShrink: 0 }} />}
        </span>
      ))}
    </div>
  );
}

export default IlustracionAyuda;
