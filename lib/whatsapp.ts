import twilio from 'twilio';

// Lazy singleton. Building the client at import time meant a missing or
// placeholder TWILIO_* credential would throw as soon as ANY module that
// transitively imports this file was loaded (e.g. the automation triggers) —
// taking down unrelated routes. The demo ships with automations off, so the
// client is only constructed the first time a message is actually sent.
let client: ReturnType<typeof twilio> | null = null;

function getClient(): ReturnType<typeof twilio> {
  if (!client) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
      throw new Error('Twilio no está configurado (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)');
    }
    client = twilio(sid, token);
  }
  return client;
}

export async function sendWhatsApp(to: string, message: string): Promise<void> {
  // Normalize Colombian numbers: 3XXXXXXXXX → +573XXXXXXXXX
  const normalized = to.startsWith('+') ? to : `+57${to.replace(/\D/g, '')}`;

  await getClient().messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM!,
    to:   `whatsapp:${normalized}`,
    body: message,
  });
}