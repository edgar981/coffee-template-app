// ─── Stat-card icon chip palette ─────────────────────────────────────────────
// Queda UN solo tono: NEUTRO. Es el chip en reposo que el CUSTOMIZER (el picker de
// Personalizar) pinta junto al ícono de cada widget — ahí no hay datos en vivo, así
// que el estado no aplica y el chip siempre va neutro.
//
// `amber` y `alert` SE RETIRARON (con la forma editorial del Dashboard): su único
// consumidor era `chipTono`, que coloreaba el chip de ícono de la stat card según el
// valor. Los indicadores dejaron de ser stat cards con chip —la PLECA de la tira
// editorial es ahora quien lleva el estado (ámbar/rojo), vía `estadoTile`— así que el
// chip de estado desapareció y con él sus dos tonos. El estado ya no vive en una clase
// de fondo/texto sino en `WidgetDef.tono` (§ constants/dashboard-widgets.ts).
//
// LA RAMPA PASTEL MULTICOLOR ya se había retirado antes (2026-08-22, sus seis entradas
// sin consumidor). Este retiro es el de los dos que quedaban de estado.

export const STAT_CHIP = {
  /** Estado NEUTRO — el único que queda: sin estado, sin color. Lo usa el customizer. */
  neutral: 'bg-muted text-muted-foreground',
} as const;

export type StatChip = keyof typeof STAT_CHIP;
