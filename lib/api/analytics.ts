import type { AnalyticsData, WeeklyActivityData } from '@/types/analytics';
import { PERIODO_DEFAULT, type PeriodoKey } from '@/lib/metrics/periodo';

// El `periodo` gobierna SOLO el bloque de Rentabilidad; el server valida la key y
// cae al default si no la reconoce (ver lib/metrics/periodo.ts).
//
// Opcional porque el DASHBOARD también llama este endpoint, y lo único que lee de
// él es la recurrencia — un número acumulado, ajeno al período. El default de acá
// es el mismo del server, así que omitirlo no puede pedir una cosa y recibir otra.
//
// TODO: ese llamado del dashboard calcula rentabilidad, cartera y trayectoria
// para leer un solo porcentaje. Es la misma ineficiencia anotada en el endpoint de
// stats (calcula todas las métricas aunque el usuario muestre pocas tarjetas) y se
// resuelve igual: cálculo selectivo. No es una regresión de esta tanda — el
// endpoint viejo hacía lo mismo.
export async function getAnalytics(periodo: PeriodoKey = PERIODO_DEFAULT): Promise<AnalyticsData> {
  const res = await fetch(`/api/analytics?periodo=${encodeURIComponent(periodo)}`);
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
