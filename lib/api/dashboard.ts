import type { ChartRange, DashboardChartData, DashboardStats } from '@/types/dashboard';

export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await fetch('/api/dashboard/stats');
  if (!res.ok) throw new Error('Error al cargar estadísticas del panel');
  return res.json();
}

// Daily series for the dashboard chart module. One call returns BOTH charts
// (Ventas + Pedidos) for the range, so flipping between them is instant and the
// selected range is fetched once. `range` is re-validated server-side.
export async function getDashboardChart(range: ChartRange): Promise<DashboardChartData> {
  const res = await fetch(`/api/dashboard/chart?range=${range}`);
  if (!res.ok) throw new Error('Error al cargar el gráfico del panel');
  return res.json();
}
