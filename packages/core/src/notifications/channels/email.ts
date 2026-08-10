import { Resend } from 'resend';
import type { Brand } from '@duna/core/notifications/brand';
import type { RenderedEmail } from '@duna/core/notifications/templates/shared';

// THE email channel for customer notifications. Sender identity is the TIENDA's
// (brand.remitente), never Duna's — inyectada por quien llama, nunca leída de
// siteConfig aquí (regla de core: sin tenant adentro).
//
// Dev/preview redirect: if NOTIFICATIONS_REDIRECT_EMAIL is set, EVERY message goes
// to that address with the real recipient annotated in the subject `[para: x]`.
// Production leaves it unset so mail reaches the actual customer.
//
// No RESEND_API_KEY (typical local dev) → log and return; never throws for that.
// A real Resend failure throws so the caller can console.error the orderId.
export async function sendCustomerEmail(to: string, email: RenderedEmail, brand: Brand): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const redirect = process.env.NOTIFICATIONS_REDIRECT_EMAIL?.trim();

  const finalTo = redirect || to;
  const subject = redirect ? `${email.subject} [para: ${to}]` : email.subject;

  if (!apiKey) {
    console.log(`[notify:email] (sin RESEND_API_KEY) → ${finalTo} · ${subject}`);
    return;
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from:    brand.remitente,
    to:      finalTo,
    subject,
    html:    email.html,
    text:    email.text,
    ...(brand.replyTo ? { replyTo: brand.replyTo } : {}),
  });
  if (error) throw new Error(`Resend: ${error.message ?? 'error desconocido'}`);
}
