// Chart series colours — a warm, saturated amber→brown ramp (--chart-1..5), tuned per theme.
// CSS variables so charts follow the admin theme tokens; the SVG marks inherit
// them from the admin scope on <html>. The 6th slot stays neutral so charts
// with ≥6 series still render a distinct final segment.
export const DASHBOARD_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

// ANALITICS_COLORS SE RETIRÓ (2026-08-20). Era la rampa `--chart-*` de la página de
// Analítica, que migró a `--duna-serie-*` — el rol del DS para color categórico
// (§ CLAUDE.md — La serie categórica). Censo al retirarlo: su único consumidor era
// `app/(admin)/admin/analitica/page.tsx`, en las barras de Canales.
//
// `DASHBOARD_COLORS` de arriba SE QUEDA: lo usa `DashboardDistributionCard`, que es
// otra vertical y migra cuando migre el Dashboard.

export const tooltipStyle = {
  background:   'hsl(var(--card))',
  border:       '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize:     12,
};

export const axisTickStyle = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };
