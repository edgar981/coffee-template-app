"use client";
import type { ReactNode } from 'react';

import {
  AlertDialog, AlertDialogPortal, AlertDialogScrim, AlertDialogSurface,
  AlertDialogTitle, AlertDialogDescription,
} from '@/components/ui/alert-dialog';
import { useContenedorDunaPortal } from '@/components/admin/dunaPortal';

// ═══ LA SUPERFICIE CENTRADA DE DUNA · las confirmaciones ════════════════════
//
// Hermana de `DunaSheet` y con el mismo reparto: la FORMA la pone el
// design-system (`.duna-dialog`, `.duna-scrim`, la cabecera y el pie
// compartidos), la CONDUCTA la pone Radix.
//
// ── POR QUÉ SE MONTA SOBRE `AlertDialog` Y NO SOBRE `Dialog` ────────────────
//
// Porque la superficie centrada tiene UN solo caso en este panel —la
// confirmación— y una confirmación es un `alertdialog`, no un diálogo cualquiera.
// Tres cosas vienen con esa elección y ninguna es cosmética:
//
//   · `role="alertdialog"`, que le dice al lector de pantalla que esto interrumpe
//     y espera una respuesta, no que es un panel más;
//   · tocar fuera NO descarta. Una confirmación que se va con un toque al margen
//     es exactamente el gesto accidental del que la confirmación protege;
//   · el foco arranca en el botón de cancelar, no en el destructivo.
//
// Si algún día hace falta una superficie centrada que NO sea una confirmación,
// eso es una decisión aparte y otra costura — no un prop de ésta. Mezclar las dos
// haría que la diferencia de conducta dependiera de recordar una bandera.
//
// ── LO QUE ESTA COSTURA NO TRAE, dicho para que nadie lo suponga ────────────
//
// NO bloquea nada mientras la mutación viaja. La maqueta dibuja un `is-saving`
// que apaga el modal entero, y eso es sólo la mitad VISIBLE de la guarda de
// doble-submit: la que corta la re-entrada del mismo tick es el ref síncrono de
// `useAccionGuardada` (§ CLAUDE.md — Doble-submit). Una superficie que bloquee y
// haga creer que la guarda ya está puesta reabriría el agujero que ese hook
// cerró, y ese agujero costó un doble-submit con 2,5 s entre clicks.
//
// El bloqueo mientras carga lo sigue poniendo el flujo, que es quien sabe si su
// mutación está en vuelo.

export function DunaDialog({
  abierto, onOpenChange, titulo, descripcion, alCerrarConEscape, children,
}: {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  /** Va VISIBLE en la cabecera: en una confirmación el título ES la pregunta, y
   *  esconderlo dejaría al diálogo sin decir qué se está por hacer. */
  titulo: ReactNode;
  /** La consecuencia, también visible. Es lo que convierte "¿seguro?" en una
   *  decisión informada. */
  descripcion: ReactNode;
  /** Se llama cuando Radix quiere cerrar por Escape. El flujo puede impedirlo
   *  —mientras su mutación viaja, por ejemplo— llamando a `preventDefault`. */
  alCerrarConEscape?: (e: KeyboardEvent) => void;
  /** El PIE, y lo que el flujo quiera meter entre la cabecera y él. */
  children: ReactNode;
}) {
  const contenedor = useContenedorDunaPortal();

  return (
    <AlertDialog open={abierto} onOpenChange={onOpenChange}>
      <AlertDialogPortal container={contenedor}>
        <AlertDialogScrim className="duna-scrim" />
        {/* El envoltorio CENTRA y da el respiro de los bordes; la superficie es
            la caja. Son dos porque el envoltorio no puede recibir el click-fuera
            —lo recibe el velo— y por eso va con `pointer-events: none` desde el
            sistema. `duna` acá y no más adentro: esto vive en un portal, fuera
            del `.duna` de la pantalla. */}
        <div className="duna duna-dialog-wrap">
          <AlertDialogSurface className="duna-dialog" onEscapeKeyDown={alCerrarConEscape}>
            <div className="duna-modal__head">
              <AlertDialogTitle className="duna-title">{titulo}</AlertDialogTitle>
              {/* `asChild` no: la descripción de Radix emite un `<p>` y acá el
                  consumidor a veces manda varios bloques. El margen lo pone la
                  clase, no un salto de línea. */}
              <AlertDialogDescription className="duna-sub" style={{ margin: 'var(--duna-space-2) 0 0' }}>
                {descripcion}
              </AlertDialogDescription>
            </div>
            {children}
          </AlertDialogSurface>
        </div>
      </AlertDialogPortal>
    </AlertDialog>
  );
}
