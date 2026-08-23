// ─── Stat-card icon chip palette ─────────────────────────────────────────────
// Los tonos de los icon-chips de las stat cards. El color es ESTADO, no decoración
// (§ CLAUDE.md — design system del admin): `chipTono(widget, valor)` devuelve NEUTRO
// por defecto, ÁMBAR para colas de trabajo con valor > 0, y el ROJO reservado a
// alertas reales (Alertas de Stock). Son los tres únicos tonos alcanzables.
//
// LA RAMPA PASTEL MULTICOLOR SE RETIRÓ (2026-08-22). La decisión de 2026-07-27
// (un tono por tarjeta) ya había sido reemplazada por la regla de estado en el
// dashboard; sus últimas seis entradas (emerald/sky/blue/orange/violet/pink) quedaron
// sin un solo consumidor —Clientes y CustomerProfile ya no las tocan, y la campana
// migró a `--duna-sol-*`— así que se borran. Quedan los tres que `chipTono` usa.

export const STAT_CHIP = {
  /** Cola de trabajo con valor > 0 (Por cobrar, Órdenes pendientes). */
  amber:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  /** Estado NEUTRO — el default de los tiles del dashboard: sin estado, sin color. */
  neutral: 'bg-muted text-muted-foreground',
  /** Reserved for real alerts (low stock, etc.) — red stays scarce. */
  alert:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
} as const;

export type StatChip = keyof typeof STAT_CHIP;
