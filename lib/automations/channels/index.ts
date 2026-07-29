import { dispatchInterno } from './interno';
import { dispatchEmail } from './email';
import { dispatchWhatsapp } from './whatsapp';
import type { DispatchRequest, DispatchResult } from './types';

export type { DispatchRequest, DispatchResult } from './types';

// EL router de canales: única puerta por la que sale un mensaje. Añadir un canal
// (SMS, push) es añadir una variante al DispatchRequest y un `case` aquí — el motor
// y los handlers no cambian.
export function dispatch(req: DispatchRequest): Promise<DispatchResult> {
  switch (req.canal) {
    case 'interno':  return dispatchInterno(req);
    case 'email':    return dispatchEmail(req);
    case 'whatsapp': return dispatchWhatsapp(req);
  }
}
