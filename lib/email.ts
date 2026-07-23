import { Resend } from "resend";

interface SendInvitationEmailArgs {
  to: string;
  name: string;
  link: string;
}

// Sends the panel invitation via Resend. Requires RESEND_API_KEY and a verified
// sender in EMAIL_FROM (e.g. "Café Nayoli <no-reply@duna.solutions>").
// In non-production without those vars we fall back to logging the link, so
// local dev and previews work without a Resend account; in production a missing
// config throws loudly instead of silently dropping the invite.
export async function sendInvitationEmail({ to, name, link }: SendInvitationEmailArgs) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("El envío de correos no está configurado (RESEND_API_KEY / EMAIL_FROM)");
    }
    console.log(`[email:invitation] Para: ${name} <${to}>\nEnlace de invitación: ${link}`);
    return;
  }

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from,
    to,
    subject: "Tu invitación al panel de Café Nayoli",
    text:
      `Hola ${name},\n\n` +
      `Recibiste una invitación para unirte al panel de administración de Café Nayoli.\n` +
      `Acepta tu invitación (el enlace vence en 48 horas):\n${link}\n\n` +
      `Si no esperabas este correo, puedes ignorarlo.`,
    html: `
      <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1c1917">
        <h1 style="font-size:18px;margin:0 0 4px">Café Nayoli</h1>
        <p style="font-size:14px;color:#78716c;margin:0 0 24px">Panel de administración</p>
        <p style="font-size:15px;line-height:1.5;margin:0 0 20px">
          Hola ${name}, recibiste una invitación para unirte al panel de administración de Café Nayoli.
        </p>
        <p style="margin:0 0 24px">
          <a href="${link}" style="display:inline-block;background:#b45309;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 20px;border-radius:10px">
            Aceptar invitación
          </a>
        </p>
        <p style="font-size:13px;color:#78716c;line-height:1.5;margin:0">
          El enlace vence en 48 horas. Si el botón no funciona, copia y pega esta URL:<br>
          <a href="${link}" style="color:#b45309;word-break:break-all">${link}</a>
        </p>
      </div>
    `,
  });

  if (error) {
    throw new Error(`No se pudo enviar la invitación (Resend): ${error.message ?? "error desconocido"}`);
  }
}
