import prisma from '@/lib/prisma';
import { sendWhatsApp } from '@/lib/whatsapp';
import type { Order } from '@/types/order';

const MESSAGES: Record<string, (order: Order) => string> = {
  nueva_orden: (o) =>
    `¡Hola ${o.cliente_nombre}! 🎉 Tu orden *${o.numero_orden}* ha sido confirmada. En breve comenzaremos a prepararla. ¡Gracias por tu pedido!`,

  orden_entregada: (o) =>
    `¡Hola ${o.cliente_nombre}! ✅ Tu orden *${o.numero_orden}* ha sido entregada. Esperamos que disfrutes tu café. ¡Gracias por elegirnos!`,

  recordatorio_pago: (o) =>
    `Hola ${o.cliente_nombre}, te recordamos que tu orden *${o.numero_orden}* por *${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(o.total)}* tiene un pago pendiente. ¿Necesitas ayuda?`,
};

export async function fireOrderTrigger(
  tipo: string,
  order: Order
): Promise<void> {
  // Check if this automation is active
  const automation = await prisma.automation.findUnique({ where: { tipo } });
  if (!automation?.activa) return;

  // Need a phone number to send to
  if (!order.cliente_telefono) return;

  const getMessage = MESSAGES[tipo];
  if (!getMessage) return;

  try {
    await sendWhatsApp(order.cliente_telefono, getMessage(order));

    // Record execution
    await prisma.automation.update({
      where: { tipo },
      data:  {
        veces_ejecutada:  { increment: 1 },
        ultima_ejecucion: new Date(),
      },
    });
  } catch (err) {
    // Log but don't throw — automation failure shouldn't break the order flow
    console.error(`Automation ${tipo} failed:`, err);
  }
}