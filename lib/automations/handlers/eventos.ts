import prisma from '@duna/core';
import { formatCOP } from '@duna/core/utils';
import { toWhatsappNumber } from '@duna/core/whatsapp-link';
import { isLowStock } from '@duna/core/metrics/inventory-filters';
import { AUTOMATION_HREF, hrefOrden } from '@/constants/automations';
import { esOrigenNotificable } from '../reglas';
import type { EventHandler, Objetivo } from '../types';

// Handlers de EVENTO. Cada uno decide si el evento le concierne, resuelve el
// destinatario y arma el DispatchRequest. Nada de idempotencia ni de canales aquí:
// de eso se encarga el motor.
//
// Devolver `null` = "este evento no es mío". Devolver `{ omitir }` = "sí era mío,
// pero no había a quién avisar" — eso SÍ deja run, porque "esta orden no tenía
// teléfono" es información que el owner quiere poder ver.

/**
 * Primer nombre, en capitalización de saludo. Las plantillas Meta no admiten una
 * variable vacía, de ahí el respaldo.
 *
 * El title-case NO es cosmético: los nombres llegan como los tecleó quien tomó el
 * pedido ("lUIS", "MARIA"), y un WhatsApp que saluda "Hola lUIS" se lee como spam
 * automatizado — que es justo lo que Meta penaliza.
 */
export function nombreCorto(nombre: string | null | undefined): string {
  const primero = (nombre ?? '').trim().split(/\s+/)[0] ?? '';
  if (!primero) return 'hola';
  return primero.charAt(0).toUpperCase() + primero.slice(1).toLowerCase();
}

// ── 1. Notificación Nueva Orden — orden → pagado ─────────────────────────────
export const nuevaOrden: EventHandler = async (event): Promise<Objetivo | null> => {
  if (event.tipo !== 'order.pagado') return null;

  const order = await prisma.order.findUnique({
    where:  { id: event.orderId },
    select: { id: true, numero_orden: true, cliente_nombre: true, cliente_telefono: true, total: true },
  });
  if (!order) return null;

  // El teléfono se guarda ya normalizado (+57…), pero se revalida aquí: un dato
  // viejo o importado puede no serlo, y Meta rechaza un destinatario mal formado.
  const to = toWhatsappNumber(order.cliente_telefono);
  if (!to) return { targetId: order.id, omitir: 'la orden no tiene un celular colombiano válido' };

  return {
    targetId: order.id,
    dispatch: {
      canal:       'whatsapp',
      to:          `+${to}`,
      templateKey: 'nueva_orden',
      variables:   [nombreCorto(order.cliente_nombre), order.numero_orden, formatCOP(order.total)],
    },
  };
};

// ── 10. Orden nueva en la tienda — campana del operador ──────────────────────
// El filtro es el ORIGEN (qué code path la creó), NO `Order.canal`. `canal` es el
// canal de venta y el admin puede elegir `directo` en Nueva Orden — el mismo
// valor que escribe el checkout, así que filtrar por él notificaría las manuales.
// Ver `esOrigenNotificable` en ../reglas.
export const ordenRecibida: EventHandler = async (event): Promise<Objetivo | null> => {
  if (event.tipo !== 'order.creada') return null;
  if (!esOrigenNotificable(event.origen)) return null; // la tecleó el operador

  const order = await prisma.order.findUnique({
    where:  { id: event.orderId },
    select: { id: true, numero_orden: true, cliente_nombre: true, total: true },
  });
  if (!order) return null;

  return {
    targetId: order.id,
    dispatch: {
      canal:   'interno',
      tipo:    'orden_recibida',
      titulo:  'Orden nueva en la tienda',
      mensaje: `${nombreCorto(order.cliente_nombre)} hizo un pedido de ${formatCOP(order.total)} (${order.numero_orden}).`,
      href:    hrefOrden(order.numero_orden),
    },
  };
};

// ── 12. Entrega fallida — campana del operador ───────────────────────────────
// Colgada del ÚNICO borde (… → fallido), el mismo que restituye el stock. El
// target es el ENVÍO y no la orden: una entrega reprogramada que vuelve a fallar
// es un segundo hecho sobre el mismo envío, y el cooldown (no `una_vez`) es lo
// que deja pasar ese segundo aviso.
export const entregaFallida: EventHandler = async (event): Promise<Objetivo | null> => {
  if (event.tipo !== 'shipping.fallido') return null;

  const envio = await prisma.shipping.findUnique({
    where:  { id: event.shippingId },
    select: {
      id: true, mensajero: true, notas_entrega: true,
      order: { select: { numero_orden: true, cliente_nombre: true } },
    },
  });
  if (!envio) return null;

  const numero = envio.order?.numero_orden ?? '—';
  const quien  = envio.mensajero?.trim() ? ` · ${envio.mensajero.trim()}` : '';
  // La nota del mensajero es LA razón del fallo y lo único que permite decidir
  // sin abrir el tablero. Se recorta: la campana muestra dos líneas.
  const nota   = envio.notas_entrega?.trim();
  const motivo = nota ? ` — ${nota.length > 80 ? `${nota.slice(0, 79)}…` : nota}` : '';

  return {
    targetId: envio.id,
    dispatch: {
      canal:   'interno',
      tipo:    'entrega_fallida',
      titulo:  'Entrega fallida',
      mensaje: `La orden ${numero} volvió sin entregar${quien}${motivo}`,
      href:    AUTOMATION_HREF.entregas,
    },
  };
};

// ── 2. Alerta de Stock Bajo — cruce del mínimo ───────────────────────────────
// El CRUCE lo detecta quien mueve el stock (sólo él conoce el valor anterior); aquí
// sólo se re-verifica que siga bajo, por si el evento llegó tarde y ya se repuso.
export const stockBajo: EventHandler = async (event): Promise<Objetivo | null> => {
  if (event.tipo !== 'stock.cruzo_minimo') return null;

  const p = await prisma.product.findUnique({
    where:  { id: event.productoId },
    select: { id: true, nombre: true, stock: true, stock_minimo: true, activo: true },
  });
  if (!p) return null;
  if (!isLowStock(p)) return null; // ya se repuso entre el evento y esto — sin ruido

  return {
    targetId: p.id,
    dispatch: {
      canal:   'interno',
      tipo:    'stock_bajo',
      titulo:  'Stock bajo',
      mensaje: `${p.nombre} quedó en ${p.stock} unidades (mínimo: ${p.stock_minimo}).`,
      href:    AUTOMATION_HREF.stockBajo,
    },
  };
};

// ── 6. Confirmación de Entrega — shipping → entregado ────────────────────────
export const ordenEntregada: EventHandler = async (event): Promise<Objetivo | null> => {
  if (event.tipo !== 'shipping.entregado') return null;

  const order = await prisma.order.findUnique({
    where:  { id: event.orderId },
    select: { id: true, numero_orden: true, cliente_nombre: true, cliente_telefono: true },
  });
  if (!order) return null;

  const to = toWhatsappNumber(order.cliente_telefono);
  if (!to) return { targetId: order.id, omitir: 'la orden no tiene un celular colombiano válido' };

  return {
    targetId: order.id,
    dispatch: {
      canal:       'whatsapp',
      to:          `+${to}`,
      templateKey: 'orden_entregada',
      variables:   [nombreCorto(order.cliente_nombre), order.numero_orden],
    },
  };
};
