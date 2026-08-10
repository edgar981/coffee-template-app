import type { AutomationRunEstado } from '@duna/core';
import type { RenderedEmail } from '@duna/core/notifications/templates/shared';

// EL contrato entre el motor y los canales. El motor no sabe si un canal manda
// correos, escribe en la campana o loguea a la espera de credenciales: arma un
// DispatchRequest y recibe un DispatchResult que se convierte en el AutomationRun.

export type DispatchRequest =
  // Campana del admin (tabla Notification). `tipo` alimenta el ícono del bell.
  | { canal: 'interno'; tipo: string; titulo: string; mensaje: string; href?: string }
  // Correo. `audiencia` DECIDE LA IDENTIDAD del remitente — no es metadata suelta.
  | { canal: 'email'; audiencia: 'cliente' | 'equipo'; to: string[]; email: RenderedEmail }
  // WhatsApp en gramática Meta: plantilla + variables posicionales, nunca texto libre.
  | { canal: 'whatsapp'; to: string; templateKey: string; variables: string[] };

export interface DispatchResult {
  estado: AutomationRunEstado;
  /**
   * Lo que se envió (o se habría enviado), tal como quedó renderizado. Es la
   * evidencia que hace revisable un run PENDIENTE_CANAL: el día que Meta esté
   * conectado, el mensaje real se compara contra esto.
   */
  payload: Record<string, unknown>;
}
