// ─── Chips de filtro del admin ───────────────────────────────────────────────
// LA fuente de los chips que aplican un filtro a la lista de abajo (Órdenes,
// Entregas). Vive acá y no por página porque "este filtro está aplicado" tiene
// que verse igual en todo el panel: dos controles del MISMO filtro no pueden
// anunciarlo de dos maneras distintas.
//
// Amber Minimal: aplicado = BORDE de `--primary` sobre el fondo neutro que el
// chip ya tenía, nunca relleno. Antes el activo era `bg-primary
// text-primary-foreground` (y `bg-amber-500 text-white` en "Por cobrar"): un
// sólido ámbar por cada chip encendido, compitiendo con la acción primaria de la
// página, que es la única que tiene derecho al sólido.
//
// El borde existe en los DOS estados (transparente en reposo) para que activar
// un chip no mueva el layout de la fila.

const BASE =
  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Chip de filtro neutro — el caso normal. */
export function filterChip(activo: boolean): string {
  return `${BASE} ${
    activo
      ? 'border-primary bg-muted text-foreground'
      : 'border-transparent bg-muted text-muted-foreground hover:bg-muted/70'
  }`;
}
