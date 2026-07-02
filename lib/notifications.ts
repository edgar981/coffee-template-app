import prisma from '@/lib/prisma';

interface CreateNotificationInput {
  tipo:    string;
  titulo:  string;
  mensaje: string;
  href?:   string;
}

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  await prisma.notification.create({ data: input });
}