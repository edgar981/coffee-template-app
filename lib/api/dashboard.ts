import type { DashboardStats } from '@/types/dashboard';

export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await fetch('/api/dashboard/stats');
  if (!res.ok) throw new Error('Error al cargar estadísticas del panel');
  return res.json();
}
