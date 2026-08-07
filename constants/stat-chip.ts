// ─── Stat-card icon chip palette ─────────────────────────────────────────────
// THE single source for stat-card icon-chip colours. Decision (owner, confirmada
// 2026-07-27 tras evaluar la variante ámbar en preview): PASTEL MULTICOLOR — cada
// tarjeta lleva su tono. `alert` (rojo suave) queda reservado a alertas REALES
// (Alertas de Stock); el rojo no se usa como color decorativo.
//
// Colores exactos de la versión previa a la variante ámbar. Retunear/revertir =
// cambiar SOLO este mapa (y, si hace falta, qué key usa cada tarjeta). El resto
// de las reglas de restricción cromática (un sólido por vista, hover de tinte,
// badges muted/neutros, trends de texto) NO dependen de esta decisión y siguen.

export const STAT_CHIP = {
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  amber:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  sky:     'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  blue:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  orange:  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  violet:  'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  pink:    'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  /** Estado NEUTRO — el default de los tiles del dashboard: sin estado, sin color. */
  neutral: 'bg-muted text-muted-foreground',
  /** Reserved for real alerts (low stock, etc.) — red stays scarce. */
  alert:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
} as const;

export type StatChip = keyof typeof STAT_CHIP;
