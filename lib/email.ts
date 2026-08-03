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
/**
 * Lee una env var tolerando COMILLAS ENVOLVENTES.
 *
 * En un archivo `.env` las comillas son sintaxis y el parser las quita; el panel
 * de Vercel NO parsea nada: guarda el valor literal. Pegar ahí una línea de
 * `.env` deja las comillas DENTRO del valor, y el síntoma es opaco —
 * `EMAIL_FROM` con comillas hace que Resend rechace el remitente, y una API key
 * entre comillas da un 401 que se lee como "key inválida" en vez de "key mal
 * pegada". Costó una tarde el 2026-08-03.
 *
 * Se limpia Y se avisa: aceptar el valor en silencio dejaría el dashboard mal
 * configurado para siempre y nadie se enteraría.
 */
function envSinComillas(nombre: string): string | undefined {
  const bruto = process.env[nombre];
  if (!bruto) return undefined;

  const recortado = bruto.trim();
  const limpio = recortado.replace(/^(["'])([\s\S]*)\1$/, "$2").trim();

  if (limpio !== recortado) {
    console.warn(
      `[env] ${nombre} venía entre comillas y se limpiaron. Las env vars de Vercel ` +
      `se guardan literales: el valor va SIN comillas. Corrígelo en el dashboard.`,
    );
  }
  return limpio || undefined;
}

/** `algo@dominio.com` o `Nombre <algo@dominio.com>` — lo que acepta Resend. */
const EMAIL_FROM_RE = /^(?:[^<>@\s]+@[^<>@\s]+\.[^<>@\s]+|[^<>]+<[^<>@\s]+@[^<>@\s]+\.[^<>@\s]+>)$/;

export async function sendInvitationEmail({ to, name, link }: SendInvitationEmailArgs) {
  const apiKey = envSinComillas("RESEND_API_KEY");
  const from = envSinComillas("EMAIL_FROM");

  // Grita ANTES de gastar la llamada: si el formato no matchea, el error de
  // Resend llega como un 422 genérico que no dice cuál de las dos cosas falló.
  // No se lanza a propósito — el regex podría ser más estricto que Resend, y
  // tumbar un envío que sí funcionaba es peor que un envío que falla con log.
  if (from && !EMAIL_FROM_RE.test(from)) {
    console.error(
      `[env] EMAIL_FROM no tiene un formato de remitente válido: ${JSON.stringify(from)}. ` +
      `Se espera "algo@dominio.com" o "Nombre <algo@dominio.com>", sin comillas envolventes.`,
    );
  }

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
    // La respuesta de error de Resend (`{ name, message, statusCode }`) viaja como
    // `cause`: el mensaje solo se quedaba con `message` y tiraba el resto, que es
    // justo lo que distingue una API key inválida/restringida (401/403) de un
    // dominio sin verificar o un payload rechazado (422).
    throw new Error(
      `No se pudo enviar la invitación (Resend): ${error.message ?? "error desconocido"}`,
      { cause: error },
    );
  }
}
