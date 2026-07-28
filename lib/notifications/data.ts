import prisma from '@/lib/prisma';

// The data-access for notifications: load the order the way the templates need it
// (items + shipping + customer snapshot columns). One place, so email and the
// future WhatsApp channel read the same shape.
export function loadOrderForNotification(orderId: string) {
  return prisma.order.findUnique({
    where:   { id: orderId },
    include: { items: true, shipping: true },
  });
}

export type NotifiableOrder = NonNullable<Awaited<ReturnType<typeof loadOrderForNotification>>>;

/** Public storefront base URL (same app origin). Preview uses its per-deploy URL. */
function appBaseUrl(): string {
  if (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return process.env.BETTER_AUTH_URL || 'http://localhost:3000';
}

/** Public order-tracking link. The recipient IS the order email, so it prefills. */
export function trackOrderUrl(numero: string, email: string): string {
  const qs = new URLSearchParams({ orden: numero, email });
  return `${appBaseUrl()}/rastrear-pedido?${qs.toString()}`;
}
