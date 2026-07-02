import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export async function sendWhatsApp(to: string, message: string): Promise<void> {
  // Normalize Colombian numbers: 3001234567 → +573001234567
  const normalized = to.startsWith('+') ? to : `+57${to.replace(/\D/g, '')}`;

  await client.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM!,
    to:   `whatsapp:${normalized}`,
    body: message,
  });
}