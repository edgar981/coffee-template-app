'use client';

import { Pencil } from 'lucide-react';

// El encabezado de CADA bloque de Configuración: título + bajada a la izquierda, "Editar" a la
// derecha — sólo en lectura (al editar, el ancla es "Guardar cambios" dentro del form, mismo
// patrón que ya regía la sección única de `DatosNegocioSeccion`). Un solo componente para los
// cuatro bloques de SiteSetting + Equipo evita que el espaciado/alineación diverja entre ellos.

export function EncabezadoBloque({ titulo, descripcion, editando, onEditar, accionExtra, sinEditar }: {
  titulo:       string;
  descripcion:  string;
  editando:     boolean;
  onEditar:     () => void;
  /** Un botón adicional junto a (o en vez de) "Editar" — Equipo usa "Invitar" acá. */
  accionExtra?: React.ReactNode;
  /** Equipo no tiene lectura↔edición: es una lista de gestión en vivo, sin "Editar" de bloque.
   *  Sin esto, `editando` siempre `false` haría aparecer un botón "Editar" que no hace nada. */
  sinEditar?:   boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--duna-space-4)' }}>
      <div style={{ minWidth: 0 }}>
        <h2 className="duna-title">{titulo}</h2>
        <p className="duna-sub" style={{ marginTop: '3px', maxWidth: '42rem' }}>{descripcion}</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--duna-space-2)', flexShrink: 0 }}>
        {accionExtra}
        {!editando && !sinEditar && (
          <button type="button" onClick={onEditar} className="duna-btn duna-btn--secondary">
            <Pencil /> Editar
          </button>
        )}
      </div>
    </div>
  );
}
