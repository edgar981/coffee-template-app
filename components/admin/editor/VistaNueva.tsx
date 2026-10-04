'use client';

import type { ReactNode } from 'react';
import { DunaSheet } from '@/components/admin/DunaSheet';

// LA «VISTA NUEVA» (§ EDITOR-TIENDA-SHELL-1, REDISENO.md § 2 y § 3): una hoja que se abre SOBRE el
// lienzo para lo que no cabe en el panel de 308px — el panel nunca se ensancha. Monta `DunaSheet` con
// `anclaje="lado"`: por doctrina esa variante es `min(480px, calc(100% - 2.75rem))` de ancho, NUNCA
// el viewport completo (§ CLAUDE.md, "El `--lado` deja un carril de scrim"), que es exactamente «con
// espacio para comparar» — el lienzo sigue visible detrás, a la izquierda. No es una primitiva nueva:
// es la MISMA costura forma↔conducta que ya usan los cinco form-sheets del admin (Ajustar stock,
// Programar entrega, Nuevo pedido, Producto, Cliente).
//
// Este slice la deja lista y la usa para «Medios» (§ EditorTiendaPantallaCompleta.tsx): no existe hoy
// un «Agregar sección» (medido — censo por grep, cero resultados), así que el spec la ejercita con el
// segundo caso que ofrece.
export function VistaNueva({ abierto, onCerrar, titulo, descripcion, children }: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  descripcion: string;
  children: ReactNode;
}) {
  return (
    <DunaSheet abierto={abierto} onCerrar={onCerrar} titulo={titulo} descripcion={descripcion} anclaje="lado">
      {/* `.duna-modal__*`, no `.duna-sheet__*` — el nombre de clase que los otros cinco form-sheets del
          admin ya usan dentro de esta misma costura (`AdjustStockModal.tsx`, `CustomerFormModal.tsx`…). */}
      <div className="duna-modal__head">
        <div className="duna-title">{titulo}</div>
      </div>
      <div className="duna-modal__body">{children}</div>
    </DunaSheet>
  );
}

export default VistaNueva;
