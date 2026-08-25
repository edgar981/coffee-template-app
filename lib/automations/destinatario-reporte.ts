import { AUTOMATION_MAP } from '@/constants/automations';
import { parseRecipients } from './channels/email';

/**
 * ¿Este reporte al EQUIPO por correo quedaría SIN destinatario efectivo con esta config?
 *
 * "Efectivo" = lo MISMO que usa el dispatch: `parseRecipients` (config `destinatarios`, o
 * el correo del negocio como fallback). Reusar esa función es el punto — el guard del
 * PATCH y el envío no pueden discrepar sobre qué cuenta como destinatario.
 *
 * Sólo aplica a `canal:'email' + audiencia:'equipo'`: son los únicos con caída SILENCIOSA
 * a OMITIDO por falta de buzón. Para todo lo demás devuelve `false` (no aplica el guard).
 */
export async function reporteSinDestinatario(
  key: string,
  config: Record<string, unknown> | null | undefined,
): Promise<boolean> {
  const def = AUTOMATION_MAP[key];
  if (!def || def.canal !== 'email' || def.audiencia !== 'equipo') return false;
  const cfg = (config ?? {}) as Record<string, unknown>;
  const to = await parseRecipients(cfg.destinatarios);
  return to.length === 0;
}
