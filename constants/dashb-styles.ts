// Chart ramp — Duna amber scale (--chart-1..5, identical in light & dark).
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

export const ANALITICS_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--muted-foreground))',
];

export const tooltipStyle = {
  background:   'hsl(var(--card))',
  border:       '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize:     12,
};

export const axisTickStyle = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };
