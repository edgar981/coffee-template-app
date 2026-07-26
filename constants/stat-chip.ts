// ─── Stat-card icon chip palette ─────────────────────────────────────────────
// THE single source for stat-card icon-chip colours. Decision (2026-07-26): one
// warm family (Amber Minimal) instead of the old pastel-multicolor set — el color
// es información, no decoración. `alert` (soft red) is the ONLY exception, reserved
// for REAL alert states (e.g. Alertas de Stock). To revert to pastels or retune,
// change ONLY this map — every chip (dashboard registry + per-page stat cards)
// reads it. Muted tints + warm/red text pass AA in light and dark.

export const STAT_CHIP = {
  /** Default: warm sand tint + dark amber icon. */
  warm:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  /** Reserved for real alerts (low stock, etc.) — red stays scarce. */
  alert: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
} as const;

export type StatChip = keyof typeof STAT_CHIP;
