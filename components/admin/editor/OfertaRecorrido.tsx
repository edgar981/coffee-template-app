'use client';

// LA OFERTA del recorrido (§ EDITOR-AYUDA-RECORRIDO-1, el spec: "¿Ves un recorrido de un minuto?
// Ver / Ahora no"). Se muestra SOLO la primera vez que una cuenta abre el editor —la marca de
// "visto" la pone `EditorTiendaPantallaCompleta.tsx` apenas la ofrece, no cuando se elige un botón:
// una vez ofrecida, no vuelve a aparecer, elija lo que elija el dueño—. Flotante, abajo a la
// derecha, para no competir con la barra superior ni con el riel.
export interface OfertaRecorridoProps {
  onVer: () => void;
  onCerrar: () => void;
}

export function OfertaRecorrido({ onVer, onCerrar }: OfertaRecorridoProps) {
  return (
    <div className="editor-tour-oferta" role="status">
      <p className="duna-sub" style={{ margin: 0 }}>¿Ves un recorrido de un minuto?</p>
      <div style={{ display: 'flex', gap: 'var(--duna-space-2)', flexShrink: 0 }}>
        <button type="button" className="duna-btn duna-btn--ghost duna-btn--sm" onClick={onCerrar}>
          Ahora no
        </button>
        <button type="button" className="duna-btn duna-btn--primary duna-btn--sm" onClick={onVer}>
          Ver
        </button>
      </div>
    </div>
  );
}

export default OfertaRecorrido;
