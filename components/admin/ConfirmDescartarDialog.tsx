'use client';

import { DunaDialog } from '@/components/admin/DunaDialog';

// La confirmación de descarte, sobre la superficie centrada de Duna (§ DunaDialog
// → AlertDialog): tocar fuera NO descarta y el foco arranca en la acción segura.
// Se apila SOBRE el drawer —dos superficies Duna, caso ya probado en H6— y
// portalea al mismo contenedor del shell.
//
// El botón "Descartar" NO va rojo: `--danger` está reservado a lo que destruye un
// registro del panel (§ ConfirmDeleteDialog), y descartar cambios sin guardar no
// toca nada persistido. Es una confirmación no-destructiva —como activar un
// producto o rechazar un comprobante— así que va con el primario. "Seguir
// editando" va primero en el DOM para que reciba el foco inicial: Enter conserva
// el trabajo, nunca lo tira.

export function ConfirmDescartarDialog({
  abierto, onDescartar, onSeguir,
  titulo = '¿Descartar los cambios?',
  descripcion = 'Lo que escribiste se perderá y no se puede recuperar.',
  confirmLabel = 'Descartar',
  seguirLabel = 'Seguir editando',
}: {
  abierto: boolean;
  /** Descartar los cambios y cerrar el drawer. */
  onDescartar: () => void;
  /** Seguir editando: cerrar sólo esta confirmación. */
  onSeguir: () => void;
  // Copy opcional: el default es el flujo edit-cancel; el descarte de un BORRADOR guardado
  // (§ /admin/tienda) pasa su propio texto —"volverás a lo publicado"— por otra semántica.
  titulo?: string;
  descripcion?: string;
  confirmLabel?: string;
  seguirLabel?: string;
}) {
  return (
    <DunaDialog
      abierto={abierto}
      // Cualquier cierre que no sea "Descartar" (Escape, o el velo — que en
      // AlertDialog no descarta de todos modos) es "seguir editando".
      onOpenChange={(o) => { if (!o) onSeguir(); }}
      titulo={titulo}
      descripcion={descripcion}
    >
      <div className="duna-modal__foot">
        <div className="duna-modal__acciones">
          <button type="button" className="duna-btn duna-btn--ghost" onClick={onSeguir}>
            {seguirLabel}
          </button>
          <button type="button" className="duna-btn duna-btn--primary" onClick={onDescartar}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </DunaDialog>
  );
}
