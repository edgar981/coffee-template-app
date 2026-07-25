import type { AnalyticsData, WeeklyActivityData } from '@/types/analytics';

export async function getAnalytics(): Promise<AnalyticsData> {
  const res = await fetch('/api/analytics');
  if (!res.ok) throw new Error('Error al cargar analítica');
  return res.json();
}

// One Monday–Sunday week for the Actividad Semanal card. `week` is any
// YYYY-MM-DD day key — the server snaps it to that week's Monday (Bogotá) and
// echoes the normalized key back for in-flight matching.
export async function getWeeklyActivity(week: string): Promise<WeeklyActivityData> {
  const res = await fetch(`/api/analytics/weekly?week=${encodeURIComponent(week)}`);
  if (!res.ok) throw new Error('Error al cargar la actividad semanal');
  return res.json();
}