'use client';

import { toast } from 'sonner';

// ─── «AVISAR POR WHATSAPP» junto al aviso de éxito ───────────────────────────
//
// Cuando el operador marca un pedido como pagado, en camino o entregado, el
// panel ya muestra su propio aviso de éxito ("Pago registrado…", "Estado
// actualizado") desde el componente que hizo la mutación — ninguno de esos
// vive en `touches:` de este slice (RegisterPaymentModal.tsx,
// useTransicionEntrega.ts), así que esta función no reemplaza esos avisos: los
// ACOMPAÑA con un segundo aviso, propio, que ofrece abrir WhatsApp con el
// mensaje YA armado para ese momento (`lib/admin/mensajes-whatsapp.ts`).
//
// No manda nada por su cuenta. Sin un teléfono válido (`href` null, porque
// `customerWhatsappHref` no reconoció un celular colombiano) no se ofrece
// nada — un botón que no puede hacer nada es peor que no tener botón.
export function avisarWhatsapp(href: string | null): void {
  if (!href) return;
  toast('Avisar por WhatsApp', {
    description: 'El mensaje ya quedó armado para este momento del pedido.',
    action: {
      label: 'Abrir WhatsApp',
      onClick: () => window.open(href, '_blank', 'noopener,noreferrer'),
    },
  });
}
