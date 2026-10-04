'use client';

import { MoreVertical, Copy, Trash2 } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

// EL MENÚ "⋯" de una sección agregada (§ EDITOR-AGREGAR-SECCION-1, el spec: "un menú con Duplicar y
// Eliminar"). Mismo patrón que `ProductoAccionesMenu.tsx` — `DropdownMenu` de shadcn (opción C: la
// conducta la trae shadcn, el design-system no gana una pieza con comportamiento), un punto de
// entrada a acciones que YA existen en el padre, no una segunda puerta. "Eliminar" no borra desde
// acá: abre el `ConfirmDeleteDialog` de siempre (dueño de la confirmación), igual que la papelera de
// un repeater (§ CLAUDE.md, "Borrar CONFIRMA, en la PLATAFORMA").
export function InstanciaAccionesMenu({ nombre, onDuplicar, onEliminar }: {
  /** El nombre de la sección, para el `aria-label` del disparador — nunca genérico. */
  nombre: string;
  onDuplicar: () => void;
  onEliminar: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="duna-btn duna-btn--ghost duna-btn--icon"
          aria-label={`Más acciones para ${nombre}`}
        >
          <MoreVertical />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onDuplicar} className="cursor-pointer">
          <Copy className="mr-2 h-4 w-4 text-muted-foreground" /> Duplicar
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={onEliminar}
          className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" /> Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default InstanciaAccionesMenu;
