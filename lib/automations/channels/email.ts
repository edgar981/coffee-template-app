import { Resend } from 'resend';
import { siteConfig } from '@/lib/config/site';
import { buildBrand } from '@/lib/config/brand';
import { sendCustomerEmail } from '@/lib/notifications/channels/email';
import type { DispatchRequest, DispatchResult } from './types';
import type { RenderedEmail } from '@/lib/notifications/templates/shared';

// Canal EMAIL de las automatizaciones. Dos identidades, elegidas por la AUDIENCIA
// —no por quién dispara— porque son dos productos distintos hablando:
//
//   audiencia 'cliente' → identidad de la TIENDA (siteConfig.tienda.emailRemitente,
//     "Café Nayoli <pedidos@…>"). Reusa `sendCustomerEmail`, el canal que ya
//     existía para orden creada / en camino. No se duplica.
//
//   audiencia 'equipo'  → identidad del PANEL (env EMAIL_FROM, la misma de las
//     invitaciones). Un reporte interno que llegue firmado como la tienda le
//     miente al que lo recibe sobre qué sistema le está escribiendo.
//
// El redirect de dev (NOTIFICATIONS_REDIRECT_EMAIL) aplica a AMBAS: en local y en
// preview todo cae en un buzón, con el destinatario real anotado en el asunto.

/** Destinatario por defecto de los correos al equipo cuando la config no lista ninguno. */
export function defaultTeamRecipients(): string[] {
  const admin = process.env.ADMIN_EMAIL?.trim();
  return admin ? [admin] : [];
}

/** "a@x.com, b@y.com" → ["a@x.com","b@y.com"]. Vacío → el admin principal. */
export function parseRecipients(raw: unknown): string[] {
  const lista = String(raw ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(s => s.includes('@'));
  return lista.length > 0 ? lista : defaultTeamRecipients();
}

// Envío con la identidad del PANEL. Mismo contrato de fallos que sendCustomerEmail:
// sin RESEND_API_KEY (dev típico) loguea y vuelve; un fallo real de Resend lanza,
// para que el motor lo registre como run FALLIDO.
async function sendTeamEmail(to: string[], email: RenderedEmail): Promise<void> {
  const apiKey   = process.env.RESEND_API_KEY;
  const from     = process.env.EMAIL_FROM;
  const redirect = process.env.NOTIFICATIONS_REDIRECT_EMAIL?.trim();

  const finalTo = redirect ? [redirect] : to;
  const subject = redirect ? `${email.subject} [para: ${to.join(', ')}]` : email.subject;

  if (!apiKey || !from) {
    console.log(`[automations:email] (sin RESEND_API_KEY/EMAIL_FROM) → ${finalTo.join(', ')} · ${subject}`);
    return;
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from, to: finalTo, subject, html: email.html, text: email.text,
  });
  if (error) throw new Error(`Resend: ${error.message ?? 'error desconocido'}`);
}

export async function dispatchEmail(
  req: Extract<DispatchRequest, { canal: 'email' }>,
): Promise<DispatchResult> {
  const payload = {
    canal:      'email',
    audiencia:  req.audiencia,
    to:         req.to,
    remitente:  req.audiencia === 'equipo'
      ? (process.env.EMAIL_FROM ?? '(EMAIL_FROM sin configurar)')
      : siteConfig.tienda.emailRemitente,
    subject:    req.email.subject,
    // El texto plano, no el HTML: el payload es para leerlo en la auditoría.
    texto:      req.email.text,
  };

  // Sin destinatarios no hay a quién escribirle. Es un run OMITIDO, no un fallo:
  // el barrido corrió bien, simplemente no había buzón configurado.
  if (req.to.length === 0) {
    console.warn('[automations:email] sin destinatarios (config vacía y ADMIN_EMAIL sin definir)');
    return { estado: 'OMITIDO', payload: { ...payload, motivo: 'sin destinatarios' } };
  }

  if (req.audiencia === 'equipo') {
    await sendTeamEmail(req.to, req.email);
  } else {
    // Identidad de tienda — el canal que ya existía, uno por destinatario. El
    // brand se inyecta con buildBrand() (este canal vive en la app y conoce el
    // tenant). PRECONDICIÓN DE GO-LIVE: cuando las automatizaciones email-a-cliente
    // se activen y el motor se mueva a core, el brand debe THREADEARSE por el
    // evento — no leerse acá — igual que se hizo con notifications en Fase A.
    for (const to of req.to) await sendCustomerEmail(to, req.email, buildBrand());
  }

  return { estado: 'ENVIADO', payload };
}
