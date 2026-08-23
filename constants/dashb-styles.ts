// Estilos de recharts compartidos por lo que queda de gráficos en el panel.
//
// DASHBOARD_COLORS SE RETIRÓ (2026-08-22) con el carrusel y la distribución del
// Dashboard: era la rampa `--chart-1..5`, y esos eran sus únicos consumidores. La
// rampa `--chart-*` se retiró entera de globals.css en la misma tanda (§ Backlog
// #8, cerrado por retiro, no por migración). ANALITICS_COLORS ya se había retirado
// antes (2026-08-20), migrada a `--duna-serie-*`.
//
// Lo que SOBREVIVE lo usa SÓLO Analítica (`app/(admin)/admin/analitica/page.tsx`,
// tooltips y ticks de sus dos gráficas). Este archivo quedó, por tanto, con nombre
// de Dashboard y consumidor de Analítica — candidato a mudarse allá; anotado, sin
// hacerse en esta tanda.

export const tooltipStyle = {
  background:   'hsl(var(--card))',
  border:       '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize:     12,
};

export const axisTickStyle = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };
