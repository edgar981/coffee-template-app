import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: 'desc' },
    take:    20,
  });

  return NextResponse.json(notifications);
}