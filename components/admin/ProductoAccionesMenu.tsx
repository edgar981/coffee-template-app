'use client';

import { MoreVertical, Pencil, PackagePlus, RotateCcw, Trash2 } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { accionEstadoProducto } from '@duna/core/product-form';
import type { Product } from '@/types/product';

// ─── EL MENÚ DE TRES PUNTOS DE UN PRODUCTO ───────────────────────────────────
//
// Un ÚNICO menú para las dos superficies (la tarjeta de la cuadrícula y la fila
// de la lista), montado sobre `DropdownMenu` de shadcn — opción C: la CONDUCTA
// (foco atrapado, Escape, click-fuera) la trae shadcn, como ya hacen `TopBar` y
// `UserMenu`; el design-system no gana una pieza con comportamiento.
//
// ── ES UN PUNTO DE ENTRADA, NO UNA SEGUNDA PUERTA (decisión del owner) ──────
//
// Cada ítem dispara el MISMO handler que ya existe en la página —los mismos
// diálogos—: no hay una acción nueva, sólo una forma de alcanzarla desde la
// tarjeta sin abrir el detalle. En particular NO hay un "Desactivar" directo:
// desactivar sigue viviendo como el secundario del diálogo de Eliminar
// (`alternativaAlEliminar`), para que el trato de `activo` no tenga dos puertas
// con dos decisiones de confirmación — que es justo lo que la derivación previene.
//
// ── EL CONTENIDO STATE-AWARE SALE DE `accionEstadoProducto` ─────────────────
//
// "Activar" aparece sólo si el producto está inactivo, y esa condición NO se
// escribe acá: se deriva de la MISMA función que decide el verbo del badge, así
// que la tarjeta y el badge no pueden discrepar sobre si un producto se activa o
// se desactiva. `accionEstadoProducto(p).activo === true` significa "la acción de
// estado disponible es ACTIVAR", o sea que hoy está inactivo.

export function ProductoAccionesMenu({ producto, onEditar, onAjustar, onEliminar, onActivar }: {
  producto: Product;
  onEditar: () => void;
  onAjustar: () => void;
  onEliminar: () => void;
  onActivar: () => void;
}) {
  const puedeActivar = accionEstadoProducto(producto)?.activo === true;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="duna-btn duna-btn--ghost duna-btn--icon"
          aria-label={`Acciones de ${producto.nombre}`}
        >
          <MoreVertical />
        </button>
      </DropdownMenuTrigger>
      {/* `align="end"`: el menú se ancla al borde derecho del disparador, que es
          donde vive en la fila y en la esquina de la tarjeta. */}
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEditar} className="cursor-pointer">
          <Pencil className="mr-2 h-4 w-4 text-muted-foreground" /> Editar
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onAjustar} className="cursor-pointer">
          <PackagePlus className="mr-2 h-4 w-4 text-muted-foreground" /> Ajustar stock
        </DropdownMenuItem>
        {puedeActivar && (
          <DropdownMenuItem onSelect={onActivar} className="cursor-pointer">
            <RotateCcw className="mr-2 h-4 w-4 text-muted-foreground" /> Activar
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {/* Eliminar abre el diálogo que YA ofrece Desactivar como secundario (para
            un producto activo). Mismo tratamiento destructivo que "Cerrar sesión"
            en UserMenu. */}
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
