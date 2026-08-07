import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes((session.user as { role?: string }).role ?? '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, activo: true },
    // Los inactivos al final: la lista es de gente que trabaja, y quien salió del
    // equipo no debería competir por la atención con quien está adentro.
    orderBy: [{ activo: 'desc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json(users);
}