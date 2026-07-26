import { sanitizeWidgetKeys } from '@/constants/dashboard-widgets';

// Data-access for the per-admin dashboard layout. The server owns validation; the
// client re-sanitizes defensively so a bad response can never render junk.

export async function getDashboardPrefs(): Promise<string[]> {
  const res = await fetch('/api/dashboard/prefs');
  if (!res.ok) throw new Error('Error al cargar la configuración del panel');
  const data = await res.json();
  return sanitizeWidgetKeys(data?.widgets);
}

export async function saveDashboardPrefs(widgets: string[]): Promise<string[]> {
  const res = await fetch('/api/dashboard/prefs', {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ widgets }),
  });
  if (!res.ok) throw new Error('No se pudo guardar la configuración del panel');
  const data = await res.json();
  return sanitizeWidgetKeys(data?.widgets);
}
