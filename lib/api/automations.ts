// Data-access de la página de Automatizaciones. El servidor manda sobre qué keys
// existen y qué config es válida; esto sólo transporta.

// Espejo del enum de la base. `DUPLICADO` entra acá porque las supresiones por
// cooldown ahora dejan fila, así que pueden aparecer entre las "3 más recientes"
// de una card — antes el tipo del cliente no las contemplaba porque no existían.
import type { EstadoVida } from '@/lib/automations/historial';

export type AutomationRunEstado =
  'ENVIADO' | 'PENDIENTE_CANAL' | 'FALLIDO' | 'OMITIDO' | 'DUPLICADO';

export interface AutomationRunResumen {
  automationKey: string;
  estado:        AutomationRunEstado;
  targetId:      string;
  createdAt:     string;
}

export interface AutomationEstado {
  key:         string;
  activo:      boolean;
  config:      Record<string, unknown>;
  /** Total histórico de runs — la evidencia de que la automatización está viva. */
  ejecuciones: number;
  /** Las 3 más recientes, para el detalle de la card. */
  recientes:   AutomationRunResumen[];
  /** Señal de vida derivada server-side (§ estadoDeVida): viva/sin_casos/fallo/apagada. */
  vida:        EstadoVida;
  /** Último run que CUENTA (ENVIADO/FALLIDO), para el "hace X"; null si nunca corrió relevante. */
  ultima:      { estado: string; createdAt: string } | null;
}

export async function getAutomations(): Promise<AutomationEstado[]> {
  const res = await fetch('/api/automations');
  if (!res.ok) throw new Error('Error al cargar automatizaciones');
  return res.json();
}

export async function saveAutomation(
  key: string,
  patch: { activo?: boolean; config?: Record<string, unknown> },
): Promise<{ key: string; activo: boolean; config: Record<string, unknown> }> {
  const res = await fetch(`/api/automations/${encodeURIComponent(key)}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('No se pudo guardar la automatización');
  return res.json();
}

/** Una entrada del historial (§ lib/automations/historial). `cuando` llega como
 *  string ISO por JSON. */
export interface HistorialEntrada {
  cuando:         string;
  sobreQue:       string;
  href:           string | null;
  resultado:      'ok' | 'fallo';
  resultadoLabel: string;
}
export interface HistorialResp {
  entradas: HistorialEntrada[];
  /** Hay más de las que se muestran: la pantalla lo declara. */
  hayMas:   boolean;
}

/** Lo que UNA automatización hizo. Se pide sólo al abrir su acordeón, no en la
 *  carga de la página (por eso es endpoint aparte). */
export async function getAutomationHistory(key: string): Promise<HistorialResp> {
  const res = await fetch(`/api/automations/${encodeURIComponent(key)}/history`);
  if (!res.ok) throw new Error('No se pudo cargar el historial');
  return res.json();
}
