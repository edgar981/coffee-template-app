'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useAccionGuardada } from '@/hooks/useAccionGuardada';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

// Shared confirmation for ANY sensitive delete in the admin — the template that
// replaces native window.confirm(). Built on Radix AlertDialog (shadcn): themed
// (light + dark), focus-trapped, and — unlike confirm() — it NAMES the record and
// spells out the consequence. The REAL guard is always server-side; this is only
// the human gate.
//
// Radix AlertDialog behaviour we rely on (verified against v1.1.15):
//   • initial focus lands on Cancel (the safe action) automatically;
//   • Escape cancels; outside-click is inert BY DESIGN — it never confirms.
// The confirm/secondary buttons are plain Buttons (not AlertDialogAction, which
// force-closes on click) so they can run async work, stay open on failure, and
// show a loading state.

interface SecondaryAction {
  /** Verb for the non-destructive alternative, e.g. "Desactivar". */
  label: string;
  /** Runs the alternative. Throw with a message to keep the dialog open + toast it. */
  onAction: () => Promise<void>;
  /** Brief success toast when it resolves. */
  successMessage?: string;
}

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Dialog heading, e.g. "Eliminar cliente". */
  title: string;
  /** The specific thing being deleted — its NAME, never generic. */
  entityLabel: string;
  /** What is permanently lost; written per entity, never a generic. */
  consequence: string;
  /** Specific verb on the destructive button, e.g. "Eliminar cliente" — never "OK". */
  confirmLabel: string;
  /** Runs the delete. Throw with a message to keep the dialog open + toast it. */
  onConfirm: () => Promise<void>;
  /** Brief success toast shown when onConfirm resolves. */
  successMessage?: string;
  /**
   * Optional non-destructive alternative offered "en su lugar" (e.g. Desactivar a
   * product with sales history). Rendered as an outline button beside Cancel.
   */
  secondaryAction?: SecondaryAction;
  /**
   * Naturaleza de la acción confirmada. `'destructive'` (default) es la forma de
   * siempre: botón rojo sólido, "Eliminando…" mientras viaja.
   *
   * `'default'` lo vuelve una confirmación NO destructiva —ámbar, y el verbo del
   * propio `confirmLabel` como texto intermedio— para acciones sensibles que no
   * borran nada: hoy, activar un producto desde el badge "Inactivo". El diálogo
   * ya sabía hacer lo difícil (candado único, error del server a la vista, no se
   * cierra si falla); lo que hacía falta era no pintar de rojo algo que no
   * destruye. Los demás call sites no pasan el prop y quedan idénticos.
   */
  confirmKind?: 'destructive' | 'default';
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  entityLabel,
  consequence,
  confirmLabel,
  onConfirm,
  successMessage,
  secondaryAction,
  confirmKind = 'destructive',
}: ConfirmDeleteDialogProps) {
  // El texto intermedio y el error de respaldo salen de la naturaleza de la
  // acción: "Eliminando…" sobre una activación sería una mentira en el momento
  // exacto en que el operador está mirando el botón para saber qué pasa.
  const destructiva = confirmKind === 'destructive';
  const busyLabel   = destructiva ? 'Eliminando…' : `${confirmLabel}…`;
  const errorLabel  = destructiva
    ? 'No se pudo completar la eliminación'
    : 'No se pudo completar la acción';
  // ONE lock for both buttons: while either action runs, both are disabled and the
  // dialog can't be dismissed (Escape / programmatic close are swallowed below).
  const [busy, setBusy] = useState<'confirm' | 'secondary' | null>(null);
  const loading = busy !== null;
  // `busy` ya deshabilitaba los dos botones, pero es estado: dos clicks en el
  // mismo tick lo leen `null` los dos. `guarda` agrega la mitad síncrona — la
  // única que cierra esa ventana. Ver CLAUDE.md § Doble-submit.
  const guarda = useAccionGuardada();

  const run = (
    which: 'confirm' | 'secondary',
    action: () => Promise<void>,
    okMessage: string | undefined,
    fallbackError: string,
  ) => guarda.ejecutar(async () => {
    setBusy(which);
    try {
      await action();
      // El toast va ANTES del cierre: así el operador lo ve aparecer con el
      // diálogo todavía en pantalla y la confirmación queda ligada a lo que
      // acaba de hacer. Al revés, el diálogo desaparecía y el toast llegaba
      // sobre una pantalla ya distinta.
      if (okMessage) toast.success(okMessage);
      onOpenChange(false);
    } catch (e) {
      // Surface the SERVER's message (e.g. the 409 reason) and keep the dialog
      // open so the operator can read it and retry or cancel.
      toast.error(e instanceof Error ? e.message : fallbackError);
    } finally {
      setBusy(null);
    }
  });

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!loading) onOpenChange(o); }}>
      <AlertDialogContent onEscapeKeyDown={(e) => { if (loading) e.preventDefault(); }}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{consequence}</AlertDialogDescription>
        </AlertDialogHeader>

        {/* The record being deleted, named explicitly — never a generic pronoun. */}
        <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm font-medium text-foreground break-words">
          {entityLabel}
        </p>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          {secondaryAction && (
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => run('secondary', secondaryAction.onAction, secondaryAction.successMessage, 'No se pudo completar la acción')}
            >
              {busy === 'secondary' ? `${secondaryAction.label}…` : secondaryAction.label}
            </Button>
          )}
          <Button
            variant={destructiva ? 'destructive' : 'default'}
            disabled={loading}
            onClick={() => run('confirm', onConfirm, successMessage, errorLabel)}
          >
            {busy === 'confirm' ? busyLabel : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
