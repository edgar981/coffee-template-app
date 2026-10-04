'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';

// EL SEPARADOR "+ Agregar sección" ENTRE TARJETAS (§ EDITOR-AGREGAR-SECCION-1, el spec: "y entre
// tarjetas al pasar el mouse, como Shopify"). Va UNA vez antes de cada tarjeta de la lista y una
// última vez al final — cada instancia sabe DESPUÉS de qué posición insertar (`onClick` ya lo trae
// cerrado por el llamador), así que este componente no necesita saber nada de `orden`.
//
// SIN CSS NUEVO: `duna.css` no está en `touches:` de este slice, así que el hover/foco se resuelve
// con ESTADO DE REACT (`onMouseEnter`/`onFocus`) en vez de una regla `:hover` — mismo resultado
// visual, sin tocar un archivo fuera de alcance. El botón SIGUE en el orden de tabulación siempre
// (nunca `tabIndex={-1}`): "con foco" tiene que poder alcanzarlo desde el teclado aunque el mouse
// nunca haya pasado por ahí.
//
// § EDITOR-VISUAL-PANEL-1 — el alto bajó de 28 a 10: entre las FILAS compactas del prototipo
// (38px, `.editor-row`) un separador de 28px se leía como un hueco, no como una costura — el mismo
// ritmo apretado que el prototipo usa entre sus `.row` (`gap:1px`). La afordancia (línea + botón al
// pasar el mouse) no cambió, sólo el espacio que ocupa en reposo.
export function SeparadorAgregar({ onClick, etiqueta = 'Agregar sección' }: {
  onClick: () => void;
  etiqueta?: string;
}) {
  const [activo, setActivo] = useState(false);

  return (
    <div
      style={{ position: 'relative', height: 10, display: 'flex', alignItems: 'center' }}
      onMouseEnter={() => setActivo(true)}
      onMouseLeave={() => setActivo(false)}
    >
      <div style={{ flex: 1, height: 1, background: activo ? 'var(--duna-border)' : 'transparent', transition: 'background 120ms ease' }} />
      <button
        type="button"
        onClick={onClick}
        onFocus={() => setActivo(true)}
        onBlur={() => setActivo(false)}
        className="duna-btn duna-btn--secondary duna-btn--sm"
        style={{
          position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
          opacity: activo ? 1 : 0, transition: 'opacity 120ms ease',
        }}
        aria-label={etiqueta}
      >
        <Plus /> {etiqueta}
      </button>
    </div>
  );
}

export default SeparadorAgregar;
