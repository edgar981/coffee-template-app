import { createNotification } from '@/lib/notifications';
import type { DispatchRequest, DispatchResult } from './types';

// Canal INTERNO: la campana del admin. Escribe una fila en `Notification`, que es
// lo que el bell ya lee (GET /api/notifications) — no se inventa un almacén nuevo.
// El polling en vivo, el toast y el sonido son la mitad cliente de este canal;
// viven en components/admin/NotificationBell.tsx.
//
// `tipo` es la key de la automatización: el bell la usa para elegir el ícono, y
// deja el historial filtrable por origen.
export async function dispatchInterno(
  req: Extract<DispatchRequest, { canal: 'interno' }>,
): Promise<DispatchResult> {
  await createNotification({
    tipo:    req.tipo,
    titulo:  req.titulo,
    mensaje: req.mensaje,
    href:    req.href,
  });

  return {
    estado:  'ENVIADO',
    payload: { canal: 'interno', titulo: req.titulo, mensaje: req.mensaje, href: req.href ?? null },
  };
}
