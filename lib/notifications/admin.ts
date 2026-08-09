import prisma from '@duna/core';

// ADMIN/internal notifications — the in-app bell (Notification model), NOT the
// customer-facing emails in this folder. Kept here (re-exported from index) so its
// existing importers (`@/lib/notifications`) keep working after this folder
// replaced the old single-file module.
interface CreateNotificationInput {
  tipo:    string;
  titulo:  string;
  mensaje: string;
  href?:   string;
}

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  await prisma.notification.create({ data: input });
}
