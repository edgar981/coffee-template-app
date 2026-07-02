import type { AnalyticsData } from '@/types/analytics';

export async function getAnalytics(): Promise<AnalyticsData> {
  const res = await fetch('/api/analytics');
  if (!res.ok) throw new Error('Error al cargar analítica');
  return res.json();
}