interface SendInvitationEmailArgs {
  to: string;
  name: string;
  link: string;
}

// TODO: swap for Resend once a sending domain is verified. Throws in production
// so a forgotten swap fails loudly instead of silently dropping invite emails.
export async function sendInvitationEmail({ to, name, link }: SendInvitationEmailArgs) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("El envío de correos no está configurado (Resend pendiente de integrar)");
  }

  console.log(`[email:invitation] Para: ${name} <${to}>\nEnlace de invitación: ${link}`);
}
