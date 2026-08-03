// ─── Chips de filtro del admin ───────────────────────────────────────────────
// LA fuente de los chips que aplican un filtro a la lista de abajo (Órdenes,
// Entregas). Vive acá y no por página porque "este filtro está aplicado" tiene
// que verse igual en todo el panel — y porque la stat card de la misma vista ya
// marca ese mismo estado (`statCardLink` en components/admin/StatCard.tsx): dos
// controles del MISMO filtro no pueden anunciarlo de dos maneras distintas.
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

/**
 * Chip que YA tiene identidad semántica propia (hoy solo "Por cobrar": ámbar =
 * espera, el mismo tono del mapa de StatusBadge). Conserva su tinte muted en los
 * dos estados y lo único que cambia al aplicarlo es el borde — "seleccionado"
 * debe significar lo mismo en todos los chips, sea cual sea su color de fondo.
 *
 * @param tono clases de fondo/texto/hover propias del chip.
 */
export function filterChipTono(activo: boolean, tono: string): string {
  return `${BASE} ${tono} ${activo ? 'border-primary' : 'border-transparent'}`;
}

/**
 * Contador embebido en un chip. Neutro SIEMPRE: sin relleno sólido detrás, un
 * badge que cambiaba de color con el estado ya no aporta nada — el borde del
 * chip es el que dice si está aplicado.
 */
export const FILTER_CHIP_COUNT = 'rounded-full bg-background px-1.5 py-0.5 text-xs';
