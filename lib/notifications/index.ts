import { loadOrderForNotification } from './data';
import { sendCustomerEmail } from './channels/email';
import { renderOrderCreated } from './templates/order-created';
import { renderOrderEnRoute } from './templates/order-en-route';
import type { Brand } from '@/lib/notifications/brand';

// Back-compat: the admin in-app bell notifications used to live in the old
// lib/notifications.ts (this folder replaced it). Re-exported so its importers
// (inventory routes) keep resolving `@/lib/notifications`.
export { createNotification } from './admin';

// ─── Customer notification EVENTS (not sends) ────────────────────────────────
// Each event loads the order via the data-access layer and dispatches it to every
// available channel. Today there is ONE channel — email. WhatsApp (Meta) arrives
// later as `./channels/whatsapp.ts`, dispatched from these SAME events keyed off
// `order.cliente_telefono`; the business code paths that fire the events (order
// creation, dispatch transition) will NOT change. See the SEAM comments below.
//
// Every event is FULLY GUARDED — it never throws. A notification must not abort or
// delay-fail the sale or the dispatch. Callers invoke it after the commit; a Resend
// failure lands in console.error with the orderId and the business op is untouched.

export async function notifyOrderCreated(orderId: string, brand: Brand): Promise<void> {
  try {
    const order = await loadOrderForNotification(orderId);
    if (!order) { console.warn(`[notify] order.created: orden ${orderId} no encontrada`); return; }

    // Email only if there's an address — phone-only orders are common (no-op else).
    if (order.cliente_email) {
      await sendCustomerEmail(order.cliente_email, renderOrderCreated(order, brand), brand);
    } else {
      console.log(`[notify] order.created: ${order.numero_orden} sin email — no-op`);
    }
    // SEAM: WhatsApp channel dispatches here later (order.cliente_telefono).
  } catch (e) {
    console.error(`[notify] order.created ${orderId}:`, e);
  }
}

export async function notifyOrderEnRoute(orderId: string, brand: Brand): Promise<void> {
  try {
    const order = await loadOrderForNotification(orderId);
    if (!order) { console.warn(`[notify] order.enRoute: orden ${orderId} no encontrada`); return; }

    if (order.cliente_email) {
      await sendCustomerEmail(order.cliente_email, renderOrderEnRoute(order, brand), brand);
    } else {
      console.log(`[notify] order.enRoute: ${order.numero_orden} sin email — no-op`);
    }
    // SEAM: WhatsApp channel dispatches here later (order.cliente_telefono).
  } catch (e) {
    console.error(`[notify] order.enRoute ${orderId}:`, e);
  }
}
