import { Resend } from 'resend';
import { siteConfig } from '@/lib/config/site';
import type { RenderedEmail } from '@/lib/notifications/templates/shared';

// THE email channel for customer notifications. Sender identity is the TIENDA's
// (siteConfig.tienda.emailRemitente), never Duna's.
//
// Dev/preview redirect: if NOTIFICATIONS_REDIRECT_EMAIL is set, EVERY message goes
// to that address with the real recipient annotated in the subject `[para: x]`.
// Production leaves it unset so mail reaches the actual customer.
//
// No RESEND_API_KEY (typical local dev) → log and return; never throws for that.
// A real Resend failure throws so the caller can console.error the orderId.
export async function sendCustomerEmail(to: string, email: RenderedEmail): Promise<void> {
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
    from:    siteConfig.tienda.emailRemitente,
    to:      finalTo,
    subject,
    html:    email.html,
    text:    email.text,
    ...(siteConfig.tienda.emailReplyTo ? { replyTo: siteConfig.tienda.emailReplyTo } : {}),
  });
  if (error) throw new Error(`Resend: ${error.message ?? 'error desconocido'}`);
}
